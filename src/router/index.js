import { createRouter, createWebHistory } from 'vue-router'
import { LS_TOKEN_KEY, LS_USER_KEY, LS_PARROQUIA_KEY } from '@/constants/auth'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

import DefaultLayout from '../components/DefaultLayout.vue'
import { isTokenExpired } from '@/funciones'

// Lazy loading: cada vista se descarga en su propio chunk solo cuando se visita la ruta
const NotFound = () => import('../views/NotFound.vue')
const Forbidden = () => import('../views/Forbidden.vue')
const Login = () => import('../views/Auth/Login.vue')
const ListarUsuarios = () => import('../views/Users/ListUsers.vue')
const Roles = () => import('../views/Auth/Roles.vue')
const Profile = () => import('../views/Profile/profile.vue')
const ListConfirmandos = () => import('../views/Confirmandos/ListConfirmandos.vue')
const ListGrupos = () => import('../views/Grupos/ListGrupos.vue')
const AsignacionGrupo = () => import('../views/Grupos/AsignacionGrupo.vue')
const Dashboard = () => import('../views/Dashboard.vue')
const ListCronograma = () => import('../views/Cronograma/ListCronograma.vue')
const RutaSacramental = () => import('../views/Sacramentos/RutaSacramental.vue')
const Listcumpleanos = () => import('../views/Cumpleanos/listCumpleanos.vue')
const ListJustificaciones = () => import('../views/Justificaciones/ListJustificaciones.vue')
const Configuracion = () => import('../views/Configuracion/Configuracion.vue')
const ProveedorParroquias = () => import('../views/Proveedor/ListParroquias.vue')

function hasSession() {
  const token = localStorage.getItem(LS_TOKEN_KEY)
  const user = localStorage.getItem(LS_USER_KEY)
  if (!token || !user) return false
  if (isTokenExpired(token)) {
    localStorage.removeItem(LS_TOKEN_KEY)
    localStorage.removeItem(LS_USER_KEY)
    return false
  }
  return true
}

// No tiene sentido volver a /403 o /login después de loguearse: si esa ruta queda
// pegada en ?redirect, cada login vuelve a caer ahí. La descartamos.
export function rutaRedirectSegura(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return null
  if (fullPath === '/403' || fullPath.startsWith('/login') || fullPath === '/') return null
  return fullPath
}

// Los permisos se refrescan desde el backend como mucho una vez antes de bloquear
// con /403 (por si el localStorage traía permisos viejos).
let permisosYaRefrescados = false

