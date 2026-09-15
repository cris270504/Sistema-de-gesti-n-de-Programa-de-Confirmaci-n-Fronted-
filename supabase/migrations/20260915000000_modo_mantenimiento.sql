-- =====================================================================
-- Modo mantenimiento: el proveedor puede activar/desactivar un banner que
-- bloquea a cualquier usuario logueado (excepto al propio proveedor, que
-- necesita poder entrar para desactivarlo).
-- =====================================================================
-- Tabla singleton (una sola fila, id fijo) en vez de una config por
-- parroquia: el proveedor opera la plataforma completa, no una parroquia
-- puntual (mismo criterio que /parroquias en el frontend).
-- =====================================================================

create table if not exists public.system_status (
    id boolean primary key default true,
    mantenimiento boolean not null default false,
    mensaje text,
    updated_by uuid,
    updated_at timestamptz not null default now(),
    constraint system_status_singleton check (id = true)
);

insert into public.system_status (id, mantenimiento)
values (true, false)
on conflict (id) do nothing;

alter table public.system_status enable row level security;
alter table public.system_status force row level security;

drop policy if exists system_status_select on public.system_status;
create policy system_status_select on public.system_status
    for select
    to authenticated
    using (true);

drop policy if exists system_status_write on public.system_status;
create policy system_status_write on public.system_status
    for update
    to authenticated
    using ((select app_es_proveedor()))
    with check ((select app_es_proveedor()));

-- Realtime: para que el bloqueo/desbloqueo sea instantáneo en las pestañas ya
-- abiertas, no solo en la próxima navegación. Si la publicación no existe (o
-- la tabla ya fue agregada antes), esto no debe romper la migración.
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        begin
            execute 'alter publication supabase_realtime add table public.system_status';
        exception when duplicate_object then
            null;
        end;
    end if;
end $$;
