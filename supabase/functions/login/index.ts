// Edge Function `login`: inicio de sesión con DNI o correo, del lado del servidor.
//
// Reemplaza a `resolver-login`, que devolvía al navegador el email real de
// cualquier DNI (enumeración DNI → email con la anon key pública).
//
// Flujo:
//   1. Límite de intentos por identificador (8 fallos/15 min) y por IP
//      (30 fallos/15 min). Las claves se guardan hasheadas.
//   2. Resuelve DNI/correo → email canónico (fn_login_resolver, solo service_role).
//   3. signInWithPassword aquí mismo. Si el usuario no existe se intenta igual
//      con un email inválido, para que la respuesta tarde lo mismo.
//   4. Solo con la contraseña correcta se informa "parroquia desactivada".
//   5. Devuelve { access_token, refresh_token }; el email nunca sale.
//
// Respuestas de error (el frontend las traduce):
//   401 { error: 'credenciales' }       DNI/correo o contraseña incorrectos
//   403 { error: 'parroquia_inactiva' } credenciales OK, parroquia desactivada
//   429 { error: 'demasiados_intentos', retry_after }
//   400 { error: 'bad_request' } · 500 { error: 'server_error' }
//
// OJO: todas las llamadas a Supabase Auth salen desde la IP de la Edge Function,
// así que el rate limit de Auth "sign-ins por IP" (Dashboard → Auth → Rate
// Limits) aplica a TODOS los usuarios juntos. Subirlo si crecen los clientes.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCors, origenBloqueado } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function ipCliente(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "desconocida";
}

Deno.serve(async (req) => {
  const CORS = buildCors(req);
  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (origenBloqueado(req)) return json({ error: "origin_not_allowed" }, 403);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let login: unknown, password: unknown;
  try {
    ({ login, password } = await req.json());
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (typeof login !== "string" || typeof password !== "string"
      || !login.trim() || login.length > 150 || !password || password.length > 200) {
    return json({ error: "bad_request" }, 400);
  }

  const identificador = login.trim().toLowerCase();
  const claves = [
    `id:${await sha256(identificador)}`,
    `ip:${await sha256(ipCliente(req))}`,
  ];

  try {
    // 1) ¿Bloqueado por demasiados intentos?
    const { data: espera, error: eBloq } = await admin.rpc("fn_login_bloqueo", { p_claves: claves });
    if (eBloq) throw eBloq;
    if (Number(espera) > 0) {
      return json({ error: "demasiados_intentos", retry_after: Number(espera) }, 429,
        { "Retry-After": String(espera) });
    }

    // 2) Resolver identificador → email.
    const { data: filas, error: eRes } = await admin.rpc("fn_login_resolver", { p_login: identificador });
    if (eRes) throw eRes;
    const usuario = Array.isArray(filas) ? filas[0] : null;
    const email = usuario?.email ?? `no-existe-${claves[0].slice(3, 19)}@unknown.invalid`;

    // 3) Autenticar (cliente efímero: la sesión no se comparte entre requests).
    const auth = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sesion, error: eLogin } = await auth.auth.signInWithPassword({ email, password });

    if (eLogin || !sesion?.session || !usuario) {
      // Rate limit del propio Supabase Auth: no es culpa de la contraseña.
      if (eLogin?.status === 429) {
        return json({ error: "demasiados_intentos", retry_after: 60 }, 429, { "Retry-After": "60" });
      }
      if (eLogin && (eLogin.status ?? 0) >= 500) throw eLogin;
      await admin.rpc("fn_login_registrar", { p_claves: claves, p_exito: false });
      return json({ error: "credenciales" }, 401);
    }

    // 4) Credenciales correctas pero parroquia desactivada → no se entrega la sesión.
    if (usuario.parroquia_activa === false) {
      // scope 'local': revoca solo esta sesión recién creada, no las de otros dispositivos.
      await auth.auth.signOut({ scope: "local" }).catch(() => {});
      return json({ error: "parroquia_inactiva" }, 403);
    }

    await admin.rpc("fn_login_registrar", { p_claves: claves, p_exito: true });
    return json({
      access_token: sesion.session.access_token,
      refresh_token: sesion.session.refresh_token,
    });
  } catch (e) {
    console.error("login error", e);
    return json({ error: "server_error" }, 500);
  }
});
