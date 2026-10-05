<script setup>
import AppButton from '@/components/AppButton.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { ref, computed, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { Check, Plus, Pencil, Trash2, X, FileCheck } from 'lucide-vue-next';
import { useSacramentosStore } from '@/stores/sacramentos';
import { useRequisitosStore } from '@/stores/requisitos';
import { useAuthStore } from '@/stores/auth';
import { setSacramentoRequisito, updateSacramento } from '@/services/sacramentos';
import { showAlerta } from '@/funciones';
import AppPage from '@/components/AppPage.vue';

const sacramentosStore = useSacramentosStore();
const requisitosStore = useRequisitosStore();
const authStore = useAuthStore();

const { items: sacramentosRaw, loading } = storeToRefs(sacramentosStore);
const { items: requisitosRaw } = storeToRefs(requisitosStore);

const puedeEditar = computed(() =>
  authStore.canAny(['crear sacramentos', 'editar sacramentos', 'crear requisitos', 'editar requisitos']));

// Bautismo → Primera Comunión → Confirmación; sacramentos propios de la parroquia, al final.
const ORDEN_CLAVE = { bautismo: 1, comunion: 2, confirmacion: 3 };
const sacramentos = computed(() =>
  [...sacramentosRaw.value].sort((a, b) =>
    (ORDEN_CLAVE[a.clave] ?? 90) - (ORDEN_CLAVE[b.clave] ?? 90) || a.id - b.id));
