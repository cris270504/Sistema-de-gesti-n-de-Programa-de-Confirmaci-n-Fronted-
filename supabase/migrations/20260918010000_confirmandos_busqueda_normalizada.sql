-- =====================================================================
-- La lista de confirmandos pasa de traer la tabla completa (crece sin
-- límite, ~458 kB en una sola respuesta hoy) a paginación server-side
-- con búsqueda por nombre en el WHERE. El filtro actual en el cliente
-- (ListConfirmandos.vue) ignora tildes/mayúsculas antes de comparar; un
-- simple `.ilike()` en Postgres NO ignora tildes por sí solo, así que se
-- agrega una columna generada normalizada (sin tildes, en minúsculas) +
-- índice de trigramas — mismo patrón que ya se usó para apoderados en
-- 20260917000000_trgm_apoderados.sql.
--
-- unaccent() con el diccionario resuelto en tiempo de ejecución es
-- STABLE, no IMMUTABLE, y Postgres rechaza una columna GENERATED STORED
-- con una expresión no inmutable ("generation expression is not
-- immutable"). Se fija el diccionario como literal ('unaccent') dentro
-- de una función propia marcada IMMUTABLE — es el workaround estándar y
-- documentado para este caso (el resultado es determinista una vez que
-- el diccionario queda fijo).
-- =====================================================================

create extension if not exists unaccent;

create or replace function public.f_unaccent(text)
returns text
language sql
immutable
strict
as $$
  select unaccent('unaccent', $1)
$$;

alter table public.confirmandos
  add column if not exists nombre_busqueda text
  generated always as (
    public.f_unaccent(lower(nombres || ' ' || apellidos))
  ) stored;

create index if not exists idx_confirmandos_nombre_busqueda_trgm
  on public.confirmandos using gin (nombre_busqueda gin_trgm_ops);

-- El frontend debe normalizar el término de búsqueda con la misma regla
-- (minúsculas + sin tildes) antes de mandarlo en el ILIKE, para que
-- ambos lados de la comparación queden en la misma forma normalizada.
