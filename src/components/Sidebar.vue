<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useGruposStore } from '@/stores/grupos';
import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  UserCircleIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
  FireIcon,
  WalletIcon,
  CakeIcon,
} from '@heroicons/vue/24/outline';
import { Cake, CakeSlice, CalendarIcon } from 'lucide-vue-next';

const authStore = useAuthStore();
const gruposStore = useGruposStore();
const isSidebarOpen = ref(true);
const nombreMiGrupo = ref('Mi Grupo');
const openMenus = ref({});

const toggleMenu = (name) => {
  if (!isSidebarOpen.value) {
    isSidebarOpen.value = true;
    setTimeout(() => { openMenus.value[name] = !openMenus.value[name]; }, 150);
  } else {
    openMenus.value[name] = !openMenus.value[name];
  }
};

onMounted(async () => {
  const grupoId = authStore.user?.grupo_id;
  if (grupoId) {
    let grupo = gruposStore.items?.find(g => g.id === grupoId);

    //Por qué grupo sería falso?
    if (!grupo) {
      try {
        grupo = await gruposStore.fetchById(grupoId);
      } catch (e) { console.error(e); }
    }

    if (grupo) nombreMiGrupo.value = grupo.nombre;
  }
});

const navigationItems = computed(() => {
  const user = authStore.user;

  const items = [
    { name: 'Dashboard', to: { name: 'dashboard' }, icon: HomeIcon },
    { name: 'Confirmandos', to: { name: 'confirmandos' }, icon: UserCircleIcon, permission: 'ver todos los confirmandos'},
    { name: 'Grupos', to: { name: 'grupos' }, icon: UserGroupIcon, permission: 'ver todos los grupos' },
    { name: 'Cronograma', to: { name: 'cronograma' }, icon: CalendarIcon, permission: 'ver cronograma' },
    { name: 'Cumpleaños', to: { name: 'cumpleanos' }, icon: CakeIcon },
    { name: 'Sacramentos', to: { name: 'sacramentos' }, icon: FireIcon, permission: 'ver todos los sacramentos' },
    { name: 'Requisitos', to: { name: 'requisitos' }, icon: WalletIcon, permission: 'ver todos los requisitos' },
    { name: 'Usuarios', to: { name: 'users' }, icon: UsersIcon, permission: 'ver usuarios' },
  ];

  const tieneGrupos = user?.grupo_id || (user?.grupos && user.grupos.length > 0);

  if (authStore.can('ver todas las asistencias')) { //¡No debería ser solo si tiene el permiso?
    items.push({
      name: 'Asistencias',
      icon: ClipboardDocumentIcon,
      permission: 'ver asistencias',
      children: [
        { name: 'Catequistas', to: { name: 'asistencias-catequistas' } },
        { name: 'Confirmandos', to: { name: 'asistencias-confirmandos' } },
        { name: 'Apoderados', to: { name: 'asistencias-apoderados' } },
      ]
    });
  } else {
    items.push({
      name: 'Asistencia', to: { name: 'asistencias-confirmandos' }, icon: ClipboardDocumentIcon,
      
    });
  }
  

  if (user?.grupo_id) {
    items.push({
      name: nombreMiGrupo.value,
      to: { name: 'miGrupo', params: { id: user.grupo_id } },
      icon: UserIcon,
      permission: 'ver grupos'
    });
  }

  return items;
});

const filteredNavigation = computed(() => {
  return navigationItems.value.filter(item => {
    return !item.permission || authStore.can(item.permission);
  });
});

const handleLogout = () => authStore.logout();
const toggleSidebar = () => (isSidebarOpen.value = !isSidebarOpen.value);

defineExpose({ toggleSidebar });
</script>

