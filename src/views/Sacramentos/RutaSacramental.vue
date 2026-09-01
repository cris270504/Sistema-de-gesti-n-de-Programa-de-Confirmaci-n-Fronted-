<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { Check, Plus, Pencil, Trash2, X } from 'lucide-vue-next';
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

// ── Matriz ─────────────────────────────────────────────────────────────────
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
const nuevo = ref({ tipo: null, valor: '' }); // tipo: 'req' | 'sac'
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

// ── Borrar ─────────────────────────────────────────────────────────────────
const borrarRequisito = (req) => requisitosStore.remove(req.id, req.nombre);
const borrarSacramento = (sac) => sacramentosStore.remove(sac.id, sac.nombre);
</script>

<template>
  <AppPage title="Ruta sacramental" subtitle="Sacramentos y los requisitos que pide cada uno" :loading="loading">
    <template v-if="puedeEditar" #actions>
      <button class="rs-add" @click="abrirNuevo('sac')"><Plus :size="15" /> Sacramento</button>
      <button class="rs-add" @click="abrirNuevo('req')"><Plus :size="15" /> Requisito</button>
    </template>

    <div v-if="nuevo.tipo" class="rs-newbar">
      <span>{{ nuevo.tipo === 'sac' ? 'Nuevo sacramento' : 'Nuevo requisito' }}:</span>
      <input ref="nuevoInput" v-model="nuevo.valor" class="rs-input" placeholder="Nombre…"
        @keyup.enter="crearNuevo" @keyup.esc="cancelarNuevo" />
      <button class="rs-newbar__ok" @click="crearNuevo">Agregar</button>
      <button class="rs-newbar__x" @click="cancelarNuevo" aria-label="Cancelar"><X :size="15" /></button>
    </div>

    <div v-if="sacramentos.length === 0 && requisitos.length === 0" class="surface empty-state">
      Aún no hay sacramentos ni requisitos. Agregá uno con los botones de arriba.
    </div>

    <div v-else class="surface mx-wrap">
      <table class="mx">
        <thead>
          <tr>
            <th class="mx__corner">Sacramento</th>
            <th v-for="req in requisitos" :key="req.id" class="mx__rq" :title="req.nombre">
              <div v-if="editando?.tipo === 'req' && editando.id === req.id" class="mx__rq-edit">
                <input ref="editInput" v-model="editando.valor" class="rs-input" @keyup.enter="guardarEdicion"
                  @keyup.esc="editando = null" @blur="guardarEdicion" />
              </div>
              <div v-else class="mx__rq-lbl" :class="{ 'is-clickable': puedeEditar }">
                <span class="mx__rq-txt" @click="abrirEdicion('req', req)">{{ req.nombre }}</span>
                <button v-if="puedeEditar" class="mx__rq-del" title="Eliminar requisito"
                  @click.stop="borrarRequisito(req)"><Trash2 :size="12" /></button>
              </div>
            </th>
            <th v-if="requisitos.length === 0" class="mx__rq-none">Sin requisitos todavía</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="sac in sacramentos" :key="sac.id">
            <th class="mx__sc">
              <div class="mx__sc-inner">
                <template v-if="editando?.tipo === 'sac' && editando.id === sac.id">
                  <input ref="editInput" v-model="editando.valor" class="rs-input" @keyup.enter="guardarEdicion"
                    @keyup.esc="editando = null" @blur="guardarEdicion" />
                </template>
                <template v-else>
                  <span class="mx__sc-name" :class="{ 'is-clickable': puedeEditar }"
                    @click="abrirEdicion('sac', sac)">{{ sac.nombre }}</span>
                  <span v-if="puedeEditar" class="mx__sc-actions">
                    <button class="mx__ico" title="Renombrar" @click="abrirEdicion('sac', sac)"><Pencil :size="13" /></button>
                    <button class="mx__ico mx__ico--danger" title="Eliminar sacramento"
                      @click="borrarSacramento(sac)"><Trash2 :size="13" /></button>
                  </span>
                </template>
              </div>
            </th>

            <td v-for="req in requisitos" :key="req.id" class="mx__cell"
              :class="{ 'is-on': tiene(sac, req.id), 'is-clickable': puedeEditar }" @click="toggle(sac, req)">
              <Check v-if="tiene(sac, req.id)" :size="16" class="mx__check" />
            </td>
            <td v-if="requisitos.length === 0"></td>
          </tr>

          <tr v-if="sacramentos.length === 0">
            <td :colspan="Math.max(requisitos.length, 1) + 1" class="mx__none">No hay sacramentos todavía.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="puedeEditar && sacramentos.length" class="mx__hint">
      Tocá una celda para marcar que ese requisito se pide para ese sacramento. Los nombres se editan haciendo clic.
    </p>
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
  margin-bottom: 0.9rem;
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
  padding: 0.35rem 0.55rem;
  font-size: 0.86rem;
  min-width: 200px;
}
.rs-input:focus { outline: 2px solid #c7d2fe; outline-offset: -1px; border-color: #6366f1; }

/* ── Matriz ─────────────────────────────────────────────────────────────── */
.mx-wrap { overflow-x: auto; }

.mx {
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
  font-size: 0.88rem;
}

.mx th,
.mx td {
  border-bottom: 1px solid #eef2f6;
  border-right: 1px solid #eef2f6;
  padding: 0;
}

/* Cabecera: nombres de requisito, verticales */
.mx thead th {
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 2;
  vertical-align: bottom;
}

.mx__rq {
  height: 200px;
  width: 46px;
  min-width: 46px;
}
.mx__rq-lbl {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  height: 100%;
  padding: 8px 0;
}
.mx__rq-txt {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
  max-height: 176px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: #334155;
}
.mx__rq-lbl.is-clickable .mx__rq-txt { cursor: text; }
.mx__rq-del {
  border: 0;
  background: transparent;
  color: #cbd5e1;
  line-height: 0;
  margin-bottom: 4px;
  opacity: 0;
  transition: opacity 0.12s;
}
.mx__rq:hover .mx__rq-del { opacity: 1; }
.mx__rq-del:hover { color: #ef4444; }
.mx__rq-edit { padding: 6px; height: 100%; display: flex; align-items: flex-end; }
.mx__rq-edit .rs-input { min-width: 150px; }
.mx__rq-none { padding: 1rem; color: #94a3b8; font-style: italic; white-space: nowrap; }

/* Esquina + primera columna (sacramentos), fija */
.mx__corner,
.mx__sc {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 1;
  text-align: left;
  min-width: 210px;
  border-right: 2px solid #e5e7eb;
}
.mx__corner {
  z-index: 3;
  background: #f8fafc;
  padding: 0 0.9rem 0.6rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  font-weight: 700;
  vertical-align: bottom;
}
.mx__sc { padding: 0.7rem 0.9rem; }
.mx__sc-inner { display: flex; align-items: center; gap: 0.5rem; }
.mx__sc-name { flex: 1; min-width: 0; font-weight: 600; color: #1f2937; }
.mx__sc-name.is-clickable { cursor: text; }
.mx__sc-actions { display: inline-flex; gap: 0.15rem; opacity: 0; transition: opacity 0.12s; flex-shrink: 0; }
.mx__sc:hover .mx__sc-actions { opacity: 1; }

.mx__ico {
  border: 0;
  background: transparent;
  color: #94a3b8;
  padding: 0.15rem;
  border-radius: 5px;
  cursor: pointer;
  line-height: 0;
}
.mx__ico:hover { background: #f1f5f9; color: #475569; }
.mx__ico--danger:hover { background: #fef2f2; color: #ef4444; }

/* Celdas */
.mx__cell {
  width: 46px;
  min-width: 46px;
  height: 46px;
  text-align: center;
  vertical-align: middle;
}
.mx__cell.is-clickable { cursor: pointer; }
.mx__cell.is-clickable:hover { background: #eff6ff; }
.mx__cell.is-on { background: #ecfdf5; }
.mx__cell.is-on:hover { background: #d1fae5; }
.mx__check { color: #059669; }

.mx__none { padding: 1.5rem; text-align: center; color: #94a3b8; font-style: italic; }

.mx__hint { margin-top: 0.75rem; font-size: 0.78rem; color: #94a3b8; }
</style>
