-- =====================================================================
-- buscarApoderados() usa ilike '%termino%' (wildcard a ambos lados) contra
-- apoderados.nombres/apellidos -- un índice b-tree normal no sirve para
-- eso. Con pg_trgm, un índice GIN de trigramas sí acelera ILIKE con
-- wildcard en cualquier posición. Hoy con poco volumen no se nota; es
-- barato agregarlo ahora antes de que sea necesario.
-- =====================================================================

create extension if not exists pg_trgm;

create index if not exists idx_apoderados_nombres_trgm
    on public.apoderados using gin (nombres gin_trgm_ops);

create index if not exists idx_apoderados_apellidos_trgm
    on public.apoderados using gin (apellidos gin_trgm_ops);
