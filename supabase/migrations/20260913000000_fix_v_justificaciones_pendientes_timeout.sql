-- =====================================================================
-- Fix: 57014 (statement timeout) en v_justificaciones_pendientes
-- =====================================================================
-- Diagnóstico completo en el hilo con Claude Code (2026-09-13). Resumen:
--
-- 1) Casi todas las policies llaman a app_is_privileged() / app_user_grupo_ids() /
--    app_current_parroquia_id() / app_es_proveedor() "a pelo" (sin envolver en
--    `(select ...)`). Marcarlas STABLE no alcanza: Postgres solo colapsa la
--    llamada a un único InitPlan (evaluado 1 vez para todo el query) cuando la
--    ve como subquery no correlacionada explícita `(select fn())`. Sin eso, se
--    ejecutan una vez por fila, en cada una de las 8 tablas que arma la vista.
--
-- 2) Dos policies RESTRICTIVE evalúan "¿la fila padre es visible?" contra la
--    tabla COMPLETA en vez de la fila puntual:
--      asistencia_parroquia:     reunion_id IN (SELECT reunions.id FROM reunions)
--      justificaciones_parroquia: asistencia_id IN (SELECT asistencia.id FROM asistencia)
--    Esto encadena RLS anidada de 3 niveles (justificaciones -> asistencia ->
--    reunions), cruzando security barriers en cada nivel. Se reescriben como
--    EXISTS correlacionado sobre la FK puntual (mismo resultado, mismo
--    contrato de seguridad, plan muchísimo más barato).
--
-- 3) Con (1)+(2) el costo por fila baja, pero el problema de fondo sigue
--    siendo que security_invoker=true + RLS forzada en las 8 tablas hace que
--    la vista se planifique como security barrier: el `ORDER BY fecha_falta
--    DESC` que PostgREST agrega NUNCA se puede empujar hacia abajo del
--    barrier, así que Postgres tiene que materializar el join completo antes
--    de poder ordenar y aplicar el LIMIT/range de PostgREST. Por eso los
--    índices de FK (paso 1 que ya aplicaste) ayudan al costo de cada join,
--    pero no evitan el "materializar todo, después ordenar".
--
--    La solución definitiva para ESTA pantalla es fn_justificaciones_pendientes():
--    una función SECURITY DEFINER que calcula el scope del usuario (privilegio,
--    grupos, parroquia) UNA sola vez en variables locales, y lo aplica como
--    WHERE plano (sin RLS, sin barrier) sobre el mismo join. Como el resultado
--    de esta vista es por diseño una ventana acotada (N días + pendientes), el
--    plan deja de depender de "ordenar todo antes de filtrar" y el filtro de
--    scope pasa a ser un simple `= ANY(array)` en vez de una función por fila.
--
--    ⚠️ IMPORTANTE: esta función reimplementa a mano la lógica de las policies
--    de 8 tablas (ver mapeo policy-por-policy en los comentarios de más abajo).
--    Al ser SECURITY DEFINER sobre tablas con FORCE ROW LEVEL SECURITY, si el
--    owner de la función es un rol con privilegios elevados, la función se
--    convierte en el ÚNICO gate de autorización para esta consulta (RLS deja
--    de actuar como red de seguridad de respaldo). Antes de apuntar el
--    frontend a esta función, validar con la consulta de comparación al final
--    de este archivo, con al menos 3 usuarios de prueba (privilegiado,
--    catequista de un grupo, proveedor).
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 (bajo riesgo, preserva semántica exacta): envolver en (select ...)
-- las llamadas a funciones sin argumentos correlacionados, para forzar
-- InitPlan de evaluación única en vez de re-ejecución por fila.
-- ---------------------------------------------------------------------

-- apoderados
alter policy apoderados_delete on public.apoderados
    using ((select app_is_privileged()));

alter policy apoderados_insert on public.apoderados
    with check ((select app_is_privileged()));

alter policy apoderados_parroquia on public.apoderados
    using ((select app_parroquia_ok(parroquia_id)))
    with check ((select app_parroquia_ok(parroquia_id)));

alter policy apoderados_select on public.apoderados
    using (
        (select app_is_privileged())
        or (id in (
            select ca.apoderado_id
            from confirmando_apoderado ca
            join confirmandos c on c.id = ca.confirmando_id
            where c.grupo_id in (select app_user_grupo_ids())
        ))
    );

