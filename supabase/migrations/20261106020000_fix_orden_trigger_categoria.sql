-- =====================================================================
-- FIX (urgente): no se podía crear ninguna reunión desde 20261106000000.
--
-- Los triggers BEFORE de una tabla corren en orden alfabético de nombre.
-- `reunions_categoria` corría ANTES que `trg_set_parroquia_id` (que completa
-- parroquia_id desde el JWT), así que veía parroquia_id NULL:
--   - sin categoria_id: no encontraba la categoría por defecto → NOT NULL;
--   - con categoria_id: "La categoría no pertenece a esta parroquia".
--
-- 1) Se renombra el trigger para que corra DESPUÉS: 'trg_set_reunion_…' >
--    'trg_set_parroquia_id'.
-- 2) Defensa extra: si parroquia_id aún llega NULL, la función la toma del
--    JWT (misma fuente que set_parroquia_id_desde_claim).
-- =====================================================================

create or replace function public.trg_reunions_categoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.parroquia_id is null then
        new.parroquia_id := public.app_current_parroquia_id();
    end if;

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

drop trigger if exists reunions_categoria on public.reunions;
drop trigger if exists trg_set_reunion_categoria on public.reunions;
create trigger trg_set_reunion_categoria
    before insert or update of categoria_id, parroquia_id on public.reunions
    for each row execute function public.trg_reunions_categoria();

-- VERIFICACIÓN: el orden debe quedar trg_set_parroquia_id → trg_set_reunion_categoria.
--   select tgname from pg_trigger
--    where tgrelid = 'public.reunions'::regclass and not tgisinternal order by tgname;
