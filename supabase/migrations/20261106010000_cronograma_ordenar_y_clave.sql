-- =====================================================================
-- Cronograma de jornadas: RPC atómicos que el cliente no puede hacer bien
-- con PostgREST.
--
-- cronograma_ordenar: reordenar (arrastrar y soltar) en UNA sentencia. El
--   upsert de PostgREST no sirve: reunion_momentos.id es GENERATED ALWAYS y
--   Postgres rechaza el id explícito antes de evaluar ON CONFLICT. Al ser una
--   sola sentencia, los triggers AFTER ROW ven el orden final.
-- cronograma_clave: cambiar (o quitar) el momento clave sin pasar por un
--   estado con dos claves (índice único parcial).
--
-- SECURITY INVOKER: la RLS por permiso de reunion_momentos sigue actuando.
-- Depende de 20261106000000_cronograma_jornadas.sql.
-- =====================================================================

create or replace function public.cronograma_ordenar(
    p_reunion_id bigint,
    p_cronograma bigint[],
    p_sin_hora   bigint[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    if not public.app_tiene_permiso('editar cronograma') then
        raise exception 'No tiene permiso para editar cronogramas.' using errcode = '42501';
    end if;
    if exists (
        select 1 from unnest(coalesce(p_cronograma, '{}')) a(id)
         where a.id = any (coalesce(p_sin_hora, '{}'))
    ) then
        raise exception 'Un momento no puede estar en ambas listas.' using errcode = '22023';
    end if;

    update public.reunion_momentos m
       set en_cronograma = x.en,
           orden         = x.ord,
           -- Pasar al cronograma exige duración (el cliente la pide antes);
           -- 15 min solo como red de seguridad, igual que la app de origen.
           duracion_min  = case when x.en then coalesce(m.duracion_min, 15) else m.duracion_min end
      from (
            select u.id, true as en, (u.ord - 1)::int as ord
              from unnest(coalesce(p_cronograma, '{}')) with ordinality as u(id, ord)
            union all
            select u.id, false, (u.ord - 1)::int
              from unnest(coalesce(p_sin_hora, '{}')) with ordinality as u(id, ord)
           ) x
     where m.id = x.id
       and m.reunion_id = p_reunion_id;
end
$$;

revoke all on function public.cronograma_ordenar(bigint, bigint[], bigint[]) from public, anon;
grant execute on function public.cronograma_ordenar(bigint, bigint[], bigint[]) to authenticated;


-- p_momento_id null = quitar la clave (la hora de inicio se conserva: ya
-- está en reunions.fecha). Marcar toma la hora actual del momento.
create or replace function public.cronograma_clave(
    p_reunion_id bigint,
    p_momento_id bigint
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    if not public.app_tiene_permiso('editar cronograma') then
        raise exception 'No tiene permiso para editar cronogramas.' using errcode = '42501';
    end if;

    update public.reunion_momentos
       set es_clave = false, clave_hora = null
     where reunion_id = p_reunion_id and es_clave
       and id is distinct from p_momento_id;

    if p_momento_id is not null then
        update public.reunion_momentos
           set es_clave = true, clave_hora = null   -- el trigger calcula su hora actual
         where id = p_momento_id and reunion_id = p_reunion_id and en_cronograma;
        if not found then
            raise exception 'El momento no está en el cronograma.' using errcode = '22023';
        end if;
    end if;
end
$$;

revoke all on function public.cronograma_clave(bigint, bigint) from public, anon;
grant execute on function public.cronograma_clave(bigint, bigint) to authenticated;
