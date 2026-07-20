<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useGruposStore } from '@/stores/grupos';
import { useRoute } from 'vue-router';
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
  ClipboardIcon,
} from '@heroicons/vue/24/outline';
import { CalendarIcon } from 'lucide-vue-next'; // Mantenemos tu import

const route = useRoute();

const authStore = useAuthStore();
const gruposStore = useGruposStore();

const isSidebarOpen = ref(true);
const openMenus = ref({});

const isChildActive = (child) => {
  // 1. Verificamos si la ruta usa query (ej. Asistencias)
  if (child.to.query && child.to.query.grupo) {
    return route.name === child.to.name && Number(route.query.grupo) === Number(child.to.query.grupo);
  }
  
  // 2. Verificamos si la ruta usa params (ej. Mi Grupo)
  if (child.to.params && child.to.params.id) {
    return route.name === child.to.name && Number(route.params.id) === Number(child.to.params.id);
  }

  // 3. Comportamiento por defecto (Enlaces simples)
  return route.name === child.to.name;
};

// Control del menú desplegable
const toggleMenu = (name) => {
  if (!isSidebarOpen.value) {
    isSidebarOpen.value = true;
    // Pequeño delay para que la animación del sidebar termine antes de abrir el submenú
    setTimeout(() => { openMenus.value[name] = !openMenus.value[name]; }, 150);
  } else {
    openMenus.value[name] = !openMenus.value[name];
  }
};

// Carga en background para asegurar que tenemos los datos de los grupos
onMounted(async () => {
  if (gruposStore.items.length === 0) {
    // Reducimos tiempo de espera cargando sin bloquear la interfaz
    gruposStore.fetchAll().catch(e => console.error(e));
  }
});

// Extraemos los detalles completos de los grupos del usuario actual
const misGruposDetalle = computed(() => {
  const user = authStore.user;
  if (!user) return [];

  // Si el backend ya mandó los objetos completos, los usamos
  if (user.grupos && user.grupos.length > 0) return user.grupos;

  // Si solo tenemos los IDs, los cruzamos con el store de grupos (muy rápido)
  if (user.grupo_ids && user.grupo_ids.length > 0) {
    return user.grupo_ids
      .map(id => gruposStore.items.find(g => g.id === id))
      .filter(Boolean); // Filtramos undefined por si el store aún carga
  }
  return [];
});