// Módulos que la parroquia ocultó (Configuración → Módulos del menú). Se lee de
// localStorage directo para no acoplar el router al store de parroquia.
function modulosOcultos() {
  try {
    const ocultos = JSON.parse(localStorage.getItem(LS_PARROQUIA_KEY))?.configuracion?.ui?.modulos_ocultos
    return Array.isArray(ocultos) ? ocultos : []
  } catch { return [] }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      meta: { authenticated: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: Dashboard,
          meta: { title: 'Dashboard' }
        },
        {
          path: '/users',
          name: 'users',
          component: ListarUsuarios,
          meta: { title: 'Listado de usuarios', permission: 'ver usuarios' }
        },
        {
          path: '/profile',
          name: 'profile',
          component: Profile,
          meta: { title: 'Mi perfil', permission: ['ver dashboard'] }
        },

        //CONFIRMANDOS
        {
          path: '/confirmandos',
          name: 'confirmandos',
          component: ListConfirmandos,
          meta: { title: 'Listado de confirmandos', permission: ['ver todos los confirmandos'] }
        },

        //GRUPOS
        {
          path: '/grupos',
          name: 'grupos',
          component: ListGrupos,
          meta: { title: 'Listado de grupos', permission: ['ver todos los grupos'] }
        },

        {
          path: '/miGrupo/:id',
          name: 'miGrupo',
          component: AsignacionGrupo,
          props: true,
          meta: { title: 'Mi Grupo', permission: ['ver grupos', 'ver confirmandos'] }
        },

        {
          path: '/grupos/:id/asignacion',
          name: 'gruposAsignacion',
          component: AsignacionGrupo,
          props: true,
          meta: { title: 'Gestión de grupo', permission: ['editar grupos', 'asignar catequista',] }
        },

        //CRONOGRAMA
        {
          path: '/cronograma',
          name: 'cronograma',
          component: ListCronograma,
          meta: { title: 'Cronograma', permission: ['ver cronograma'], modulo: 'cronograma' }
        },

        //ASISTENCIAS
        {
          path: '/asistencias/confirmandos/:id?',
          name: 'asistencias-confirmandos',
          component: () => import('../views/Asistencias/ListAsistencias.vue'),
          props: route => ({
            defaultTipo: 'Confirmandos',
            id: route.params.id
          }),
          meta: { title: 'Asistencia Confirmandos', permission: 'ver asistencias' }
        },
        {
          path: '/asistencias/catequistas',
          name: 'asistencias-catequistas',
          component: () => import('../views/Asistencias/ListAsistencias.vue'),
          props: { defaultTipo: 'Catequistas' },
          meta: { title: 'Asistencia Catequistas', permission: 'ver todas las asistencias' }
        },
        {
          path: '/asistencias/apoderados',
          name: 'asistencias-apoderados',
          component: () => import('../views/Asistencias/ListAsistencias.vue'),
          props: { defaultTipo: 'Apoderados' },
          meta: { title: 'Asistencia Apoderados', permission: 'ver todas las asistencias' }
        },

        //JUSTIFICACIONES
        {
          path: '/justificaciones',
          name: 'justificaciones',
          component: ListJustificaciones,
          meta: { title: 'Justificaciones', permission: 'ver asistencias' }
        },

        //RUTA SACRAMENTAL (sacramentos + requisitos en una matriz)
        {
          path: '/sacramentos',
          name: 'sacramentos',
          component: RutaSacramental,
          meta: { title: 'Ruta sacramental', permission: 'ver todos los sacramentos', modulo: 'sacramentos' }
        },
        // /requisitos quedó fusionado en /sacramentos (matriz). Enlaces viejos → ahí.
        {
          path: '/requisitos',
          redirect: { name: 'sacramentos' },
        },

        //cumpleanos
        {
          path: '/cumpleanos',
          name: 'cumpleanos',
          component: Listcumpleanos,
          meta: { title: 'Lista de cumpleanos', modulo: 'cumpleanos' }
        },

        //ROLES
        {
          path: '/auth/roles',
          name: 'roles',
          component: Roles,
          meta: { title: 'Lista de roles', permission: 'ver roles' }
        },

        //CONFIGURACIÓN DE LA PARROQUIA
        {
          path: '/configuracion',
          name: 'configuracion',
          component: Configuracion,
          meta: { title: 'Configuración', permission: 'administrar parroquia' }
        },

        //PROVEEDOR (plataforma)
        {
          path: '/parroquias',
          name: 'parroquias',
          component: ProveedorParroquias,
          meta: { title: 'Parroquias', permission: 'administrar plataforma' }
        },

        {
          path: '/403',
          name: 'forbidden',
          component: Forbidden,
          meta: { title: 'Acceso denegado' }
        },

        {
          path: '/:pathMatch(.*)*',
          name: 'NotFound',
          component: NotFound,
          meta: { requiresLayout: false }
        }
      ],
    },
    // Público
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { guest: true, title: 'Login' }
    },
  ],
})

// Prefetch del chunk de una vista (se llama al hacer hover sobre su enlace en el
// menú): cuando el usuario hace clic, el módulo ya está en caché y la navegación es
// instantánea. Silencioso: si el import falla, onError/afterEach lo manejan al navegar.
const rutasYaPrefetcheadas = new Set()
export function prefetchRoute(name) {
  if (!name || rutasYaPrefetcheadas.has(name)) return
  rutasYaPrefetcheadas.add(name)
  const record = router.getRoutes().find(r => r.name === name)
  const loader = record?.components?.default
  if (typeof loader === 'function') {
    Promise.resolve(loader()).catch(() => rutasYaPrefetcheadas.delete(name))
  }
}

