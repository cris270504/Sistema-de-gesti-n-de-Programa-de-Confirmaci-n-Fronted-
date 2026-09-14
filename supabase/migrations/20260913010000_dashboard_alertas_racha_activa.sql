-- =====================================================================
-- v_dashboard_alertas: usar la racha ACTIVA (no el máximo histórico) como
-- criterio de "para retirar".
-- =====================================================================
-- La columna expuesta `injustificadas_seguidas` venía de `ag.max_historico`
-- (el peor racha de faltas injustificadas seguidas que tuvo el confirmando
-- en TODA su historia). Como max_historico nunca baja, un confirmando que
-- tuvo 3 faltas seguidas hace meses y desde entonces asiste normal sigue
-- marcado para retiro indefinidamente, aunque su situación actual esté bien.
--
-- Cambio: `injustificadas_seguidas` ahora expone `ag.racha_activa` (el
-- conteo de faltas injustificadas de la ÚLTIMA "isla" -- es decir, desde la
-- última vez que asistió/llegó tarde hasta hoy). Esto es exactamente lo que
-- ya usa nivel_riesgo/motivo_alerta para el caso "Alerta Crítica: ... en sus
-- ÚLTIMAS reuniones" (ag.racha_activa >= cfg1.alto_racha), así que el botón
-- de retiro del frontend (Dashboard.vue: `injustificadas_seguidas >= 3`)
-- pasa a reflejar la racha vigente en vez de un episodio ya superado.
--
-- No se toca nada más: la lógica de nivel_riesgo/motivo_alerta (que ya
-- distinguía racha_activa de max_historico internamente) queda igual, y el
-- resto de columnas expuestas no cambian de nombre ni de tipo, así que
-- alcanza con CREATE OR REPLACE VIEW (mismo shape de salida).
-- =====================================================================

