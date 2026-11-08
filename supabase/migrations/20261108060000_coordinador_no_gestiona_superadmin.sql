-- Un coordinador no puede tomar el control del super-admin.
--
-- Antes: cualquier "privilegiado" (coordinador, super-admin, proveedor) podía
-- sobre CUALQUIER usuario de su parroquia: cambiarle la contraseña (action
-- update con `password` en admin-usuarios), el correo o los roles, desactivarlo
-- o borrarlo; y podía otorgar el rol super-admin (incluso a sí mismo).
--
-- Ahora:
--   - Solo un super-admin o el proveedor gestionan a un usuario super-admin.
--   - Solo un super-admin o el proveedor otorgan el rol super-admin.
--   (La action update de admin-usuarios ya no acepta `password`: para eso
--    están "Mi perfil" y el reseteo por el admin.)

create or replace function public.app_exigir_puede_gestionar(p_actor_id bigint, p_actor_proveedor boolean, p_target_id bigint)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    _es_sa constant text := 'super-admin';
begin
    if p_actor_proveedor then
        return;
    end if;
    -- El actor es super-admin → puede.
    if exists (select 1 from model_has_roles m join roles r on r.id = m.role_id
                where m.model_type = 'App\Models\User' and m.model_id = p_actor_id and r.name = _es_sa) then
        return;
    end if;
    -- Actor coordinador: no sobre un super-admin de su misma parroquia (otra
    -- parroquia la rechaza después el chequeo de "no encontrado").
    if exists (select 1 from users t
                 join model_has_roles m on m.model_type = 'App\Models\User' and m.model_id = t.id
                 join roles r on r.id = m.role_id and r.name = _es_sa
                where t.id = p_target_id
                  and t.parroquia_id = (select parroquia_id from users where id = p_actor_id)) then
        raise exception 'Solo el administrador de la parroquia puede modificar a otro administrador.'
            using errcode = 'insufficient_privilege';
    end if;
end
$$;

revoke all on function public.app_exigir_puede_gestionar(bigint, boolean, bigint) from public, anon, authenticated;
grant execute on function public.app_exigir_puede_gestionar(bigint, boolean, bigint) to service_role;

do $$
declare
    f        regprocedure;
    def      text;
    ancla    text := 'IF _tpar IS NULL OR (_tpar <> _act.parroquia_id AND NOT _act.proveedor) THEN';
    ancla_rol text := 'IF (NOT _act.proveedor) AND (''proveedor'' = ANY(p_roles)) THEN';
    chequeo_rol text := 'IF (NOT _act.proveedor) AND (''super-admin'' = ANY(p_roles))
           AND NOT EXISTS (SELECT 1 FROM public.model_has_roles m JOIN public.roles r ON r.id = m.role_id
                            WHERE m.model_type = ''App\Models\User'' AND m.model_id = _act.id
                              AND r.name = ''super-admin'') THEN
            RAISE EXCEPTION ''Solo el administrador de la parroquia puede otorgar el rol super-admin.''
                USING ERRCODE = ''insufficient_privilege'';
        END IF;
        ';
begin
    foreach f in array array[
        'public.fn_admin_target_auth(uuid,bigint)'::regprocedure,
        'public.fn_admin_guardar_usuario(uuid,bigint,uuid,jsonb,text[],bigint[],text)'::regprocedure,
        'public.fn_admin_estado_usuario(uuid,bigint,boolean)'::regprocedure,
        'public.fn_admin_eliminar_usuario(uuid,bigint)'::regprocedure
    ] loop
        def := pg_get_functiondef(f);
        if position('app_exigir_puede_gestionar' in def) > 0 then
            continue; -- ya parcheada (re-ejecución)
        end if;
        if position(ancla in def) = 0 then
            raise exception '% cambió: no se encontró el chequeo de parroquia', f;
        end if;
        def := replace(def, ancla,
            'PERFORM public.app_exigir_puede_gestionar(_act.id, _act.proveedor, p_id);
    ' || ancla);
        if f = 'public.fn_admin_guardar_usuario(uuid,bigint,uuid,jsonb,text[],bigint[],text)'::regprocedure then
            if position(ancla_rol in def) = 0 then
                raise exception 'fn_admin_guardar_usuario cambió: no se encontró el chequeo de roles';
            end if;
            def := replace(def, ancla_rol, chequeo_rol || ancla_rol);
        end if;
        execute def;
    end loop;
end
$$;