alter policy apoderados_update on public.apoderados
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- asistencia
alter policy asistencia_delete on public.asistencia
    using ((select app_is_privileged()));

alter policy asistencia_insert on public.asistencia
    with check (
        (select app_is_privileged())
        or (
            (asistente_type)::text = any ((array['App\Models\Confirmando','App\Models\Apoderado'])::text[])
            and app_can_access_asistente((asistente_type)::text, asistente_id)
        )
    );

alter policy asistencia_select on public.asistencia
    using (
        (select app_is_privileged())
        or app_can_access_asistente((asistente_type)::text, asistente_id)
    );

alter policy asistencia_update on public.asistencia
    using (
        (select app_is_privileged())
        or (
            (asistente_type)::text = any ((array['App\Models\Confirmando','App\Models\Apoderado'])::text[])
            and app_can_access_asistente((asistente_type)::text, asistente_id)
        )
    )
    with check (
        (select app_is_privileged())
        or (
            (asistente_type)::text = any ((array['App\Models\Confirmando','App\Models\Apoderado'])::text[])
            and app_can_access_asistente((asistente_type)::text, asistente_id)
        )
    );

-- confirmando_apoderado
alter policy confirmando_apoderado_delete on public.confirmando_apoderado
    using ((select app_is_privileged()));

alter policy confirmando_apoderado_insert on public.confirmando_apoderado
    with check ((select app_is_privileged()));

alter policy confirmando_apoderado_select on public.confirmando_apoderado
    using (
        (select app_is_privileged())
        or (confirmando_id in (
            select confirmandos.id
            from confirmandos
            where confirmandos.grupo_id in (select app_user_grupo_ids())
        ))
    );

alter policy confirmando_apoderado_update on public.confirmando_apoderado
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- confirmandos
alter policy confirmandos_delete on public.confirmandos
    using ((select app_is_privileged()));

alter policy confirmandos_insert on public.confirmandos
    with check ((select app_is_privileged()));

alter policy confirmandos_parroquia on public.confirmandos
    using ((select app_parroquia_ok(parroquia_id)))
    with check ((select app_parroquia_ok(parroquia_id)));

alter policy confirmandos_select on public.confirmandos
    using (
        (select app_is_privileged())
        or (grupo_id in (select app_user_grupo_ids()))
    );

alter policy confirmandos_update on public.confirmandos
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- grupos
alter policy grupos_delete on public.grupos
    using ((select app_is_privileged()));

alter policy grupos_insert on public.grupos
    with check ((select app_is_privileged()));

alter policy grupos_parroquia on public.grupos
    using ((select app_parroquia_ok(parroquia_id)))
    with check ((select app_parroquia_ok(parroquia_id)));

alter policy grupos_select on public.grupos
    using (
        (select app_is_privileged())
        or (id in (select app_user_grupo_ids()))
    );

alter policy grupos_update on public.grupos
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- justificaciones
alter policy justificaciones_delete on public.justificaciones
    using ((select app_is_privileged()));

alter policy justificaciones_insert on public.justificaciones
    with check (
        (select app_is_privileged())
        or exists (
            select 1 from asistencia a
            where a.id = justificaciones.asistencia_id
              and app_can_access_asistente((a.asistente_type)::text, a.asistente_id)
        )
    );

alter policy justificaciones_select on public.justificaciones
    using (
        (select app_is_privileged())
        or exists (
            select 1 from asistencia a
            where a.id = justificaciones.asistencia_id
              and app_can_access_asistente((a.asistente_type)::text, a.asistente_id)
        )
    );

alter policy justificaciones_update on public.justificaciones
    using (
        (select app_is_privileged())
        or exists (
            select 1 from asistencia a
            where a.id = justificaciones.asistencia_id
              and app_can_access_asistente((a.asistente_type)::text, a.asistente_id)
        )
    )
    with check (
        (select app_is_privileged())
        or exists (
            select 1 from asistencia a
            where a.id = justificaciones.asistencia_id
              and app_can_access_asistente((a.asistente_type)::text, a.asistente_id)
        )
    );

-- parroquia_configuraciones
alter policy parroquia_configuraciones_parroquia on public.parroquia_configuraciones
    using ((select app_parroquia_ok(parroquia_id)))
    with check ((select app_parroquia_ok(parroquia_id)));

alter policy parroquia_configuraciones_select on public.parroquia_configuraciones
    using (
        (select app_current_parroquia_id()) is not null
        or (select app_es_proveedor())
    );

