-- =====================================================================
-- Cronograma por momentos para jornadas / retiros.
--
-- 1) reunion_categorias: categorías configurables por parroquia
--    (por defecto Reunión, Jornada, Retiro). Cada una define si permite
--    cronograma. Las reuniones existentes quedan como "Reunión".
-- 2) reunions.categoria_id (NOT NULL; si el frontend viejo no la manda,
--    un trigger asigna "Reunión").
-- 3) reunion_momentos: momentos encadenados. La hora de inicio del
--    programa ES la hora de reunions.fecha (una sola fuente de verdad).
--    Si hay momento clave, inicio = clave_hora − suma de duraciones previas
--    y el trigger reescribe reunions.fecha; si cambia la hora de la reunión
--    desde el calendario, la clave se desplaza el mismo delta.
-- 4) reunion_momento_responsables: varios responsables por momento
--    (catequistas y coordinadores activos de la misma parroquia).
-- 5) RPC cronograma_duplicar: nueva reunión + copia de momentos y
--    responsables, sin asistencias.
--
-- RLS de las tablas nuevas: POR PERMISO (decisión del usuario 2026-11-06)
--   ver      → 'ver cronograma'
--   escribir → 'editar cronograma'
--   categorías (configuración) → 'administrar parroquia'
-- reunions conserva sus políticas actuales (por rol).
--
-- No hay staging: correr primero la VERIFICACIÓN PREVIA del final.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helper: ¿el JWT trae este permiso y la parroquia está activa?
-- ---------------------------------------------------------------------
create or replace function public.app_tiene_permiso(p_permiso text)
returns boolean
language sql
stable
set search_path = public
as $$
    select (
        public.app_es_proveedor()
        or p_permiso = any (public.app_current_permisos())
    )
    and public.app_parroquia_activa()
$$;

revoke all on function public.app_tiene_permiso(text) from public, anon;
grant execute on function public.app_tiene_permiso(text) to authenticated;


-- ---------------------------------------------------------------------
-- 1) Categorías
-- ---------------------------------------------------------------------
create table if not exists public.reunion_categorias (
    id                  bigint generated always as identity primary key,
    parroquia_id        bigint not null references public.parroquias(id) on delete cascade,
    nombre              text not null,
    permite_cronograma  boolean not null default false,
    orden               smallint not null default 0,
    activa              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint reunion_categorias_nombre_check
        check (char_length(btrim(nombre)) between 1 and 40)
);

create unique index if not exists uq_reunion_categorias_parroquia_nombre
    on public.reunion_categorias (parroquia_id, lower(btrim(nombre)));

-- Semilla para las parroquias existentes.
insert into public.reunion_categorias (parroquia_id, nombre, permite_cronograma, orden)
select p.id, c.nombre, c.permite, c.orden
  from public.parroquias p
 cross join (values ('Reunión', false, 0), ('Jornada', true, 1), ('Retiro', true, 2))
       as c(nombre, permite, orden)
on conflict do nothing;

-- Semilla para parroquias nuevas.
create or replace function public.trg_parroquia_categorias_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.reunion_categorias (parroquia_id, nombre, permite_cronograma, orden)
    values (new.id, 'Reunión', false, 0),
           (new.id, 'Jornada', true, 1),
           (new.id, 'Retiro',  true, 2)
    on conflict do nothing;
    return new;
end
$$;

revoke all on function public.trg_parroquia_categorias_default() from public, anon, authenticated;

drop trigger if exists parroquias_categorias_default on public.parroquias;
create trigger parroquias_categorias_default
    after insert on public.parroquias
    for each row execute function public.trg_parroquia_categorias_default();


-- ---------------------------------------------------------------------
-- 2) reunions.categoria_id
-- ---------------------------------------------------------------------
alter table public.reunions
    add column if not exists categoria_id bigint references public.reunion_categorias(id);

update public.reunions r
   set categoria_id = c.id
  from public.reunion_categorias c
 where r.categoria_id is null
   and c.parroquia_id = r.parroquia_id
   and c.nombre = 'Reunión';

alter table public.reunions alter column categoria_id set not null;

