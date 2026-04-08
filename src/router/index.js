import { createRouter, createWebHistory } from 'vue-router'
import { LS_TOKEN_KEY, LS_USER_KEY } from '@/constants/auth'
import { useAuthStore } from '@/stores/auth'
import { showAlerta } from '@/funciones'

import Login from '../views/Auth/Login.vue'
import DefaultLayout from '../components/DefaultLayout.vue'
import ListarUsuarios from '../views/Users/ListUsers.vue'
import Roles from '../views/Auth/Roles.vue'
import Profile from '../views/Profile/profile.vue'
import ListConfirmandos from '../views/Confirmandos/ListConfirmandos.vue'
import ListGrupos from '../views/Grupos/ListGrupos.vue'
import AsignacionGrupo from '../views/Grupos/AsignacionGrupo.vue'
import Dashboard from '../views/Dashboard.vue'
import ListCronograma from '../views/Cronograma/ListCronograma.vue'
import ListSacramentos from '../views/Sacramentos/ListSacramentos.vue'
import ListRequisitos from '../views/Requisitos/ListRequisitos.vue'
import Listcumpleanos from '../views/Cumpleanos/listCumpleanos.vue'

function hasSession() {
  const token = localStorage.getItem(LS_TOKEN_KEY)
  const user = localStorage.getItem(LS_USER_KEY)
  return !!token && !!user
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

        {
          path: '/cronograma/create',
          name: 'createReunion',
          component: Roles,
          meta: { title: 'Crear reunión', permission: 'crear cronograma' }
        },
        {
          path: '/cronograma/:id/edit',
          name: 'editReunion',
          component: Roles,
          meta: { title: 'Editar reunión', permission: 'editar cronograma' }
        },

        //ASISTENCIAS
        {
          path: '/asistencias/confirmandos',
          name: 'asistencias-confirmandos',
          component: () => import('../views/Asistencias/ListAsistencias.vue'),
          props: { defaultTipo: 'Confirmandos' },
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
          meta: { title: 'Asistencia Apoderados', permission: 'ver asistencias' }
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
  if (onlyGuests && logged) {
    return { name: 'home' };
  }

  const requiredPerms = to.meta?.permission;

  if (requiredPerms) {
    const permsArray = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    const hasAllPermissions = permsArray.every(p => auth.user?.permissions?.includes(p));

    if (!hasAllPermissions) {
      showAlerta('No tiene permisos suficientes para esta sección', 'error');
      return { name: 'home' }; // O una página 403
    }
  }
})

router.afterEach((to) => {
  const nearestWithTitle = [...to.matched].reverse().find(r => r.meta?.title)
  document.title = nearestWithTitle?.meta?.title || 'Cristopher´s App'
})

export default router