alter policy parroquia_configuraciones_write on public.parroquia_configuraciones
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));

-- reunions
alter policy reunions_parroquia on public.reunions
    using ((select app_parroquia_ok(parroquia_id)))
    with check ((select app_parroquia_ok(parroquia_id)));

alter policy reunions_select on public.reunions
    using (
        (select app_current_parroquia_id()) is not null
        or (select app_es_proveedor())
    );

alter policy reunions_write on public.reunions
    using ((select app_is_privileged()))
    with check ((select app_is_privileged()));


-- ---------------------------------------------------------------------
-- PASO 2 (bajo riesgo, equivalente lógico exacto): las dos RESTRICTIVE que
-- preguntaban "¿existe ESTA fila en el conjunto COMPLETO de filas visibles
-- de la tabla padre?" (uncorrelated IN, dispara RLS anidada completa) pasan
-- a preguntar "¿la fila padre puntual (por FK) es visible?" (EXISTS
-- correlacionado por PK). Mismo conjunto de filas permitidas, plan más barato
-- porque usa el índice de PK de la tabla padre en vez de materializarla
-- entera.
-- ---------------------------------------------------------------------

alter policy asistencia_parroquia on public.asistencia
    using (
        exists (
            select 1 from reunions r
            where r.id = asistencia.reunion_id
        )
    )
    with check (
        exists (
            select 1 from reunions r
            where r.id = asistencia.reunion_id
        )
    );

alter policy justificaciones_parroquia on public.justificaciones
    using (
        exists (
            select 1 from asistencia a
            where a.id = justificaciones.asistencia_id
        )
    )
    with check (
        exists (
            select 1 from asistencia a
            where a.id = justificaciones.asistencia_id
        )
    );


-- ---------------------------------------------------------------------
-- PASO 3: índices de soporte que faltan para los joins que agregamos arriba
-- y para el filtro de scope de la función del paso 4 (IF NOT EXISTS: no
-- rompe nada si ya existen).
-- ---------------------------------------------------------------------

create index if not exists idx_reunions_parroquia_id on public.reunions (parroquia_id);
create index if not exists idx_confirmandos_parroquia_id on public.confirmandos (parroquia_id);
create index if not exists idx_grupos_parroquia_id on public.grupos (parroquia_id);
create index if not exists idx_apoderados_parroquia_id on public.apoderados (parroquia_id);
create index if not exists idx_parroquia_config_parroquia_id on public.parroquia_configuraciones (parroquia_id);
create index if not exists idx_catequista_grupo_user_id on public.catequista_grupo (user_id);
create index if not exists idx_confirmando_apoderado_confirmando_id on public.confirmando_apoderado (confirmando_id);


-- ---------------------------------------------------------------------
-- PASO 4 (⚠️ requiere validación — ver consulta de comparación al final):
-- función de reemplazo para el listado. Calcula el scope UNA vez (no por
-- fila) y lo usa como WHERE plano. security definer => bypassea RLS de las
-- 8 tablas (por eso hay que auditar cada condición contra la policy
-- original citada en el comentario correspondiente).
-- ---------------------------------------------------------------------

-- reunions.fecha es `timestamp without time zone` (no timestamptz), y
-- RETURNS TABLE no admite cambiar el rowtype vía CREATE OR REPLACE: hay que
-- dropear la función primero.
drop function if exists public.fn_justificaciones_pendientes(integer);