const requisitos = computed(() =>
  [...requisitosRaw.value].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')));

onMounted(async () => {
  await Promise.all([
    sacramentosStore.fetchAll({ force: true }),
    requisitosStore.fetchAll({ force: true }),
  ]);
});

// ── Vínculo requisito ↔ sacramento ─────────────────────────────────────────
const tiene = (sac, reqId) => (sac.requisitos ?? []).some(r => r.id === reqId);

const guardando = ref(new Set());
const key = (s, r) => `${s}-${r}`;

async function toggle(sac, req) {
  if (!puedeEditar.value) return;
  const k = key(sac.id, req.id);
  if (guardando.value.has(k)) return;

  const activar = !tiene(sac, req.id);
  sac.requisitos = activar
    ? [...(sac.requisitos ?? []), { id: req.id, nombre: req.nombre }]
    : (sac.requisitos ?? []).filter(r => r.id !== req.id);

  guardando.value = new Set(guardando.value).add(k);
  try {
    await setSacramentoRequisito(sac.id, req.id, activar);
  } catch (e) {
    sac.requisitos = activar
      ? (sac.requisitos ?? []).filter(r => r.id !== req.id)
      : [...(sac.requisitos ?? []), { id: req.id, nombre: req.nombre }];
    showAlerta(e?.message || 'No se pudo guardar el cambio', 'error');
  } finally {
    const s = new Set(guardando.value); s.delete(k); guardando.value = s;
  }
}

// ── Alta ───────────────────────────────────────────────────────────────────
const nuevo = ref({ tipo: null, valor: '' }); // 'req' | 'sac'
const nuevoInput = ref(null);

const abrirNuevo = async (tipo) => {
  nuevo.value = { tipo, valor: '' };
  await nextTick();
  nuevoInput.value?.focus?.();
};
const cancelarNuevo = () => { nuevo.value = { tipo: null, valor: '' }; };

async function crearNuevo() {
  const { tipo, valor } = nuevo.value;
  const nombre = valor.trim();
  if (!tipo) return;
  if (!nombre) { cancelarNuevo(); return; }
  try {
    if (tipo === 'req') await requisitosStore.add({ nombre });
    else await sacramentosStore.add({ nombre });
    cancelarNuevo();
  } catch { /* el store ya avisa */ }
}

// ── Renombrar (inline) ─────────────────────────────────────────────────────
const editando = ref(null); // { tipo, id, valor }
const editInput = ref(null);

const abrirEdicion = async (tipo, item) => {
  if (!puedeEditar.value) return;
  editando.value = { tipo, id: item.id, valor: item.nombre };
  await nextTick();
  const el = Array.isArray(editInput.value) ? editInput.value[0] : editInput.value;
  el?.focus?.();
};

async function guardarEdicion() {
  const e = editando.value;
  if (!e) return;
  const nombre = e.valor.trim();
  editando.value = null;
  if (!nombre) return;
  try {
    if (e.tipo === 'req') {
      const req = requisitosRaw.value.find(r => r.id === e.id);
      if (req && req.nombre !== nombre) await requisitosStore.save(e.id, { nombre });
    } else {
      const sac = sacramentosRaw.value.find(s => s.id === e.id);
      if (sac && sac.nombre !== nombre) {
        await updateSacramento(e.id, { nombre });
        sac.nombre = nombre;
      }
    }
  } catch (err) {
    showAlerta(err?.message || 'No se pudo renombrar', 'error');
  }
}

const borrarRequisito = (req) => requisitosStore.remove(req.id, req.nombre);
const borrarSacramento = (sac) => sacramentosStore.remove(sac.id, sac.nombre);
</script>

<template>
  <AppPage title="Ruta sacramental" subtitle="Qué documentos pide cada sacramento" :loading="loading">
    <template v-if="puedeEditar" #actions>
      <AppButton variant="secondary" :icon="Plus" @click="abrirNuevo('sac')">Sacramento</AppButton>
    </template>

    <div v-if="nuevo.tipo === 'sac'" class="rs-newbar">
      <span>Nuevo sacramento:</span>
      <input ref="nuevoInput" v-model="nuevo.valor" class="rs-input" placeholder="Nombre…" @keyup.enter="crearNuevo"
        @keyup.esc="cancelarNuevo" />
      <AppButton size="sm" @click="crearNuevo">Agregar</AppButton>
      <AppButton variant="ghost" size="sm" icon-only :icon="X" aria-label="Cancelar" @click="cancelarNuevo" />
    </div>

    <div v-if="sacramentos.length === 0" class="surface">
      <AppEmpty :icon="FileCheck" message="Aún no hay sacramentos registrados." />
    </div>

    <template v-else>
      <!-- Tarjetas por sacramento -->
      <div class="rs-grid">
        <section v-for="sac in sacramentos" :key="sac.id" class="rs-card">
          <header class="rs-card__head">
            <span class="rs-card__ico"><FileCheck :size="16" /></span>
            <template v-if="editando?.tipo === 'sac' && editando.id === sac.id">
              <input ref="editInput" v-model="editando.valor" class="rs-input rs-input--sm"
                @keyup.enter="guardarEdicion" @keyup.esc="editando = null" @blur="guardarEdicion" />
            </template>
            <template v-else>
              <h3 class="rs-card__title">
                <button v-if="puedeEditar" type="button" class="rs-card__title-btn" title="Renombrar"
                  @click="abrirEdicion('sac', sac)">{{ sac.nombre }}</button>
                <template v-else>{{ sac.nombre }}</template>
              </h3>
              <span class="rs-card__count">{{ (sac.requisitos ?? []).length }}/{{ requisitos.length }}</span>
              <span v-if="puedeEditar" class="rs-card__actions">
                <AppButton variant="ghost" size="sm" icon-only :icon="Pencil" title="Renombrar" aria-label="Renombrar" @click="abrirEdicion('sac', sac)" />
                <AppButton variant="soft-danger" size="sm" icon-only :icon="Trash2" title="Eliminar sacramento" aria-label="Eliminar sacramento" @click="borrarSacramento(sac)" />
              </span>
            </template>
          </header>

          <ul class="rs-check">
            <li v-if="requisitos.length === 0" class="rs-check__empty">Todavía no hay documentos.</li>
            <li v-for="req in requisitos" :key="req.id">
              <label class="rs-check__item" :class="{ 'is-on': tiene(sac, req.id), disabled: !puedeEditar }">
                <input type="checkbox" :checked="tiene(sac, req.id)" :disabled="!puedeEditar"
                  @change="toggle(sac, req)" />
                <span class="rs-check__box"><Check :size="13" /></span>
                <span class="rs-check__txt">{{ req.nombre }}</span>
              </label>
            </li>
          </ul>
        </section>
      </div>

      <!-- Documentos: definiciones (renombrar / eliminar / agregar) -->
      <section class="surface rs-docs">
        <div class="rs-docs__head">
          <h3 class="rs-docs__title">Documentos ({{ requisitos.length }})</h3>
          <AppButton v-if="puedeEditar && nuevo.tipo !== 'req'" variant="secondary" size="sm" :icon="Plus"
            @click="abrirNuevo('req')">Documento</AppButton>
          <span v-else-if="puedeEditar" class="rs-docs__new">
            <input ref="nuevoInput" v-model="nuevo.valor" class="rs-input rs-input--sm" placeholder="Nombre del documento…"
              @keyup.enter="crearNuevo" @keyup.esc="cancelarNuevo" />
            <AppButton size="sm" @click="crearNuevo">Agregar</AppButton>
            <AppButton variant="ghost" size="sm" icon-only :icon="X" aria-label="Cancelar" @click="cancelarNuevo" />
          </span>
        </div>

        <ul v-if="requisitos.length" class="rs-docs__list">
          <li v-for="req in requisitos" :key="req.id" class="rs-doc">
            <template v-if="editando?.tipo === 'req' && editando.id === req.id">
              <input ref="editInput" v-model="editando.valor" class="rs-input rs-input--sm" @keyup.enter="guardarEdicion"
                @keyup.esc="editando = null" @blur="guardarEdicion" />
            </template>
            <template v-else>
              <span class="rs-doc__name" :class="{ 'is-clickable': puedeEditar }"
                @click="abrirEdicion('req', req)">{{ req.nombre }}</span>
              <span v-if="puedeEditar" class="rs-doc__actions">
                <AppButton variant="ghost" size="sm" icon-only :icon="Pencil" title="Renombrar" aria-label="Renombrar" @click="abrirEdicion('req', req)" />
                <AppButton variant="soft-danger" size="sm" icon-only :icon="Trash2" title="Eliminar documento" aria-label="Eliminar documento" @click="borrarRequisito(req)" />
              </span>
            </template>
          </li>
        </ul>
        <p v-else class="rs-docs__empty">Todavía no hay documentos.</p>
      </section>
    </template>
  </AppPage>
</template>

<style scoped>

.rs-newbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent-soft);
  border: 1px solid var(--accent-ring);
  border-radius: var(--radius-lg);
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  font-size: var(--fs-ui);
  color: #3730a3;
  flex-wrap: wrap;
}