create or replace view public.v_dashboard_alertas
with (security_invoker = true) as
with cfg1 as (
    select
        coalesce((pc.umbrales_alerta ->> 'alto_injustificadas')::integer, 4) as alto_injustificadas,
        coalesce((pc.umbrales_alerta ->> 'alto_racha')::integer, 2) as alto_racha,
        coalesce((pc.umbrales_alerta ->> 'alto_seguidas_historicas')::integer, 3) as alto_seguidas,
        coalesce((pc.umbrales_alerta ->> 'medio_justificadas')::integer, 4) as medio_justificadas,
        coalesce((pc.umbrales_alerta ->> 'bajo_tardanzas_seguidas')::integer, 2) as bajo_tardanzas
    from (select 1 as "?column?") _
    left join parroquia_configuraciones pc on true
    limit 1
),
base as (
    select
        a.asistente_id as confirmando_id,
        a.id,
        a.estado,
        a.estado::text = 'falta injustificada'::text and coalesce(j.estado, ''::character varying)::text <> 'pendiente'::text as es_inj,
        row_number() over w as rn,
        count(*) over (partition by a.asistente_id) as total_rn,
        count(*) filter (where a.estado::text = any (array['asistio'::character varying, 'tardanza'::character varying]::text[])) over w as isla
    from asistencia a
    join reunions r on r.id = a.reunion_id
    left join justificaciones j on j.asistencia_id = a.id
    where a.asistente_type::text = 'App\Models\Confirmando'::text
    window w as (partition by a.asistente_id order by r.fecha, a.id rows between unbounded preceding and current row)
),
base2 as (
    select
        b.confirmando_id,
        b.id,
        b.estado,
        b.es_inj,
        b.rn,
        b.total_rn,
        b.isla,
        (select cfg1.bajo_tardanzas from cfg1) as n_tard
    from base b
),
islas as (
    select
        base2.confirmando_id,
        base2.isla,
        count(*) filter (where base2.es_inj) as inj_en_isla
    from base2
    group by base2.confirmando_id, base2.isla
),
agg as (
    select
        b.confirmando_id,
        count(*) filter (where b.es_inj) as faltas_injustificadas,
        count(*) filter (where b.estado::text = 'falta justificada'::text) as faltas_justificadas,
        count(*) filter (where b.estado::text = 'tardanza'::text) as tardanzas,
        coalesce((select max(i.inj_en_isla) as max from islas i where i.confirmando_id = b.confirmando_id), 0::bigint) as max_historico,
        coalesce((select i.inj_en_isla from islas i where i.confirmando_id = b.confirmando_id order by i.isla desc limit 1), 0::bigint) as racha_activa,
        max(b.total_rn) >= max(b.n_tard) and bool_and(b.estado::text = 'tardanza'::text) filter (where b.rn > (b.total_rn - b.n_tard)) as tardanza_ultimas_n
    from base2 b
    group by b.confirmando_id
)
select
    c.id,
    (c.apellidos::text || ', '::text) || c.nombres::text as nombre_completo,
    coalesce(g.nombre, 'Sin grupo'::character varying) as grupo,
    c.grupo_id,
    coalesce(ag.faltas_injustificadas, 0::bigint) as total_faltas_injustificadas,
    coalesce(ag.faltas_justificadas, 0::bigint) as total_faltas_justificadas,
    coalesce(ag.tardanzas, 0::bigint) as total_tardanzas,
    -- antes: coalesce(ag.max_historico, 0::bigint) -- máximo histórico
    coalesce(ag.racha_activa, 0::bigint) as injustificadas_seguidas,
    case
        when coalesce(ag.faltas_injustificadas, 0::bigint) >= (select cfg1.alto_injustificadas from cfg1) then 'ALTO'::text
        when coalesce(ag.racha_activa, 0::bigint) >= (select cfg1.alto_racha from cfg1) then 'ALTO'::text
        when coalesce(ag.max_historico, 0::bigint) >= (select cfg1.alto_seguidas from cfg1) then 'ALTO'::text
        when coalesce(ag.faltas_justificadas, 0::bigint) >= (select cfg1.medio_justificadas from cfg1) then 'MEDIO'::text
        when coalesce(ag.tardanza_ultimas_n, false) then 'BAJO'::text
        else 'NINGUNO'::text
    end as nivel_riesgo,
    case
        when coalesce(ag.faltas_injustificadas, 0::bigint) >= (select cfg1.alto_injustificadas from cfg1)
            then ('Alerta Crítica: '::text || ag.faltas_injustificadas) || ' faltas injustificadas ACUMULADAS.'::text
        when coalesce(ag.racha_activa, 0::bigint) >= (select cfg1.alto_racha from cfg1)
            then ('Alerta Crítica: '::text || ag.racha_activa) || ' faltas injustificadas en sus ÚLTIMAS reuniones.'::text
        when coalesce(ag.max_historico, 0::bigint) >= (select cfg1.alto_seguidas from cfg1)
            then ('Alerta Crítica: Tuvo '::text || ag.max_historico) || ' faltas seguidas en el pasado.'::text
        when coalesce(ag.faltas_justificadas, 0::bigint) >= (select cfg1.medio_justificadas from cfg1)
            then ('Alerta de Desconexión: Tiene '::text || ag.faltas_justificadas) || ' faltas justificadas.'::text
        when coalesce(ag.tardanza_ultimas_n, false)
            then ('Alerta de Impuntualidad: Llegó tarde en sus últimas '::text || (select cfg1.bajo_tardanzas from cfg1)) || ' reuniones.'::text
        else ''::text
    end as motivo_alerta,
    coalesce((
        select (ap.apellidos::text || ', '::text) || ap.nombres::text
        from confirmando_apoderado ca
        join apoderados ap on ap.id = ca.apoderado_id
        where ca.confirmando_id = c.id
        order by ca.id
        limit 1
    ), 'No asignado'::text) as nombre_apoderado,
    coalesce((
        select ap.celular
        from confirmando_apoderado ca
        join apoderados ap on ap.id = ca.apoderado_id
        where ca.confirmando_id = c.id
        order by ca.id
        limit 1
    ), c.celular) as celular_apoderado
from confirmandos c
left join grupos g on g.id = c.grupo_id
left join agg ag on ag.confirmando_id = c.id
where c.estado::text <> 'retirado'::text;
