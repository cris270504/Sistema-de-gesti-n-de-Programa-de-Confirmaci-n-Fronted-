<script setup>
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
      <button class="rs-add" @click="abrirNuevo('sac')"><Plus :size="15" /> Sacramento</button>
    </template>

    <div v-if="nuevo.tipo === 'sac'" class="rs-newbar">
      <span>Nuevo sacramento:</span>
      <input ref="nuevoInput" v-model="nuevo.valor" class="rs-input" placeholder="Nombre…" @keyup.enter="crearNuevo"
        @keyup.esc="cancelarNuevo" />
      <button class="rs-newbar__ok" @click="crearNuevo">Agregar</button>
      <button class="rs-newbar__x" @click="cancelarNuevo" aria-label="Cancelar"><X :size="15" /></button>
    </div>

    <div v-if="sacramentos.length === 0" class="surface empty-state">
      Aún no hay sacramentos. Agregá uno con el botón de arriba.
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
              <h3 class="rs-card__title" :class="{ 'is-clickable': puedeEditar }" @click="abrirEdicion('sac', sac)">
                {{ sac.nombre }}
              </h3>
              <span class="rs-card__count">{{ (sac.requisitos ?? []).length }}/{{ requisitos.length }}</span>
              <span v-if="puedeEditar" class="rs-card__actions">
                <button class="rs-ico" title="Renombrar" @click="abrirEdicion('sac', sac)"><Pencil :size="13" /></button>
                <button class="rs-ico rs-ico--danger" title="Eliminar sacramento"
                  @click="borrarSacramento(sac)"><Trash2 :size="13" /></button>
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
          <button v-if="puedeEditar && nuevo.tipo !== 'req'" class="rs-add rs-add--sm" @click="abrirNuevo('req')">
            <Plus :size="14" /> Documento
          </button>
          <span v-else-if="puedeEditar" class="rs-docs__new">
            <input ref="nuevoInput" v-model="nuevo.valor" class="rs-input rs-input--sm" placeholder="Nombre del documento…"
              @keyup.enter="crearNuevo" @keyup.esc="cancelarNuevo" />
            <button class="rs-newbar__ok" @click="crearNuevo">Agregar</button>
            <button class="rs-newbar__x" @click="cancelarNuevo" aria-label="Cancelar"><X :size="15" /></button>
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
                <button class="rs-ico" title="Renombrar" @click="abrirEdicion('req', req)"><Pencil :size="13" /></button>
                <button class="rs-ico rs-ico--danger" title="Eliminar documento"
                  @click="borrarRequisito(req)"><Trash2 :size="13" /></button>
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
.rs-add {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid #dbe3ea;
  background: #fff;
  color: #334155;
  border-radius: 8px;
  padding: 0.4rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 600;
}
.rs-add:hover { background: #f8fafc; border-color: #cbd5e1; }

.rs-newbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: #3730a3;
  flex-wrap: wrap;
}
.rs-newbar__ok {
  border: 0;
  background: #4f46e5;
  color: #fff;
  border-radius: 7px;
  padding: 0.35rem 0.8rem;
  font-weight: 600;
  font-size: 0.82rem;
}
.rs-newbar__x { border: 0; background: transparent; color: #6366f1; line-height: 0; }

.rs-input {
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  padding: 0.4rem 0.6rem;
  font-size: 0.88rem;
  min-width: 200px;
  flex: 1;
}
.rs-input--sm { min-width: 120px; padding: 0.3rem 0.5rem; font-size: 0.85rem; }
.rs-input:focus { outline: 2px solid #c7d2fe; outline-offset: -1px; border-color: #6366f1; }

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
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.rs-card__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  background: #fbfcfe;
}
.rs-card__ico {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #eef2ff;
  color: #4f46e5;
  flex-shrink: 0;
}
.rs-card__title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: #1f2937;
  flex: 1;
  min-width: 0;
}
.rs-card__title.is-clickable { cursor: text; }
.rs-card__count {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  background: #eef2f6;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  flex-shrink: 0;
}
.rs-card__actions { display: inline-flex; gap: 0.1rem; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
.rs-card:hover .rs-card__actions { opacity: 1; }

.rs-check { list-style: none; margin: 0; padding: 0.4rem; }
.rs-check__empty { padding: 1rem; text-align: center; color: #94a3b8; font-style: italic; font-size: 0.85rem; }

.rs-check__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #64748b;
  transition: background 0.12s, color 0.12s;
}
.rs-check__item:hover { background: #f8fafc; }
.rs-check__item.disabled { cursor: default; }
.rs-check__item input { opacity: 0; width: 0; height: 0; margin: 0; }

.rs-check__box {
  width: 20px;
  height: 20px;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
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
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}
.rs-add--sm { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
.rs-docs__new { display: inline-flex; align-items: center; gap: 0.4rem; flex: 1; min-width: 240px; }
.rs-docs__empty { color: #94a3b8; font-style: italic; font-size: 0.86rem; margin: 0; }

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
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.86rem;
}
.rs-doc__name { flex: 1; min-width: 0; color: #334155; }
.rs-doc__name.is-clickable { cursor: text; }
.rs-doc__actions { display: inline-flex; gap: 0.1rem; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
.rs-doc:hover .rs-doc__actions { opacity: 1; }

.rs-ico {
  border: 0;
  background: transparent;
  color: #94a3b8;
  padding: 0.15rem;
  border-radius: 5px;
  cursor: pointer;
  line-height: 0;
}
.rs-ico:hover { background: #f1f5f9; color: #475569; }
.rs-ico--danger:hover { background: #fef2f2; color: #ef4444; }

@media (max-width: 767px) {
  .rs-card__actions,
  .rs-doc__actions { opacity: 1; }
}
</style>
