-- Login en el servidor (Edge Function `login`).
--
-- Antes: `resolver-login` devolvía al navegador el email real de cualquier DNI
-- (enumeración DNI → email con la anon key pública). Ahora el navegador manda
-- DNI/correo + contraseña a `login`, que resuelve el email y autentica del lado
-- del servidor; el email nunca sale.
--
-- Estas funciones solo las ejecuta service_role (la Edge Function).

-- 1) Resolver identificador → email canónico -------------------------------
create or replace function public.fn_login_resolver(p_login text)
returns table (email text, parroquia_activa boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(nullif(lower(btrim(u.email)), ''),
                    'dni-' || u.dni || '@no-email.sistemaconfirmacion.local') as email,
           exists(select 1 from public.model_has_roles mr
                    join public.roles r on r.id = mr.role_id
                   where mr.model_type = 'App\Models\User' and mr.model_id = u.id
                     and r.name = 'proveedor')
           or coalesce(p.activa, false) as parroquia_activa
      from public.users u
      left join public.parroquias p on p.id = u.parroquia_id
     where u.dni = btrim(p_login)
        or lower(u.email) = lower(btrim(p_login))
     limit 1
$$;

revoke all on function public.fn_login_resolver(text) from public, anon, authenticated;
grant execute on function public.fn_login_resolver(text) to service_role;

-- 2) Límite de intentos fallidos -------------------------------------------
-- Claves = 'ip:' || sha256(ip) y 'id:' || sha256(dni/correo normalizado): no se
-- guarda el dato en claro; el prefijo distingue el límite que aplica.
create table if not exists public.login_intentos (
    clave       text        not null,
    ventana     timestamptz not null,
    fallos      integer     not null default 0,
    primary key (clave, ventana)
);

alter table public.login_intentos enable row level security;
alter table public.login_intentos force row level security;
-- Sin políticas: denegado para anon/authenticated. Solo service_role (BYPASSRLS)
-- y las funciones SECURITY DEFINER de abajo.
revoke all on public.login_intentos from public, anon, authenticated;

-- Segundos que faltan para poder reintentar (0 = permitido).
-- Límite: p_max fallos por clave en una ventana de 15 minutos.
create or replace function public.fn_login_bloqueo(p_claves text[], p_max_id int default 8, p_max_ip int default 30)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(max(
        case
            when (li.clave like 'id:%' and li.fallos >= p_max_id)
              or (li.clave like 'ip:%' and li.fallos >= p_max_ip)
            then greatest(1, extract(epoch from (li.ventana + interval '15 minutes' - now()))::int)
            else 0
        end), 0)
      from public.login_intentos li
     where li.clave = any(p_claves)
       and li.ventana > now() - interval '15 minutes'
$$;

create or replace function public.fn_login_registrar(p_claves text[], p_exito boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    _ventana timestamptz := date_bin('15 minutes', now(), timestamptz '2000-01-01');
begin
    if p_exito then
        -- Login correcto: se limpia el contador de esa identidad (no el de la IP).
        delete from public.login_intentos where clave = any(p_claves) and clave like 'id:%';
    else
        insert into public.login_intentos (clave, ventana, fallos)
        select c, _ventana, 1 from unnest(p_claves) c
        on conflict (clave, ventana) do update set fallos = public.login_intentos.fallos + 1;
    end if;
    -- Limpieza oportunista.
    delete from public.login_intentos where ventana < now() - interval '1 day';
end
$$;

revoke all on function public.fn_login_bloqueo(text[], int, int) from public, anon, authenticated;
revoke all on function public.fn_login_registrar(text[], boolean) from public, anon, authenticated;
grant execute on function public.fn_login_bloqueo(text[], int, int) to service_role;
grant execute on function public.fn_login_registrar(text[], boolean) to service_role;
