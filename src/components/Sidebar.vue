<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useGruposStore } from '@/stores/grupos';
import { useParroquiaStore } from '@/stores/parroquia';
import { useRoute } from 'vue-router';
import { prefetchRoute } from '@/router';
import defaultLogo from '@/assets/logo.png';
import {
  Home,
  Users,
  UsersRound,
  UserCircle,
  User,
  LogOut,
  Menu,
  X,
  ClipboardList,
  ChevronDown,
  Flame,
  Wallet,
  Cake,
  Clipboard,
  Calendar,
  KeyRound,
  Settings,
  Building2,
} from 'lucide-vue-next';

const route = useRoute();

const props = defineProps({
  // true cuando la barra actúa como cajón deslizante (móvil/tablet): se muestra
  // siempre expandida y el botón de la cabecera cierra el cajón.
  drawerMode: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);

const authStore = useAuthStore();
const gruposStore = useGruposStore();
const parroquiaStore = useParroquiaStore();

const isSidebarOpen = ref(true);
const openMenus = ref({});

// Estado visual efectivo: en modo cajón siempre expandida.
const expanded = computed(() => props.drawerMode || isSidebarOpen.value);

const onHeaderButton = () => {
  if (props.drawerMode) emit('close');
  else toggleSidebar();
};

// Un catequista no tiene "ver todos los grupos" (permiso que exige /grupos, el listado
// completo), así que nadie más carga este store por él. Igual que en AsignacionGrupo.vue,
// usamos fetchById por cada grupo asignado (permiso "ver grupos") para no pedir un
// endpoint al que no tiene acceso. Sin esto, sus grupo_ids nunca se resuelven a
// nombres/objetos y toda la sección "Mi grupo" del menú desaparece.
onMounted(() => {
  const misGrupoIds = authStore.user?.grupo_ids || [];
  misGrupoIds.forEach(id => {
    if (!gruposStore.items.some(g => g.id === id)) {
      gruposStore.fetchById(id).catch(() => {});
    }
  });
});

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
let toggleMenuTimeoutId = null;

const toggleMenu = (name) => {
  if (!isSidebarOpen.value) {
    isSidebarOpen.value = true;
    // Pequeño delay para que la animación del sidebar termine antes de abrir el submenú
    clearTimeout(toggleMenuTimeoutId);
    toggleMenuTimeoutId = setTimeout(() => { openMenus.value[name] = !openMenus.value[name]; }, 150);
  } else {
    openMenus.value[name] = !openMenus.value[name];
  }
};

onUnmounted(() => {
  clearTimeout(toggleMenuTimeoutId);
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

  // --- 0. PLATAFORMA (proveedor) ---
  if (authStore.can('administrar plataforma')) {
    sections.push({
      title: 'Plataforma',
      items: [
        { name: 'Parroquias', to: { name: 'parroquias' }, icon: Building2, permission: 'administrar plataforma' },
      ],
    });
  }

  // El proveedor (cuenta de plataforma, sin parroquia) solo opera el panel de parroquias.
  if (authStore.hasRole('proveedor')) {
    return sections;
  }

  // --- 1. SECCIÓN PRINCIPAL ---
  sections.push({
    title: 'General',
    items: [
      { name: 'Dashboard', to: { name: 'dashboard' }, icon: Home },
      { name: 'Cronograma', to: { name: 'cronograma' }, icon: Calendar, permission: 'ver cronograma' },
      { name: 'Cumpleaños', to: { name: 'cumpleanos' }, icon: Cake },
    ]
  });

  // --- 2. SECCIÓN: SEGUIMIENTO (asistencias + justificaciones, según el rol) ---
  const seguimientoItems = [];

  if (authStore.can('ver todas las asistencias')) {
    // Gestor / coordinador: matriz completa + justificaciones globales.
    // Solo se muestran los tipos de asistencia que la parroquia tomó en su
    // configuración (configuracion.tipos_reunion).
    const tipos = parroquiaStore.tiposReunion || [];
    const opcionesAsistencia = [
      { name: 'Confirmandos', to: { name: 'asistencias-confirmandos' } },
      { name: 'Catequistas', to: { name: 'asistencias-catequistas' } },
      { name: 'Apoderados', to: { name: 'asistencias-apoderados' } },
    ].filter(o => tipos.includes(o.name));

    if (opcionesAsistencia.length === 1) {
      seguimientoItems.push({ ...opcionesAsistencia[0], name: 'Asistencias', icon: ClipboardList, permission: 'ver todas las asistencias' });
    } else if (opcionesAsistencia.length > 1) {
      seguimientoItems.push({
        name: 'Asistencias',
        icon: ClipboardList,
        permission: 'ver todas las asistencias',
        children: opcionesAsistencia,
      });
    }
    seguimientoItems.push({ name: 'Justificaciones', to: { name: 'justificaciones' }, icon: Clipboard });
  } else if (authStore.can('ver asistencias') && misGruposDetalle.value.length > 0) {
    // Catequista: asistencias de su(s) grupo(s) + justificaciones de sus jóvenes.
    const grupos = misGruposDetalle.value;

    if (grupos.length === 1) {
      seguimientoItems.push({
        name: 'Asistencias',
        to: { name: 'asistencias-confirmandos', query: { grupo: grupos[0].id } },
        icon: ClipboardList,
      });
    } else {
      seguimientoItems.push({
        name: 'Asistencias',
        icon: ClipboardList,
        children: grupos.map(g => ({
          name: g.nombre,
          to: { name: 'asistencias-confirmandos', query: { grupo: g.id } }
        }))
      });
    }
    seguimientoItems.push({ name: 'Justificaciones', to: { name: 'justificaciones' }, icon: Clipboard });
  }

  if (seguimientoItems.length > 0) {
    sections.push({ title: 'Seguimiento', items: seguimientoItems });
  }

  // --- 3. SECCIÓN: PADRÓN (personas del programa) ---
  const padronItems = [
    { name: 'Confirmandos', to: { name: 'confirmandos' }, icon: UserCircle, permission: 'ver todos los confirmandos' },
    { name: 'Grupos', to: { name: 'grupos' }, icon: UsersRound, permission: 'ver todos los grupos' },
  ];
  // Accesos directos a "Mi Grupo" para el catequista.
  if (misGruposDetalle.value.length === 1) {
    padronItems.push({
      name: `Mi Grupo (${misGruposDetalle.value[0].nombre})`,
      to: { name: 'miGrupo', params: { id: misGruposDetalle.value[0].id } },
      icon: User,
      permission: 'ver grupos'
    });
  } else if (misGruposDetalle.value.length > 1) {
    padronItems.push({
      name: 'Mis Grupos',
      icon: User,
      permission: 'ver grupos',
      children: misGruposDetalle.value.map(g => ({
        name: g.nombre,
        to: { name: 'miGrupo', params: { id: g.id } }
      }))
    });
  }
  sections.push({ title: 'Padrón', items: padronItems });

  // --- 4. SECCIÓN: CATEQUESIS (ruta sacramental) ---
  sections.push({
    title: 'Catequesis',
    items: [
      { name: 'Ruta sacramental', to: { name: 'sacramentos' }, icon: Flame, permission: 'ver todos los sacramentos' },
    ]
  });

  // --- 5. SECCIÓN: ADMINISTRACIÓN (gestión del sistema) ---
  sections.push({
    title: 'Administración',
    items: [
      { name: 'Usuarios', to: { name: 'users' }, icon: Users, permission: 'ver usuarios' },
      { name: 'Roles y Permisos', to: { name: 'roles' }, icon: KeyRound, permission: 'ver roles' },
      { name: 'Configuración', to: { name: 'configuracion' }, icon: Settings, permission: 'administrar parroquia' }
    ]
  });

  return sections;
});

// Filtramos las secciones y quitamos las que queden vacías por falta de permisos
const filteredSections = computed(() => {
  return menuSections.value.map(section => {
    // Filtramos los items internos de cada sección
    const allowedItems = section.items.filter(item => {
      // Módulo ocultado por la parroquia en Configuración (cosmético, no seguridad).
      if (parroquiaStore.moduloOculto(item.to?.name)) return false;
      if (!item.permission) return true;
      return Array.isArray(item.permission)
        ? authStore.canAll(item.permission)
        : authStore.can(item.permission);
    });
    return { ...section, items: allowedItems };
  }).filter(section => section.items.length > 0); // Excluimos secciones sin items
});

const handleLogout = () => authStore.logout();
const toggleSidebar = () => (isSidebarOpen.value = !isSidebarOpen.value);

defineExpose({ toggleSidebar });
</script>

<template>
  <div :class="[
    'relative flex flex-col border-r backdrop-blur-md transition-all duration-300 ease-in-out',
    drawerMode ? 'h-full w-full bg-white p-4' : 'h-screen bg-white/80',
    !drawerMode && (isSidebarOpen ? 'w-72 p-4' : 'w-20 p-2')
  ]">
    <!-- Header del Sidebar -->
    <div
      :class="['mb-2 flex items-center justify-between border-b pb-4', expanded ? 'px-2' : 'px-0 justify-center']">
      <div v-if="expanded" class="inline-flex items-center gap-2">
        <img :src="parroquiaStore.branding.logo_url || defaultLogo" alt="Logo" class="h-10 w-auto object-contain"
          @error="e => (e.target.src = defaultLogo)" />
        <h5 class="block text-xl font-bold tracking-tight text-slate-800 truncate max-w-[160px]"
          :title="parroquiaStore.nombreApp">
          {{ parroquiaStore.nombreApp }}
        </h5>
      </div>
      <button @click="onHeaderButton"
        class="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors focus:outline-none">
        <X v-if="expanded" class="h-6 w-6" aria-hidden="true" />
        <Menu v-else class="h-6 w-6" aria-hidden="true" />
      </button>
    </div>

    <!-- Navegación por Secciones -->
    <nav class="flex flex-col text-base flex-grow pt-2 overflow-y-auto custom-scroll">

      <div v-for="(section, idx) in filteredSections" :key="section.title" class="mb-4">

        <!-- Título de Sección -->
        <div v-if="expanded" class="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          {{ section.title }}
        </div>
        <!-- Divisor visual cuando está colapsado -->
        <div v-else-if="idx !== 0" class="border-t border-slate-200 mx-4 mb-2 mt-1"></div>

        <div class="flex flex-col gap-1.5">
          <template v-for="item in section.items" :key="item.name">

            <!-- Enlace Simple -->
            <RouterLink v-if="!item.children" :to="item.to" custom v-slot="{ navigate, href, isActive, isExactActive }">
              <a :href="href" @click="navigate" @mouseenter="prefetchRoute(item.to?.name)" @focus="prefetchRoute(item.to?.name)"
                :title="!expanded ? item.name : undefined" class="nav-link group"
                :class="[
                  (item.to.name === 'dashboard' ? isExactActive : isActive) ? 'nav-link--active' : 'nav-link--idle',
                  !expanded ? 'justify-center' : ''
                ]">
                <span class="active-indicator"
                  :class="(item.to.name === 'dashboard' ? isExactActive : isActive) ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'"
                  aria-hidden="true"></span>

                <div class="grid place-items-center shrink-0" :class="expanded ? 'mr-3' : 'mx-auto'">
                  <component :is="item.icon" class="h-5 w-5 transition-colors" aria-hidden="true" />
                </div>

                <span v-if="expanded" class="truncate font-medium text-sm">{{ item.name }}</span>
              </a>
            </RouterLink>

            <!-- Menú Desplegable (Sub-items) -->
            <div v-else class="flex flex-col">
              <button @click="toggleMenu(item.name)" :title="!expanded ? item.name : undefined"
                class="nav-link group w-full nav-link--idle" :class="!expanded ? 'justify-center' : ''">
                <div class="grid place-items-center shrink-0" :class="expanded ? 'mr-3' : 'mx-auto'">
                  <component :is="item.icon" class="h-5 w-5 transition-colors" aria-hidden="true" />
                </div>

                <div v-if="expanded" class="flex flex-1 items-center justify-between overflow-hidden">
                  <span class="truncate font-medium text-sm">{{ item.name }}</span>
                  <ChevronDown class="h-4 w-4 text-slate-400 transition-transform duration-200"
                    :class="openMenus[item.name] ? 'rotate-180' : ''" />
                </div>
              </button>

              <!-- Hijos del Menú Desplegable -->
              <div v-show="expanded && openMenus[item.name]"
                class="flex flex-col gap-1 mt-1 transition-all duration-300 pl-8">
                <RouterLink v-for="child in item.children" :key="child.name" :to="child.to" custom
                  v-slot="{ navigate, href }">
                  <a :href="href" @click="navigate" @mouseenter="prefetchRoute(child.to?.name)" @focus="prefetchRoute(child.to?.name)"
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
        :class="!expanded ? 'justify-center' : ''">
        <LogOut class="h-5 w-5 shrink-0" :class="expanded ? 'mr-3' : 'mx-auto'" aria-hidden="true" />
        <span v-if="expanded" class="text-sm">Cerrar sesión</span>
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
  color: var(--color-primary);
}

/* Indicador azul a la izquierda */
.active-indicator {
  position: absolute;
  left: 0;
  top: 10%;
  bottom: 10%;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background-color: var(--color-primary);
  transition: transform 0.2s, opacity 0.2s;
}
</style>