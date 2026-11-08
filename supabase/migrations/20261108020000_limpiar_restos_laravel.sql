-- Restos de Laravel.
--
-- users.password / remember_token: hashes bcrypt de la época Laravel (y de las
-- claves temporales que seguían escribiendo fn_admin_guardar_usuario y
-- fn_crear_parroquia). Supabase Auth es la única fuente de contraseñas desde la
-- Fase 1; estas columnas solo servían para filtrar hashes por la API
-- (coordinador/super-admin tenían SELECT sobre ellas).
--
-- Decisión (2026-11-08): vaciar SIN forzar cambio de contraseña.
-- Las columnas se conservan (vacías) para no reescribir los INSERT de las
-- funciones; un CHECK impide que vuelvan a guardar algo.

-- 1) Las RPC dejan de escribir el hash de la clave temporal.
do $$
declare
    f   regprocedure;
    def text;
begin
    foreach f in array array[
        'public.fn_admin_guardar_usuario(uuid,bigint,uuid,jsonb,text[],bigint[],text)'::regprocedure,
        'public.fn_crear_parroquia(uuid,text,text,text,text,text,text,uuid,text,text[])'::regprocedure
    ] loop
        def := pg_get_functiondef(f);
        if position('extensions.crypt(p_temp_password, extensions.gen_salt(''bf''))' in def) > 0 then
            execute replace(def,
                'extensions.crypt(p_temp_password, extensions.gen_salt(''bf''))',
                'NULL');
        end if;
    end loop;
end
$$;

-- 2) Vaciar y bloquear.
alter table public.users alter column password drop not null;
update public.users set password = null, remember_token = null
 where password is not null or remember_token is not null;
alter table public.users drop constraint if exists users_sin_password_legacy;
alter table public.users add constraint users_sin_password_legacy
    check (password is null and remember_token is null);

-- 3) Tablas de Laravel sin uso (sin FKs ni funciones que las referencien).
drop table if exists
    public.cache, public.cache_locks,
    public.jobs, public.job_batches, public.failed_jobs,
    public.sessions, public.password_reset_tokens, public.migrations,
    public.oauth_access_tokens, public.oauth_auth_codes, public.oauth_clients,
    public.oauth_device_codes, public.oauth_refresh_tokens;
