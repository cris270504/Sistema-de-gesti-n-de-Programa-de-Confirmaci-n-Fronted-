-- =====================================================================
-- Modo mantenimiento con alcance: todas las parroquias, o solo algunas.
-- =====================================================================
-- Antes system_status era binario (todas o ninguna). Se agrega `alcance`
-- ('todas' | 'parroquias') y `parroquia_ids` (bigint[], usado solo cuando
-- alcance='parroquias'). Sigue siendo una fila singleton: un solo estado de
-- mantenimiento activo a la vez, pero ahora con un scope configurable.
-- =====================================================================

alter table public.system_status
    add column if not exists alcance text not null default 'todas',
    add column if not exists parroquia_ids bigint[] not null default '{}';

alter table public.system_status
    drop constraint if exists system_status_alcance_check;

alter table public.system_status
    add constraint system_status_alcance_check
    check (alcance in ('todas', 'parroquias'));