create index if not exists idx_reunions_categoria on public.reunions (categoria_id);

-- Default "Reunión" + la categoría debe ser de la misma parroquia.
create or replace function public.trg_reunions_categoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.categoria_id is null then
        select c.id into new.categoria_id
          from public.reunion_categorias c
         where c.parroquia_id = new.parroquia_id
         order by c.permite_cronograma, c.orden
         limit 1;
    elsif not exists (
        select 1 from public.reunion_categorias c
         where c.id = new.categoria_id and c.parroquia_id = new.parroquia_id
    ) then
        raise exception 'La categoría no pertenece a esta parroquia.'
            using errcode = '23514';
    end if;
    return new;
end
$$;

revoke all on function public.trg_reunions_categoria() from public, anon, authenticated;

-- OJO: nombre corregido en 20261106020000 (trg_set_reunion_categoria) para que
-- corra después de trg_set_parroquia_id; este bloque se conserva como se aplicó.
drop trigger if exists reunions_categoria on public.reunions;
create trigger reunions_categoria
    before insert or update of categoria_id, parroquia_id on public.reunions
    for each row execute function public.trg_reunions_categoria();


-- ---------------------------------------------------------------------
-- 3) Momentos
-- ---------------------------------------------------------------------
create table if not exists public.reunion_momentos (
    id             bigint generated always as identity primary key,
    reunion_id     bigint not null references public.reunions(id) on delete cascade,
    nombre         text not null,
    detalle        text,
    -- null = "Sin hora definida".
    duracion_min   smallint,
    en_cronograma  boolean not null default true,
    orden          integer not null default 0,
    es_clave       boolean not null default false,
    clave_hora     time without time zone,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint reunion_momentos_nombre_check
        check (char_length(btrim(nombre)) between 1 and 120),
    constraint reunion_momentos_detalle_check
        check (detalle is null or char_length(detalle) <= 2000),
    constraint reunion_momentos_duracion_check
        check (duracion_min is null or duracion_min between 1 and 1440),
    constraint reunion_momentos_cronograma_check
        check (not en_cronograma or duracion_min is not null),
    constraint reunion_momentos_clave_check
        check (not es_clave or (en_cronograma and clave_hora is not null))
);

create index if not exists idx_reunion_momentos_reunion_orden
    on public.reunion_momentos (reunion_id, en_cronograma, orden);

create unique index if not exists uq_reunion_momentos_una_clave
    on public.reunion_momentos (reunion_id) where es_clave;

-- BEFORE: la reunión debe permitir cronograma; marcar clave toma su hora
-- actual (inicio + duraciones previas) si no viene clave_hora.
create or replace function public.trg_reunion_momentos_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    _fecha  timestamp;
    _previo integer;
begin
    if not exists (
        select 1 from public.reunions r
          join public.reunion_categorias c on c.id = r.categoria_id
         where r.id = new.reunion_id and c.permite_cronograma
    ) then
        raise exception 'La categoría de esta reunión no permite cronograma.'
            using errcode = '23514';
    end if;

    if not new.en_cronograma then
        new.es_clave := false;
        new.clave_hora := null;
    elsif not new.es_clave then
        new.clave_hora := null;
    elsif new.clave_hora is null then
        select r.fecha into _fecha from public.reunions r where r.id = new.reunion_id;
        select coalesce(sum(m.duracion_min), 0) into _previo
          from public.reunion_momentos m
         where m.reunion_id = new.reunion_id
           and m.en_cronograma
           and m.id is distinct from new.id
           and m.orden < new.orden;
        new.clave_hora := (_fecha + make_interval(mins => _previo))::time;
    end if;

    new.updated_at := now();
    return new;
end
$$;

revoke all on function public.trg_reunion_momentos_before() from public, anon, authenticated;

drop trigger if exists reunion_momentos_before on public.reunion_momentos;
create trigger reunion_momentos_before
    before insert or update on public.reunion_momentos
    for each row execute function public.trg_reunion_momentos_before();