<template>
  <div :class="[
    'relative flex h-screen flex-col border bg-white/80 backdrop-blur-md transition-all duration-300 ease-in-out',
    isSidebarOpen ? 'w-72 p-4' : 'w-20 p-2'
  ]">
    <div
      :class="['mb-2 flex items-center justify-between border-b pb-4', isSidebarOpen ? 'px-2' : 'px-0 justify-center']">
      <div v-if="isSidebarOpen" class="inline-flex items-center gap-2">
        <img src="@/assets/logo.png" alt="Logo" class="h-13 w-auto" />
        <h5 class="block text-xl font-semibold tracking-tight text-slate-800">
          SGPC
        </h5>
      </div>
      <button @click="toggleSidebar" class="rounded p-2 text-slate-500 hover:bg-slate-100 focus:outline-none">
        <XMarkIcon v-if="isSidebarOpen" class="h-6 w-6" />
        <Bars3Icon v-else class="h-6 w-6" />
      </button>
    </div>

    <nav class="flex flex-col gap-1 text-base flex-grow pt-2 overflow-y-auto custom-scroll">

      <template v-for="item in filteredNavigation" :key="item.name">

        <RouterLink v-if="!item.children" :to="item.to" custom v-slot="{ navigate, href, isActive, isExactActive }">
          <a :href="href" @click="navigate" :title="!isSidebarOpen ? item.name : undefined" class="nav-link group"
            :class="[
              (item.to.name === 'dashboard' ? isExactActive : isActive) ? 'nav-link--active' : 'nav-link--idle',
              !isSidebarOpen ? 'justify-center' : ''
            ]">
            <span class="active-indicator"
              :class="(item.to.name === 'dashboard' ? isExactActive : isActive) ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'"
              aria-hidden="true"></span>

            <div class="grid place-items-center shrink-0" :class="isSidebarOpen ? 'mr-4' : 'mx-auto'">
              <component :is="item.icon" class="h-5 w-5 transition-colors" aria-hidden="true" />
            </div>

            <span v-if="isSidebarOpen" class="truncate font-medium">{{ item.name }}</span>
          </a>
        </RouterLink>

        <div v-else class="flex flex-col">
          <button @click="toggleMenu(item.name)" :title="!isSidebarOpen ? item.name : undefined"
            class="nav-link group w-full nav-link--idle" :class="!isSidebarOpen ? 'justify-center' : ''">
            <div class="grid place-items-center shrink-0" :class="isSidebarOpen ? 'mr-4' : 'mx-auto'">
              <component :is="item.icon" class="h-5 w-5 transition-colors" aria-hidden="true" />
            </div>

            <div v-if="isSidebarOpen" class="flex flex-1 items-center justify-between overflow-hidden">
              <span class="truncate font-medium">{{ item.name }}</span>
              <ChevronDownIcon class="h-4 w-4 text-slate-400 transition-transform duration-200"
                :class="openMenus[item.name] ? 'rotate-180' : ''" />
            </div>
          </button>

          <div v-show="isSidebarOpen && openMenus[item.name]"
            class="flex flex-col gap-1 mt-1 transition-all duration-300">
            <RouterLink v-for="child in item.children" :key="child.name" :to="child.to" custom
              v-slot="{ navigate, href, isActive }">
              <a :href="href" @click="navigate" class="nav-link group child-link"
                :class="isActive ? 'nav-link--active' : 'nav-link--idle'">
                <span class="active-indicator" :class="isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'"
                  aria-hidden="true"></span>

                <span class="truncate font-medium text-sm">{{ child.name }}</span>
              </a>
            </RouterLink>
          </div>
        </div>

      </template>

    </nav>

    <div class="mt-auto border-t pt-3">
      <button @click="handleLogout" class="nav-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        :class="!isSidebarOpen ? 'justify-center' : ''">
        <ArrowLeftOnRectangleIcon class="h-5 w-5 shrink-0" :class="isSidebarOpen ? 'mr-4' : 'mx-auto'" />
        <span v-if="isSidebarOpen">Cerrar sesión</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Estilos base */
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

/* Indentación para los hijos */
.child-link {
  padding-left: 3.5rem;
  /* 1rem (padre) + espacio para alinear con el texto */
}

/* Estados */
.nav-link--idle {
  color: #64748b;
}

.nav-link--idle:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.nav-link--active {
  background-color: #eff6ff;
  color: #1d4ed8;
}

/* Indicador azul a la izquierda */
.active-indicator {
  position: absolute;
  left: 0;
  top: 10%;
  bottom: 10%;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background-color: #2563eb;
  transition: transform 0.2s, opacity 0.2s;
}
</style>