// Estructuramos la navegación por secciones
const menuSections = computed(() => {
  const sections = [];

  // --- 1. SECCIÓN PRINCIPAL ---
  sections.push({
    title: 'General',
    items: [
      { name: 'Dashboard', to: { name: 'dashboard' }, icon: HomeIcon },
      { name: 'Cronograma', to: { name: 'cronograma' }, icon: CalendarIcon, permission: 'ver cronograma' },
      { name: 'Cumpleaños', to: { name: 'cumpleanos' }, icon: CakeIcon },
    ]
  });

  // --- 2. SECCIÓN: MI PASTORAL (Dinámica para Catequistas) ---
  const pastoralItems = [];

  // A. Gestión de Asistencias (Admin / Coordinador)
  if (authStore.can('ver todas las asistencias')) {
    pastoralItems.push({
      name: 'Gestión Asistencias',
      icon: ClipboardDocumentIcon,
      permission: 'ver todas las asistencias',
      children: [
        { name: 'Confirmandos', to: { name: 'asistencias-confirmandos' } },
        { name: 'Catequistas', to: { name: 'asistencias-catequistas' } },
        { name: 'Apoderados', to: { name: 'asistencias-apoderados' } },
      ]
    });
  }
  // B. Asistencia (Catequista)
  else if (authStore.can('ver asistencias') && misGruposDetalle.value.length > 0) {
    const grupos = misGruposDetalle.value;

    if (grupos.length === 1) {
      // Tiene 1 solo grupo -> Botón directo
      pastoralItems.push({
        name: `Asistencia: ${grupos[0].nombre}`,
        to: { name: 'asistencias-confirmandos', query: { grupo: grupos[0].id } }, // Enviamos el ID por query param
        icon: ClipboardDocumentIcon,
      });
    } else {
      // Tiene Varios grupos -> Menú Desplegable
      pastoralItems.push({
        name: 'Mis Asistencias',
        icon: ClipboardDocumentIcon,
        children: grupos.map(g => ({
          name: g.nombre,
          to: { name: 'asistencias-confirmandos', query: { grupo: g.id } }
        }))
      });
    }
  }

  // C. Accesos a "Mi Grupo" (Perfiles)
  if (misGruposDetalle.value.length === 1) {
    pastoralItems.push({
      name: `Mi Grupo (${misGruposDetalle.value[0].nombre})`,
      to: { name: 'miGrupo', params: { id: misGruposDetalle.value[0].id } }, // ID individual correcto
      icon: UserIcon,
      permission: 'ver grupos'
    });
  } else if (misGruposDetalle.value.length > 1) {
    pastoralItems.push({
      name: 'Mis Grupos',
      icon: UserIcon,
      permission: 'ver grupos',
      children: misGruposDetalle.value.map(g => ({
        name: g.nombre,
        to: { name: 'miGrupo', params: { id: g.id } }
      }))
    });
  }

  // Solo agregamos la sección si tiene items (Si un usuario no es catequista, no la verá)
  if (pastoralItems.length > 0) {
    sections.push({ title: 'Mi grupo', items: pastoralItems });
  }

  // --- 3. SECCIÓN: ADMINISTRACIÓN ---
  sections.push({
    title: 'Administración',
    items: [
      { name: 'Confirmandos', to: { name: 'confirmandos' }, icon: UserCircleIcon, permission: 'ver todos los confirmandos' },
      { name: 'Grupos', to: { name: 'grupos' }, icon: UserGroupIcon, permission: 'ver todos los grupos' },
      { name: 'Sacramentos', to: { name: 'sacramentos' }, icon: FireIcon, permission: 'ver todos los sacramentos' },
      { name: 'Requisitos', to: { name: 'requisitos' }, icon: WalletIcon, permission: 'ver todos los requisitos' },
      { name: 'Usuarios', to: { name: 'users' }, icon: UsersIcon, permission: 'ver usuarios' },
      { name: 'Justificaciones', to: { name: 'justificaciones' }, icon: ClipboardIcon, permission: 'ver todas las asistencias' }
    ]
  });

  return sections;
});

// Filtramos las secciones y quitamos las que queden vacías por falta de permisos
const filteredSections = computed(() => {
  return menuSections.value.map(section => {
    // Filtramos los items internos de cada sección
    const allowedItems = section.items.filter(item => !item.permission || authStore.can(item.permission));
    return { ...section, items: allowedItems };
  }).filter(section => section.items.length > 0); // Excluimos secciones sin items
});

const handleLogout = () => authStore.logout();
const toggleSidebar = () => (isSidebarOpen.value = !isSidebarOpen.value);

defineExpose({ toggleSidebar });
</script>