create function public.fn_justificaciones_pendientes(p_limit integer default 500)
returns table (
    asistencia_id bigint,
    fecha_falta timestamp,
    tema_reunion text,
    confirmando_id bigint,
    confirmando text,
    grupo text,
    apoderado_nombre text,
    apoderado_celular text,
    justificacion_id bigint,
    motivo text,
    descripcion text,
    fecha_acuerdo text,
    estado_justificacion text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
    v_privileged   boolean := app_is_privileged();
    v_es_proveedor boolean := app_es_proveedor();
    v_parroquia_id bigint  := app_current_parroquia_id();
    v_grupo_ids    bigint[] := array(select app_user_grupo_ids());
    v_dias         integer;
begin
    -- Replica app_is_privileged() / app_parroquia_ok(): visible si soy
    -- proveedor, o si la fila pertenece a mi parroquia actual.
    -- reunions_select + reunions_parroquia:
    --   ((v_parroquia_id IS NOT NULL) OR v_es_proveedor)
    --   AND (v_parroquia_id IS NULL OR v_es_proveedor OR parroquia_id = v_parroquia_id)
    --   se simplifica a: v_es_proveedor OR (v_parroquia_id IS NOT NULL AND parroquia_id = v_parroquia_id)

    select coalesce(pc.dias_ventana_justificacion::integer, 21)
      into v_dias
    from public.parroquia_configuraciones pc
    where v_es_proveedor
       or (v_parroquia_id is not null and pc.parroquia_id = v_parroquia_id)
    limit 1;

    v_dias := coalesce(v_dias, 21);

    return query
    select
        a.id,
        r.fecha,
        r.nombre_tema::text,
        c.id,
        (c.apellidos::text || ', ' || c.nombres::text),
        coalesce(g.nombre::text, 'Sin Grupo'),
        coalesce((ap.apellidos::text || ', ' || ap.nombres::text), 'No registrado'),
        coalesce(ap.celular::text, 'Sin celular'),
        j.id,
        coalesce(j.motivo::text, ''),
        coalesce(j.descripcion::text, ''),
        coalesce(j.fecha_acuerdo::text, ''),
        coalesce(j.estado::text, 'injustificado')
    from asistencia a
    -- asistencia_select: privilegiado o app_can_access_asistente(tipo, id).
    -- Para asistente_type = Confirmando, app_can_access_asistente se reduce a
    -- "confirmandos.grupo_id IN (mis grupos)" -- lo aplicamos abajo sobre c.
    join confirmandos c
        on c.id = a.asistente_id
       and a.asistente_type = 'App\Models\Confirmando'
       and (v_privileged or c.grupo_id = any (v_grupo_ids))
       and (v_parroquia_id is null or v_es_proveedor or c.parroquia_id = v_parroquia_id)
    -- asistencia_parroquia (reescrita): la reunion referenciada debe ser visible.
    join reunions r
        on r.id = a.reunion_id
       and (v_es_proveedor or (v_parroquia_id is not null and r.parroquia_id = v_parroquia_id))
    left join grupos g
        on g.id = c.grupo_id
       and (v_privileged or g.id = any (v_grupo_ids))
       and (v_parroquia_id is null or v_es_proveedor or g.parroquia_id = v_parroquia_id)
    -- justificaciones_select / justificaciones_parroquia: ya implicado por el
    -- join a `a` (misma fila, mismas condiciones de scope).
    left join justificaciones j
        on j.asistencia_id = a.id
    left join lateral (
        select ap_1.apellidos, ap_1.nombres, ap_1.celular
        from confirmando_apoderado ca
        join apoderados ap_1
            on ap_1.id = ca.apoderado_id
           and (v_parroquia_id is null or v_es_proveedor or ap_1.parroquia_id = v_parroquia_id)
        where ca.confirmando_id = c.id
        order by ca.id
        limit 1
    ) ap on true
    where c.estado <> 'retirado'
      and (
            a.estado = 'falta injustificada'
            or (j.id is not null and j.estado <> 'no_cumplido')
          )
      and (
            (j.id is not null and j.estado in ('pendiente', 'justificado'))
            or (
                 a.estado = 'falta injustificada'
                 and r.fecha >= (now() - make_interval(days => v_dias))
                 and r.fecha <= now()
               )
          )
    order by r.fecha desc
    limit p_limit;
end;
$function$;

revoke all on function public.fn_justificaciones_pendientes(integer) from public;
grant execute on function public.fn_justificaciones_pendientes(integer) to authenticated;


-- ---------------------------------------------------------------------
-- VALIDACIÓN (correr manualmente antes de pasar el frontend al RPC):
-- compara fila por fila la vista original (con RLS normal) contra la
-- función nueva, para el usuario logueado en ese momento. Deben coincidir
-- exactamente en cantidad y en asistencia_id. Repetir con un usuario
-- privilegiado, un catequista de un solo grupo, y un proveedor.
-- ---------------------------------------------------------------------
-- select count(*) from public.v_justificaciones_pendientes;
-- select count(*) from public.fn_justificaciones_pendientes(10000);
--
-- select asistencia_id from public.v_justificaciones_pendientes
-- except
-- select asistencia_id from public.fn_justificaciones_pendientes(10000);
--
-- select asistencia_id from public.fn_justificaciones_pendientes(10000)
-- except
-- select asistencia_id from public.v_justificaciones_pendientes;
-- (ambas EXCEPT deben devolver 0 filas)
