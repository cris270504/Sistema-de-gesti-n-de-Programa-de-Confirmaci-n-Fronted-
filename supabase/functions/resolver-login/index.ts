// `resolver-login` RETIRADA (2026-11-08).
//
// Devolvía al navegador el email real de cualquier DNI (enumeración DNI → email
// con la anon key pública). La reemplaza la Edge Function `login`, que
// autentica del lado del servidor sin exponer el email.
//
// Se deja desplegada respondiendo 410 para que una PWA vieja (sin actualizar)
// reciba un error claro en vez de un 404; no consulta la base de datos.

import { buildCors } from "../_shared/cors.ts";

Deno.serve((req) => {
  const CORS = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(
    JSON.stringify({ error: "actualiza_la_app", message: "Actualiza la aplicación para iniciar sesión." }),
    { status: 410, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