-- AFTER: con clave, inicio = clave_hora − duraciones previas → reunions.fecha.
-- AFTER ROW se encola al final de la sentencia: un reordenamiento hecho en
-- un solo UPSERT ve el orden final. SECURITY DEFINER porque quien tiene
-- 'editar cronograma' puede no pasar reunions_write; solo toca la hora.
create or replace function public.app_cronograma_recalcular(p_reunion_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    _clave_hora time;
    _clave_ord  integer;
    _previo     integer;
    _fecha      timestamp;
    _inicio_min integer;
begin
    select m.clave_hora, m.orden into _clave_hora, _clave_ord
      from public.reunion_momentos m
     where m.reunion_id = p_reunion_id and m.es_clave;

    if _clave_hora is null then
        return; -- sin clave: reunions.fecha ya es el inicio.
    end if;

    select coalesce(sum(m.duracion_min), 0) into _previo
      from public.reunion_momentos m
     where m.reunion_id = p_reunion_id and m.en_cronograma and m.orden < _clave_ord;

    _inicio_min := extract(hour from _clave_hora)::int * 60
                 + extract(minute from _clave_hora)::int - _previo;

    if _inicio_min < 0 then
        raise exception 'Con esa hora clave el programa empezaría el día anterior.'
            using errcode = '22008';
    end if;

    select r.fecha into _fecha from public.reunions r where r.id = p_reunion_id;

    perform set_config('app.cronograma_sync', 'on', true);
    update public.reunions
       set fecha = _fecha::date + make_interval(mins => _inicio_min),
           updated_at = now()
     where id = p_reunion_id
       and fecha <> _fecha::date + make_interval(mins => _inicio_min);
    perform set_config('app.cronograma_sync', 'off', true);
end
$$;

revoke all on function public.app_cronograma_recalcular(bigint) from public, anon, authenticated;

create or replace function public.trg_reunion_momentos_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.app_cronograma_recalcular(coalesce(new.reunion_id, old.reunion_id));
    return null;
end
$$;

revoke all on function public.trg_reunion_momentos_after() from public, anon, authenticated;

drop trigger if exists reunion_momentos_after on public.reunion_momentos;
create trigger reunion_momentos_after
    after insert or update or delete on public.reunion_momentos
    for each row execute function public.trg_reunion_momentos_after();

-- Sentido inverso: si la hora de la reunión cambia desde el calendario,
-- la clave se desplaza el mismo delta (todo el programa se mueve).
create or replace function public.trg_reunions_mueve_clave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(current_setting('app.cronograma_sync', true), 'off') = 'on' then
        return new;
    end if;
    update public.reunion_momentos
       set clave_hora = (clave_hora + (new.fecha::time - old.fecha::time))
     where reunion_id = new.id and es_clave;
    return new;
end
$$;

revoke all on function public.trg_reunions_mueve_clave() from public, anon, authenticated;

drop trigger if exists reunions_mueve_clave on public.reunions;
create trigger reunions_mueve_clave
    after update of fecha on public.reunions
    for each row
    when (old.fecha::time is distinct from new.fecha::time)
    execute function public.trg_reunions_mueve_clave();


-- ---------------------------------------------------------------------
-- 4) Responsables (varios por momento)
-- ---------------------------------------------------------------------
create table if not exists public.reunion_momento_responsables (
    momento_id  bigint not null references public.reunion_momentos(id) on delete cascade,
    user_id     bigint not null references public.users(id) on delete cascade,
    primary key (momento_id, user_id)
);

create index if not exists idx_reunion_momento_responsables_user
    on public.reunion_momento_responsables (user_id);

create or replace function public.trg_momento_responsable_valido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1
          from public.reunion_momentos m
          join public.reunions r on r.id = m.reunion_id
          join public.users u on u.id = new.user_id
         where m.id = new.momento_id
           and u.parroquia_id = r.parroquia_id
           and u.activo
           and u.id in (select public.app_user_ids_por_rol(array['catequista','coordinador']))
    ) then
        raise exception 'El responsable debe ser un catequista o coordinador activo de la parroquia.'
            using errcode = '23514';
    end if;
    return new;
end
$$;

revoke all on function public.trg_momento_responsable_valido() from public, anon, authenticated;