router.beforeEach(async (to) => {
  const logged = hasSession();
  const needsAuth = to.matched.some(r => r.meta?.authenticated);
  const onlyGuests = to.matched.some(r => r.meta?.guest);
  const auth = useAuthStore();

  if (needsAuth && !logged) {
    const redirect = rutaRedirectSegura(to.fullPath);
    return { name: 'login', query: redirect ? { redirect } : {} };
  }

  // Revalida la sesión al navegar (throttle 30s): si el proveedor desactivó la
  // parroquia, refrescarUsuario cierra sesión con aviso. Fire-and-forget para no
  // frenar la navegación; el logout se encarga de redirigir al login.
  if (logged && !onlyGuests) auth.refrescarUsuario();

  // El proveedor de la plataforma opera el panel de parroquias, no el Dashboard
  // de una parroquia. (Cuentas separadas: super-admin de parroquia vs proveedor.)
  const esProveedor = auth.user?.roles?.includes('proveedor');
  if (logged && esProveedor && (to.name === 'dashboard' || onlyGuests)) {
    return { name: 'parroquias' };
  }

  if (onlyGuests && logged) {
    return { name: 'dashboard' };
  }

  // Módulo desactivado por la parroquia en Configuración. Cosmético (los permisos
  // siguen mandando): un enlace guardado o escrito a mano cae al Dashboard.
  if (logged && to.meta?.modulo && modulosOcultos().includes(to.meta.modulo)) {
    return { name: 'dashboard' };
  }

  // El proveedor puede entrar a cualquier vista (en el backend hay un Gate::before
  // que le concede todo). Sin esto, un /parroquias con permisos viejos lo mandaba a /403.
  if (logged && esProveedor) {
    return;
  }

  const requiredPerms = to.meta?.permission;

  if (requiredPerms && logged) {
    const permsArray = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    let ok = permsArray.every(p => auth.user?.permissions?.includes(p));

    // Los permisos guardados pueden estar desfasados (cambió un rol, migración nueva…).
    // Antes de mandar a /403, refrescamos una vez desde el backend y reevaluamos.
    if (!ok && !permisosYaRefrescados) {
      permisosYaRefrescados = true;
      await auth.refrescarUsuario({ force: true });
      ok = permsArray.every(p => auth.user?.permissions?.includes(p));
    }

    if (!ok) {
      return { name: 'forbidden' };
    }
  }
})

// Tras un deploy, el index.html cacheado del usuario puede apuntar a chunks de la
// build anterior que ya no existen (404). Vue Router emite un error al cargar el
// módulo dinámico de la vista: lo detectamos y recargamos la app una sola vez para
// tomar el index.html nuevo. sessionStorage evita un bucle si el fallo es real.
router.onError((error, to) => {
  const patrones = [
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'error loading dynamically imported module',
    'Unable to preload CSS',
  ]
  const esChunkObsoleto = patrones.some(p => (error?.message || '').includes(p))
  if (!esChunkObsoleto) return

  const destino = to?.fullPath || window.location.pathname + window.location.search
  const clave = 'reload-chunk:' + destino
  if (!sessionStorage.getItem(clave)) {
    sessionStorage.setItem(clave, '1')
    window.location.assign(destino)
  }
})

router.afterEach((to) => {
  // Red de seguridad: cualquier navegación completada apaga el overlay global.
  useUiStore().hideOverlay()

  // La navegación funcionó: limpiamos la marca de recarga por chunk obsoleto.
  try { sessionStorage.removeItem('reload-chunk:' + to.fullPath) } catch { /* noop */ }

  const nearestWithTitle = [...to.matched].reverse().find(r => r.meta?.title)
  const pagina = nearestWithTitle?.meta?.title
  // Nombre público de la parroquia (branding). Import perezoso para no crear un
  // ciclo store<->router al cargar el módulo.
  let app = 'SGPC'
  try {
    app = JSON.parse(localStorage.getItem('parroquia'))?.configuracion?.branding?.nombre_publico
      || JSON.parse(localStorage.getItem('parroquia'))?.parroquia?.nombre
      || 'SGPC'
  } catch { /* noop */ }
  document.title = pagina ? `${pagina} · ${app}` : app
})

export default router