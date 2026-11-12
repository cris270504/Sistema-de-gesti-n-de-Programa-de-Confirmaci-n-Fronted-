# ⛪ Sistema de Gestión del Programa de Confirmación — Frontend

Aplicación web (PWA) para coordinar el Programa de Confirmación de una parroquia: inscripción de confirmandos, grupos, asistencia a reuniones, justificaciones, requisitos sacramentales y comunicación con apoderados.

> El backend (Supabase: esquema, políticas RLS y Edge Functions) se mantiene en un repositorio privado.
<!-- > 🔗 Demo: https://TU-URL.vercel.app -->

<!-- Agrega 2–3 capturas: docs/screenshots/dashboard.png, asistencias.png, movil.png -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

## ✨ Funcionalidades

- **Dashboard** con indicadores y gráficos de asistencia
- **Confirmandos y apoderados**: registro, búsqueda e importación desde Excel
- **Grupos**: creación y distribución automática de confirmandos
- **Asistencias y justificaciones** por reunión
- **Cronograma** de reuniones con calendario (día / semana / lista)
- **Sacramentos y requisitos** por confirmando
- **Cumpleaños** del mes
- **Usuarios, roles y permisos** (catequistas, coordinadores, administrador)
- **Reportes** exportables a PDF, Excel y Word
- **Multi-parroquia**: cada parroquia con sus datos aislados, configuración y marca propias
- Diseño **responsive / mobile-first** e instalable como PWA

## 🛠️ Tecnologías

| Capa | Herramientas |
|---|---|
| Framework | Vue 3 (Composition API), Vite, Vue Router, Pinia, vite-plugin-pwa |
| UI | Tailwind CSS, Bootstrap, Lucide, SweetAlert2 |
| Calendario | FullCalendar |
| Reportes | jsPDF + AutoTable, ExcelJS, docx |
| Backend | Supabase (Postgres + RLS, Auth, Edge Functions, Storage) |
| Despliegue | Vercel (Speed Insights), PWA |

## ▶️ Ejecutar en local

```bash
git clone https://github.com/cris270504/Sistema-de-gesti-n-de-Programa-de-Confirmaci-n-Fronted-.git
cd Sistema-de-gesti-n-de-Programa-de-Confirmaci-n-Fronted-
npm install
cp .env.example .env   # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de tu proyecto
npm run dev
```

## 🔐 Inicio con huella (passkeys)

Método opcional además de DNI/correo + contraseña. Usa la huella, el rostro o el
PIN del dispositivo (WebAuthn, vía Supabase Auth). Está apagado por defecto.

1. **Supabase → Authentication → Passkeys**: activar *Enable Passkey authentication*.
   - *Relying Party ID*: el dominio de producción, sin `https://` (p. ej. `miapp.vercel.app`).
   - *Relying Party Origins*: la URL completa de producción (p. ej. `https://miapp.vercel.app`).
2. **Vercel → Environment Variables**: `VITE_PASSKEYS=true` y volver a desplegar.

Notas:
- Un passkey queda atado al dominio: los registrados en producción no sirven en
  `localhost` ni en otro dominio. Cambiar el *Relying Party ID* invalida todos.
- Si el botón aparece pero Supabase no está configurado, el usuario ve
  "El inicio con huella todavía no está habilitado".
- Cada usuario la activa al entrar con contraseña (se ofrece una vez por
  dispositivo) o en **Mi perfil → Inicio con huella**, donde también puede quitarla.

## 👤 Autor

**Cristopher Carrasco** — [@cris270504](https://github.com/cris270504)
