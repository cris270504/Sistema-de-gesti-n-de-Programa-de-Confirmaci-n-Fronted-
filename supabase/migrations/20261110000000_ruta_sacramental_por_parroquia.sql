-- =====================================================================
-- Ruta sacramental: solo sacramentos de la parroquia del joven
-- =====================================================================
-- Bug: fn_asignar_ruta_sacramental buscaba Bautismo / Primera Comunión /
-- Confirmación solo por `clave`, sin filtrar por parroquia. La llama
-- fn_guardar_confirmando (SECURITY DEFINER, dueño postgres con BYPASSRLS),
-- así que veía los sacramentos de TODAS las parroquias. Desde que existe una
-- segunda parroquia (2026-09-02), cada vez que se guardaba un joven indicando
-- el sacramento que le falta, se le vinculaban también los sacramentos de la
-- otra parroquia y los requisitos de esos sacramentos.
--
-- Esta migración:
--   1) corrige la función (filtra por la parroquia del joven),
--   2) borra los vínculos cruzados que ya existen,
--   3) agrega triggers que impiden vincular un joven con un sacramento o un
--      requisito de otra parroquia, venga de donde venga la escritura,
--   4) quita el EXECUTE directo para authenticated (solo la usa
--      fn_guardar_confirmando, que ya valida permisos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Función corregida
-- ---------------------------------------------------------------------
create or replace function public.fn_asignar_ruta_sacramental(p_confirmando_id bigint, p_sacramento_faltante_id bigint)
 returns void
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    _pid         bigint;
    _clave_falta text;
    _ord_falta   int;
    _sac_ids     bigint[];
    _pend_ids    bigint[];
    _req_ids     bigint[];
BEGIN
    IF p_sacramento_faltante_id IS NULL THEN RETURN; END IF;

    SELECT c.parroquia_id INTO _pid FROM public.confirmandos c WHERE c.id = p_confirmando_id;
    IF _pid IS NULL THEN
        RAISE EXCEPTION 'Confirmando % no encontrado', p_confirmando_id USING ERRCODE = 'no_data_found';
    END IF;

    SELECT array_agg(s.id) INTO _sac_ids
      FROM public.sacramentos s
     WHERE s.parroquia_id = _pid
       AND s.clave IN ('bautismo', 'comunion', 'confirmacion');
    IF _sac_ids IS NULL THEN
        RAISE EXCEPTION 'La parroquia no tiene configurada una ruta sacramental (Bautismo / Primera Comunión / Confirmación)'
            USING ERRCODE = 'no_data_found';
    END IF;

    SELECT s.clave INTO _clave_falta
      FROM public.sacramentos s
     WHERE s.id = p_sacramento_faltante_id
       AND s.parroquia_id = _pid
       AND s.clave IN ('bautismo', 'comunion', 'confirmacion');
    IF _clave_falta IS NULL THEN
        RAISE EXCEPTION 'El sacramento indicado no pertenece a la ruta sacramental de esta parroquia'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    _ord_falta := public._orden_sacramento(_clave_falta);

    SELECT array_agg(s.id) INTO _pend_ids
      FROM public.sacramentos s
     WHERE s.id = ANY(_sac_ids)
       AND public._orden_sacramento(s.clave) >= _ord_falta;

    INSERT INTO public.confirmando_sacramento (confirmando_id, sacramento_id, estado)
    SELECT p_confirmando_id, sid,
           CASE WHEN sid = ANY(_pend_ids) THEN 'pendiente' ELSE 'recibido' END
      FROM unnest(_sac_ids) sid
    ON CONFLICT (confirmando_id, sacramento_id) DO UPDATE SET estado = EXCLUDED.estado;

    -- También limpia vínculos con sacramentos de otra parroquia.
    DELETE FROM public.confirmando_sacramento
     WHERE confirmando_id = p_confirmando_id AND sacramento_id <> ALL(_sac_ids);

    SELECT coalesce(array_agg(DISTINCT sr.requisito_id), '{}') INTO _req_ids
      FROM public.sacramento_requisito sr
      JOIN public.requisitos r ON r.id = sr.requisito_id AND r.parroquia_id = _pid
     WHERE sr.sacramento_id = ANY(_pend_ids);

    INSERT INTO public.confirmando_requisito (confirmando_id, requisito_id, estado)
    SELECT p_confirmando_id, r, 'pendiente' FROM unnest(_req_ids) r
    ON CONFLICT (confirmando_id, requisito_id) DO NOTHING;

    -- Solo se quitan los que están 'pendiente'; los 'entregado' se conservan
    -- como historial aunque la ruta ya no los pida (R2-6).
    DELETE FROM public.confirmando_requisito
     WHERE confirmando_id = p_confirmando_id
       AND estado = 'pendiente'
       AND requisito_id <> ALL(_req_ids);
END;
$function$;

revoke execute on function public.fn_asignar_ruta_sacramental(bigint, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Limpieza de vínculos cruzados ya existentes
--    (2026-11-10: 18 en confirmando_sacramento y 34 en confirmando_requisito,
--     6 jóvenes; todos tienen además sus 3 sacramentos propios).
-- ---------------------------------------------------------------------
delete from public.confirmando_sacramento cs
 using public.sacramentos s, public.confirmandos c
 where s.id = cs.sacramento_id
   and c.id = cs.confirmando_id
   and s.parroquia_id is distinct from c.parroquia_id;

delete from public.confirmando_requisito cr
 using public.requisitos r, public.confirmandos c
 where r.id = cr.requisito_id
   and c.id = cr.confirmando_id
   and r.parroquia_id is distinct from c.parroquia_id;

-- ---------------------------------------------------------------------
-- 3) Guardas: joven y sacramento/requisito de la misma parroquia
-- ---------------------------------------------------------------------
create or replace function public.trg_confirmando_sacramento_misma_parroquia()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.confirmandos c
          JOIN public.sacramentos s ON s.parroquia_id = c.parroquia_id
         WHERE c.id = NEW.confirmando_id AND s.id = NEW.sacramento_id
    ) THEN
        RAISE EXCEPTION 'El sacramento no pertenece a la parroquia del confirmando'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$function$;

drop trigger if exists confirmando_sacramento_misma_parroquia on public.confirmando_sacramento;
create trigger confirmando_sacramento_misma_parroquia
    before insert or update of confirmando_id, sacramento_id on public.confirmando_sacramento
    for each row execute function public.trg_confirmando_sacramento_misma_parroquia();

create or replace function public.trg_confirmando_requisito_misma_parroquia()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.confirmandos c
          JOIN public.requisitos r ON r.parroquia_id = c.parroquia_id
         WHERE c.id = NEW.confirmando_id AND r.id = NEW.requisito_id
    ) THEN
        RAISE EXCEPTION 'El requisito no pertenece a la parroquia del confirmando'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$function$;

drop trigger if exists confirmando_requisito_misma_parroquia on public.confirmando_requisito;
create trigger confirmando_requisito_misma_parroquia
    before insert or update of confirmando_id, requisito_id on public.confirmando_requisito
    for each row execute function public.trg_confirmando_requisito_misma_parroquia();

revoke execute on function public.trg_confirmando_sacramento_misma_parroquia() from public, anon, authenticated;
revoke execute on function public.trg_confirmando_requisito_misma_parroquia() from public, anon, authenticated;