drop trigger if exists momento_responsable_valido on public.reunion_momento_responsables;
create trigger momento_responsable_valido
    before insert or update on public.reunion_momento_responsables
    for each row execute function public.trg_momento_responsable_valido();


-- ---------------------------------------------------------------------
-- 5) RLS (deny-all por defecto)
-- ---------------------------------------------------------------------
alter table public.reunion_categorias enable row level security;
alter table public.reunion_categorias force row level security;
alter table public.reunion_momentos enable row level security;
alter table public.reunion_momentos force row level security;
alter table public.reunion_momento_responsables enable row level security;
alter table public.reunion_momento_responsables force row level security;

revoke all on public.reunion_categorias from anon, public;
revoke all on public.reunion_momentos from anon, public;
revoke all on public.reunion_momento_responsables from anon, public;
grant select, insert, update, delete on public.reunion_categorias to authenticated;
grant select, insert, update, delete on public.reunion_momentos to authenticated;
grant select, insert, delete on public.reunion_momento_responsables to authenticated;

-- Categorías: las lee todo usuario de la parroquia (el calendario las usa);
-- las configura quien administra la parroquia.
drop policy if exists reunion_categorias_select on public.reunion_categorias;
create policy reunion_categorias_select on public.reunion_categorias
    for select to authenticated
    using ((select app_parroquia_ok(parroquia_id))
           and ((select app_current_parroquia_id()) is not null or (select app_es_proveedor())));

drop policy if exists reunion_categorias_insert on public.reunion_categorias;
create policy reunion_categorias_insert on public.reunion_categorias
    for insert to authenticated
    with check ((select app_parroquia_ok(parroquia_id))
                and (select app_tiene_permiso('administrar parroquia')));

drop policy if exists reunion_categorias_update on public.reunion_categorias;
create policy reunion_categorias_update on public.reunion_categorias
    for update to authenticated
    using ((select app_parroquia_ok(parroquia_id))
           and (select app_tiene_permiso('administrar parroquia')))
    with check ((select app_parroquia_ok(parroquia_id))
                and (select app_tiene_permiso('administrar parroquia')));

drop policy if exists reunion_categorias_delete on public.reunion_categorias;
create policy reunion_categorias_delete on public.reunion_categorias
    for delete to authenticated
    using ((select app_parroquia_ok(parroquia_id))
           and (select app_tiene_permiso('administrar parroquia')));

-- Momentos: el EXISTS sobre reunions hereda su RLS de parroquia.
drop policy if exists reunion_momentos_select on public.reunion_momentos;
create policy reunion_momentos_select on public.reunion_momentos
    for select to authenticated
    using ((select app_tiene_permiso('ver cronograma'))
           and exists (select 1 from public.reunions r where r.id = reunion_momentos.reunion_id));

drop policy if exists reunion_momentos_insert on public.reunion_momentos;
create policy reunion_momentos_insert on public.reunion_momentos
    for insert to authenticated
    with check ((select app_tiene_permiso('editar cronograma'))
                and exists (select 1 from public.reunions r where r.id = reunion_momentos.reunion_id));

drop policy if exists reunion_momentos_update on public.reunion_momentos;
create policy reunion_momentos_update on public.reunion_momentos
    for update to authenticated
    using ((select app_tiene_permiso('editar cronograma'))
           and exists (select 1 from public.reunions r where r.id = reunion_momentos.reunion_id))
    with check ((select app_tiene_permiso('editar cronograma'))
                and exists (select 1 from public.reunions r where r.id = reunion_momentos.reunion_id));

drop policy if exists reunion_momentos_delete on public.reunion_momentos;
create policy reunion_momentos_delete on public.reunion_momentos
    for delete to authenticated
    using ((select app_tiene_permiso('editar cronograma'))
           and exists (select 1 from public.reunions r where r.id = reunion_momentos.reunion_id));

-- Responsables: el EXISTS sobre momentos hereda la cadena anterior.
drop policy if exists reunion_momento_responsables_select on public.reunion_momento_responsables;
create policy reunion_momento_responsables_select on public.reunion_momento_responsables
    for select to authenticated
    using ((select app_tiene_permiso('ver cronograma'))
           and exists (select 1 from public.reunion_momentos m
                        where m.id = reunion_momento_responsables.momento_id));

