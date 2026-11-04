# ⛪ Sistema de Gestión del Programa de Confirmación — Frontend

Aplicación web (PWA) para coordinar el Programa de Confirmación de una parroquia: inscripción de confirmandos, grupos, asistencia a reuniones, justificaciones, requisitos sacramentales y comunicación con apoderados.

> Backend (API REST): [Sistema-de-gestion-de-Programa-de-Confirmacion---Backend](https://github.com/cris270504/Sistema-de-gestion-de-Programa-de-Confirmacion---Backend)
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
- **Reportes** exportables a PDF y Excel
- Diseño **responsive / mobile-first** e instalable como PWA

## 🛠️ Tecnologías

| Capa | Herramientas |
|---|---|
| Framework | Vue 3 (Composition API), Vite, Vue Router, Pinia, vite-plugin-pwa |
| UI | Tailwind CSS, Reka UI, Lucide, TanStack Table, SweetAlert2 |
| Gráficos y calendario | Chart.js, ApexCharts, FullCalendar |
| Reportes | jsPDF + AutoTable, ExcelJS |
| Integración | Axios (API Laravel), Supabase JS |
| Despliegue | Vercel (Speed Insights), PWA |

## ▶️ Ejecutar en local

```bash
git clone https://github.com/cris270504/Sistema-de-gesti-n-de-Programa-de-Confirmaci-n-Fronted-.git
cd Sistema-de-gesti-n-de-Programa-de-Confirmaci-n-Fronted-
npm install
cp .env.example .env   # configura la URL de la API
npm run dev
```

## 👤 Autor

**Cristopher Carrasco** — [@cris270504](https://github.com/cris270504)
