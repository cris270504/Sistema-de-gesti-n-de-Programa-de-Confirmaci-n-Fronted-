import { createRouter, createWebHistory } from 'vue-router'
import { LS_TOKEN_KEY, LS_USER_KEY } from '@/constants/auth'
import { useAuthStore } from '@/stores/auth'

import DefaultLayout from '../components/DefaultLayout.vue'
import { isTokenExpired } from '@/funciones'

// Lazy loading: cada vista se descarga en su propio chunk solo cuando se visita la ruta
const NotFound = () => import('../views/NotFound.vue')
const Forbidden = () => import('../views/Forbidden.vue')
const Login = () => import('../views/Auth/Login.vue')
const ForgotPassword = () => import('../views/Auth/ForgotPassword.vue')
const ResetPassword = () => import('../views/Auth/ResetPassword.vue')
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
          meta: { title: 'Lista de roles', permission: ['ver roles', 'ver permisos'] }
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
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPassword,
      meta: { guest: true, title: 'Recuperar contraseña' }
    },
    {
      path: '/reset-password/:token',
      name: 'reset-password',
      component: ResetPassword,
      meta: { guest: true, title: 'Nueva contraseña' }
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

router.afterEach((to) => {
  const nearestWithTitle = [...to.matched].reverse().find(r => r.meta?.title)
  document.title = nearestWithTitle?.meta?.title || 'Cristopher´s App'
})

export default router