drop policy if exists reunion_momento_responsables_insert on public.reunion_momento_responsables;
create policy reunion_momento_responsables_insert on public.reunion_momento_responsables
    for insert to authenticated
    with check ((select app_tiene_permiso('editar cronograma'))
                and exists (select 1 from public.reunion_momentos m
                             where m.id = reunion_momento_responsables.momento_id));

drop policy if exists reunion_momento_responsables_delete on public.reunion_momento_responsables;
create policy reunion_momento_responsables_delete on public.reunion_momento_responsables
    for delete to authenticated
    using ((select app_tiene_permiso('editar cronograma'))
           and exists (select 1 from public.reunion_momentos m
                        where m.id = reunion_momento_responsables.momento_id));


-- ---------------------------------------------------------------------
-- 6) Duplicar: nueva fecha y nombre, copia cronograma, no asistencias.
--    SECURITY INVOKER: crear la reunión sigue exigiendo reunions_write.
-- ---------------------------------------------------------------------
create or replace function public.cronograma_duplicar(
    p_reunion_id bigint,
    p_nombre     text,
    p_fecha      timestamp without time zone
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
    _nueva bigint;
    _delta interval;
    _copia bigint;
    _m     public.reunion_momentos%rowtype;
begin
    if not public.app_tiene_permiso('editar cronograma') then
        raise exception 'No tiene permiso para editar cronogramas.' using errcode = '42501';
    end if;
    if p_nombre is null or char_length(btrim(p_nombre)) not between 1 and 255 then
        raise exception 'Nombre inválido.' using errcode = '22023';
    end if;
    if p_fecha is null then
        raise exception 'Fecha requerida.' using errcode = '22023';
    end if;

    insert into public.reunions (nombre_tema, fecha, descripcion, tipo, parroquia_id, categoria_id)
    select btrim(p_nombre), p_fecha, r.descripcion, r.tipo, r.parroquia_id, r.categoria_id
      from public.reunions r
     where r.id = p_reunion_id
    returning id into _nueva;

    if _nueva is null then
        raise exception 'Reunión no encontrada.' using errcode = 'P0002';
    end if;

    -- La clave se desplaza lo mismo que la hora nueva respecto de la original.
    select p_fecha::time - r.fecha::time into _delta
      from public.reunions r where r.id = p_reunion_id;

    for _m in
        select m.* from public.reunion_momentos m
         where m.reunion_id = p_reunion_id
         order by m.en_cronograma desc, m.orden, m.id
    loop
        insert into public.reunion_momentos
            (reunion_id, nombre, detalle, duracion_min, en_cronograma, orden, es_clave, clave_hora)
        values (_nueva, _m.nombre, _m.detalle, _m.duracion_min, _m.en_cronograma, _m.orden,
                _m.es_clave, case when _m.es_clave then _m.clave_hora + _delta end)
        returning id into _copia;

        insert into public.reunion_momento_responsables (momento_id, user_id)
        select _copia, rr.user_id
          from public.reunion_momento_responsables rr
         where rr.momento_id = _m.id
        on conflict do nothing;
    end loop;

    return _nueva;
end
$$;

revoke all on function public.cronograma_duplicar(bigint, text, timestamp) from public, anon;
grant execute on function public.cronograma_duplicar(bigint, text, timestamp) to authenticated;


-- =====================================================================
-- VERIFICACIÓN PREVIA (solo lectura; correr antes):
--   select count(*) from public.reunions where parroquia_id is null;          -- esperado 0
--   select id from public.parroquias;                                         -- recibirán 3 categorías
--   select 'editar cronograma' = any(public.app_current_permisos());          -- con un coordinador
-- VERIFICACIÓN POSTERIOR:
--   select count(*) from public.reunions where categoria_id is null;          -- esperado 0
--   select parroquia_id, nombre, permite_cronograma from public.reunion_categorias order by 1, orden;
-- =====================================================================
