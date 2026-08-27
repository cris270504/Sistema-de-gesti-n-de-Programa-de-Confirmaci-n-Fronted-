import { createRouter, createWebHistory } from 'vue-router'
import { LS_TOKEN_KEY, LS_USER_KEY } from '@/constants/auth'
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
const ListSacramentos = () => import('../views/Sacramentos/ListSacramentos.vue')
const ListRequisitos = () => import('../views/Requisitos/ListRequisitos.vue')
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
          meta: { title: 'Cronograma', permission: ['ver cronograma'] }
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

        //SACRAMENTOS
        {
          path: '/sacramentos',
          name: 'sacramentos',
          component: ListSacramentos,
          meta: { title: 'Lista de sacramentos', permission: 'ver todos los sacramentos' }
        },

        //cumpleanos
        {
          path: '/cumpleanos',
          name: 'cumpleanos',
          component: Listcumpleanos,
          meta: { title: 'Lista de cumpleanos' }
        },
        //REQUISITOS
        {
          path: '/requisitos',
          name: 'requisitos',
          component: ListRequisitos,
          meta: { title: 'Lista de requisitos', permission: 'ver todos los requisitos' }
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

router.beforeEach((to) => {
  const logged = hasSession();
  const needsAuth = to.matched.some(r => r.meta?.authenticated);
  const onlyGuests = to.matched.some(r => r.meta?.guest);
  const auth = useAuthStore();

  if (needsAuth && !logged) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // El proveedor de la plataforma opera el panel de parroquias, no el Dashboard
  // de una parroquia. (Cuentas separadas: super-admin de parroquia vs proveedor.)
  const esProveedor = auth.user?.roles?.includes('proveedor');
  if (logged && esProveedor && (to.name === 'dashboard' || onlyGuests)) {
    return { name: 'parroquias' };
  }

  if (onlyGuests && logged) {
    return { name: 'dashboard' };
  }

  const requiredPerms = to.meta?.permission;

  if (requiredPerms) {
    const permsArray = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    const hasAllPermissions = permsArray.every(p => auth.user?.permissions?.includes(p));

    if (!hasAllPermissions) {
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