<template>
  <div :class="[
    'relative flex h-screen flex-col border-r bg-white/80 backdrop-blur-md transition-all duration-300 ease-in-out',
    isSidebarOpen ? 'w-72 p-4' : 'w-20 p-2'
  ]">
    <!-- Header del Sidebar -->
    <div
      :class="['mb-2 flex items-center justify-between border-b pb-4', isSidebarOpen ? 'px-2' : 'px-0 justify-center']">
      <div v-if="isSidebarOpen" class="inline-flex items-center gap-2">
        <img src="@/assets/logo.png" alt="Logo" class="h-10 w-auto" />
        <h5 class="block text-xl font-bold tracking-tight text-slate-800">
          SGPC
        </h5>
      </div>
      <button @click="toggleSidebar"
        class="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors focus:outline-none">
        <XMarkIcon v-if="isSidebarOpen" class="h-6 w-6" />
        <Bars3Icon v-else class="h-6 w-6" />
      </button>
    </div>

    <!-- Navegación por Secciones -->
    <nav class="flex flex-col text-base flex-grow pt-2 overflow-y-auto custom-scroll">

      <div v-for="(section, idx) in filteredSections" :key="section.title" class="mb-4">

        <!-- Título de Sección -->
        <div v-if="isSidebarOpen" class="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          {{ section.title }}
        </div>
        <!-- Divisor visual cuando está colapsado -->
        <div v-else-if="idx !== 0" class="border-t border-slate-200 mx-4 mb-2 mt-1"></div>

        <div class="flex flex-col gap-1">
          <template v-for="item in section.items" :key="item.name">

            <!-- Enlace Simple -->
            <RouterLink v-if="!item.children" :to="item.to" custom v-slot="{ navigate, href, isActive, isExactActive }">
              <a :href="href" @click="navigate" :title="!isSidebarOpen ? item.name : undefined" class="nav-link group"
                :class="[
                  (item.to.name === 'dashboard' ? isExactActive : isActive) ? 'nav-link--active' : 'nav-link--idle',
                  !isSidebarOpen ? 'justify-center' : ''
                ]">
                <span class="active-indicator"
                  :class="(item.to.name === 'dashboard' ? isExactActive : isActive) ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'"
                  aria-hidden="true"></span>

                <div class="grid place-items-center shrink-0" :class="isSidebarOpen ? 'mr-3' : 'mx-auto'">
                  <component :is="item.icon" class="h-5 w-5 transition-colors" aria-hidden="true" />
                </div>

                <span v-if="isSidebarOpen" class="truncate font-medium text-sm">{{ item.name }}</span>
              </a>
            </RouterLink>

            <!-- Menú Desplegable (Sub-items) -->
            <div v-else class="flex flex-col">
              <button @click="toggleMenu(item.name)" :title="!isSidebarOpen ? item.name : undefined"
                class="nav-link group w-full nav-link--idle" :class="!isSidebarOpen ? 'justify-center' : ''">
                <div class="grid place-items-center shrink-0" :class="isSidebarOpen ? 'mr-3' : 'mx-auto'">
                  <component :is="item.icon" class="h-5 w-5 transition-colors" aria-hidden="true" />
                </div>

                <div v-if="isSidebarOpen" class="flex flex-1 items-center justify-between overflow-hidden">
                  <span class="truncate font-medium text-sm">{{ item.name }}</span>
                  <ChevronDownIcon class="h-4 w-4 text-slate-400 transition-transform duration-200"
                    :class="openMenus[item.name] ? 'rotate-180' : ''" />
                </div>
              </button>

              <!-- Hijos del Menú Desplegable -->
              <div v-show="isSidebarOpen && openMenus[item.name]"
                class="flex flex-col gap-1 mt-1 transition-all duration-300 pl-8">
                <RouterLink v-for="child in item.children" :key="child.name" :to="child.to" custom
                  v-slot="{ navigate, href }">
                  <a :href="href" @click="navigate"
                    class="nav-link group child-link py-1.5 px-3 rounded-lg flex items-center gap-2"
                    :class="isChildActive(child) ? 'text-primary bg-primary/5 font-semibold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'">
                    <div class="w-1.5 h-1.5 rounded-full" :class="isChildActive(child) ? 'bg-primary' : 'bg-slate-300'">
                    </div>
                    <span class="truncate text-[0.85rem]">{{ child.name }}</span>
                  </a>
                </RouterLink>
              </div>
            </div>
          </template>
        </div>
      </div>

    </nav>

    <!-- Footer Logout -->
    <div class="mt-auto border-t pt-3">
      <button @click="handleLogout" class="nav-link w-full text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
        :class="!isSidebarOpen ? 'justify-center' : ''">
        <ArrowLeftOnRectangleIcon class="h-5 w-5 shrink-0" :class="isSidebarOpen ? 'mr-3' : 'mx-auto'" />
        <span v-if="isSidebarOpen" class="text-sm">Cerrar sesión</span>
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