.rs-input {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  padding: 0.4rem 0.6rem;
  font-size: var(--fs-ui);
  min-width: 200px;
  flex: 1;
}
.rs-input--sm { min-width: 120px; padding: 0.3rem 0.5rem; font-size: var(--fs-ui); }
.rs-input:focus { outline: 2px solid var(--accent-ring); outline-offset: -1px; border-color: var(--accent); }

/* ── Tarjetas por sacramento ───────────────────────────────────────────── */
.rs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
  align-items: start;
}

.rs-card {
  border: 1px solid #e6eaf0;
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.rs-card__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--line);
  background: #fbfcfe;
}
.rs-card__ico {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}
.rs-card__title {
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 700;
  color: #1f2937;
  flex: 1;
  min-width: 0;
}
.rs-card__title-btn {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  color: inherit;
  text-align: left;
  cursor: text;
  border-radius: var(--radius-sm);
}
.rs-card__title-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rs-card__count {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-muted);
  background: #eef2f6;
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  flex-shrink: 0;
}
.rs-card__actions { display: inline-flex; gap: 0.1rem; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
.rs-card:hover .rs-card__actions { opacity: 1; }

.rs-check { list-style: none; margin: 0; padding: 0.4rem; }
.rs-check__empty { padding: 1rem; text-align: center; color: var(--text-muted); font-style: italic; font-size: var(--fs-ui); }

.rs-check__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--fs-ui);
  color: var(--text-muted);
  transition: background 0.12s, color 0.12s;
}
.rs-check__item:hover { background: var(--surface-sunken); }
.rs-check__item.disabled { cursor: default; }
.rs-check__item input { opacity: 0; width: 0; height: 0; margin: 0; }

.rs-check__box {
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rs-check__item.is-on { color: #0f766e; }
.rs-check__item.is-on .rs-check__box { background: #10b981; border-color: #10b981; color: #fff; }
.rs-check__txt { min-width: 0; }

/* ── Documentos ────────────────────────────────────────────────────────── */
.rs-docs { padding: 1rem 1.15rem 1.25rem; }
.rs-docs__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.rs-docs__title {
  margin: 0;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-muted);
}
.rs-docs__new { display: inline-flex; align-items: center; gap: 0.4rem; flex: 1; min-width: 240px; }
.rs-docs__empty { color: var(--text-muted); font-style: italic; font-size: var(--fs-ui); margin: 0; }

.rs-docs__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.35rem 1rem;
}
.rs-doc {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.15rem;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-ui);
}
.rs-doc__name { flex: 1; min-width: 0; color: var(--text); }
.rs-doc__name.is-clickable { cursor: text; }
.rs-doc__actions { display: inline-flex; gap: 0.1rem; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
.rs-doc:hover .rs-doc__actions { opacity: 1; }

@media (max-width: 767px) {
  .rs-card__actions,
  .rs-doc__actions { opacity: 1; }
}

:root[data-bs-theme="dark"] .rs-newbar {
  background: #1e2547;
  border-color: #3730a3;
  color: color-mix(in srgb, var(--accent) 55%, #fff);
}

:root[data-bs-theme="dark"] .rs-input {
  background: var(--surface-sunken);
  border-color: var(--line-strong);
  color: var(--text);
}

:root[data-bs-theme="dark"] .rs-card {
  border-color: var(--line);
  background: var(--surface);
}
:root[data-bs-theme="dark"] .rs-card__head {
  border-bottom-color: var(--line);
  background: var(--surface-sunken);
}
:root[data-bs-theme="dark"] .rs-card__ico {
  background: #1e2547;
  color: #a5b4fc;
}
:root[data-bs-theme="dark"] .rs-card__title { color: var(--text); }
:root[data-bs-theme="dark"] .rs-card__count {
  background: var(--line);
}

:root[data-bs-theme="dark"] .rs-check__item { color: var(--text-muted); }
:root[data-bs-theme="dark"] .rs-check__item:hover { background: var(--line); }
:root[data-bs-theme="dark"] .rs-check__box { border-color: var(--line-strong); }
:root[data-bs-theme="dark"] .rs-check__item.is-on { color: #5eead4; }
:root[data-bs-theme="dark"] .rs-doc { border-bottom-color: var(--line); }
</style>
