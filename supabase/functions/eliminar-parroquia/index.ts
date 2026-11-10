// Edge Function `eliminar-parroquia` (solo proveedor)
//
// Borra una parroquia DESACTIVADA con todo su contenido. La BD (transacción)
// la hace fn_proveedor_eliminar_parroquia, que solo ejecuta `service_role` y
// vuelve a verificar que quien llama sea proveedor. Después, aquí:
//   - se borran los auth.users de sus usuarios (devueltos por la RPC),
//   - se borran sus logos del bucket `branding` (carpeta <parroquia_id>/).
// Si algo de esto último falla, la parroquia ya está borrada: se informa como
// aviso, no como error.
//
// Body: { id: number, confirmacion: string }  (confirmacion = nombre de la parroquia)

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCors, origenBloqueado } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function mapDbError(error: { code?: string; message?: string }): { message: string; status: number } {
  const msg = error.message ?? "Error";
  if (error.code === "42501") return { message: msg || "No autorizado.", status: 403 };
  if (error.code === "P0002") return { message: msg || "No encontrado.", status: 404 };
  if (error.code === "23514" || error.code === "P0001") return { message: msg, status: 422 };
  if (error.code === "23503") return { message: "No se pudo borrar: quedan datos que dependen de la parroquia.", status: 409 };
  return { message: "No se pudo eliminar la parroquia.", status: 400 };
}

Deno.serve(async (req) => {
  const CORS = buildCors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (origenBloqueado(req)) return json({ message: "Origen no permitido." }, 403);
  if (req.method !== "POST") return json({ message: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ message: "No autenticado." }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ message: "Sesión no válida." }, 401);
  const actorAuthId = userData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ message: "Cuerpo inválido." }, 400);
  }
  const id = Number(body.id);
  const confirmacion = String(body.confirmacion ?? "").slice(0, 200);
  if (!Number.isInteger(id) || id <= 0) return json({ message: "id inválido." }, 400);
  if (!confirmacion.trim()) return json({ message: "Escribe el nombre de la parroquia para confirmar." }, 422);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: res, error: rpcErr } = await admin.rpc("fn_proveedor_eliminar_parroquia", {
      p_actor_auth: actorAuthId,
      p_id: id,
      p_confirmacion: confirmacion,
    });
    if (rpcErr) {
      const { message, status } = mapDbError(rpcErr);
      if (status === 400) console.error("eliminar-parroquia rpc", rpcErr);
      return json({ message }, status);
    }

    const r = res as { nombre: string; auth_ids: string[]; resumen: Record<string, number> };
    const avisos: string[] = [];

    let fallidas = 0;
    for (const authId of r.auth_ids ?? []) {
      const { error } = await admin.auth.admin.deleteUser(authId);
      if (error) fallidas++;
    }
    if (fallidas) avisos.push(`${fallidas} cuenta(s) de acceso no se pudieron borrar; ya no tienen parroquia y no pueden entrar.`);

    const { data: logos, error: listErr } = await admin.storage.from("branding").list(String(id), { limit: 100 });
    if (listErr) {
      avisos.push("No se pudieron revisar los logos de la parroquia.");
    } else if (logos?.length) {
      const { error: rmErr } = await admin.storage.from("branding").remove(logos.map((f) => `${id}/${f.name}`));
      if (rmErr) avisos.push("No se pudieron borrar los logos de la parroquia.");
    }

    return json({ message: `Parroquia «${r.nombre}» eliminada.`, resumen: r.resumen, avisos });
  } catch (e) {
    console.error("eliminar-parroquia error", e);
    return json({ message: "Error del servidor." }, 500);
  }
});
