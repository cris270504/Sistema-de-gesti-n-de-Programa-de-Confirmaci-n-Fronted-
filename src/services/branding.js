import { errorLegible } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

// Logo de la parroquia en el Storage de Supabase (bucket público `branding`).
//
// Dos ranuras:
//   - slot 'proveedor'  → lo pone el proveedor al crear/editar la parroquia (base)
//   - slot 'parroquia'  → lo pone el admin de la parroquia (override)
// El logo efectivo = logo_url → logo_url_proveedor → default (ver store).
//
// La subida del archivo la gatea la RLS de storage.objects; la URL resultante se
// persiste con fn_branding_logo_set, que revalida quién puede tocar cada ranura.

const BUCKET = 'branding'
const MIME_OK = ['image/png', 'image/jpeg', 'image/webp']
const MAX_ENTRADA = 5 * 1024 * 1024 // 5 MB antes de procesar
const MAX_SALIDA = 512 * 1024 // límite del bucket
const LADO_MAX = 512

// Normaliza la imagen en el navegador: la encuadra en un cuadrado (contain, fondo
// transparente) y la exporta como WebP. Así el logo se ve consistente en el
// sidebar y pesa poco (CLAUDE.md §2: formatos de nueva generación).
export async function procesarLogo(file) {
  if (!file) throw new Error('No se eligió ninguna imagen.')
  if (!MIME_OK.includes(file.type)) {
    throw new Error('Formato no admitido. Usa PNG, JPG o WebP (no SVG ni GIF).')
  }
  if (file.size > MAX_ENTRADA) throw new Error('La imagen supera los 5 MB.')

  const bitmap = await createImageBitmap(file)
  const lado = Math.min(LADO_MAX, Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  const escala = Math.min(lado / bitmap.width, lado / bitmap.height)
  const w = bitmap.width * escala
  const h = bitmap.height * escala
  ctx.drawImage(bitmap, (lado - w) / 2, (lado - h) / 2, w, h)
  bitmap.close?.()

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.85))
  if (!blob) throw new Error('No se pudo procesar la imagen.')
  if (blob.size > MAX_SALIDA) throw new Error('La imagen procesada sigue siendo muy pesada.')
  return blob
}

function rutaDesdeUrl(url) {
  if (!url) return null
  const m = String(url).match(/\/object\/public\/branding\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

// Sube el logo a la ranura indicada y persiste la URL. Devuelve { url, branding }.
export async function subirLogo({ parroquiaId, slot, file, urlAnterior = null }) {
  const blob = await procesarLogo(file)
  const path = `${parroquiaId}/${slot}-${Date.now()}.webp`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) throw new Error(upErr.message)

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  const { data, error } = await supabase.rpc('fn_branding_logo_set', {
    p_parroquia_id: Number(parroquiaId),
    p_slot: slot,
    p_url: url,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw errorLegible(error)
  }

  const prev = rutaDesdeUrl(urlAnterior)
  if (prev && prev !== path) {
    await supabase.storage.from(BUCKET).remove([prev]).catch(() => {})
  }
  return { url, branding: data?.branding ?? null }
}

// Limpia una ranura (el admin vuelve al logo del proveedor; el proveedor lo quita).
export async function quitarLogo({ parroquiaId, slot, urlAnterior = null }) {
  const { data, error } = await supabase.rpc('fn_branding_logo_set', {
    p_parroquia_id: Number(parroquiaId),
    p_slot: slot,
    p_url: null,
  })
  if (error) throw errorLegible(error)

  const prev = rutaDesdeUrl(urlAnterior)
  if (prev) await supabase.storage.from(BUCKET).remove([prev]).catch(() => {})
  return { branding: data?.branding ?? null }
}
