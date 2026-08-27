// Base URL de la API: en desarrollo usa el proxy de Vite (/api), en producción usa
// VITE_API_URL si está seteada (con fallback al valor conocido de Render por si falta
// en algún entorno de despliegue). Centralizado acá para que lib/api.js y el logger de
// errores (composables/useErrorLogger.js) usen exactamente la misma URL sin duplicarla.
export const API_BASE_URL = import.meta.env.MODE === 'production'
  ? (import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api`
      : 'https://sistema-de-gestion-de-programa-de.onrender.com/api')
  : '/api';
