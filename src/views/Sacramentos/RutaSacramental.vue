<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { Check, Plus, Pencil, Trash2 } from 'lucide-vue-next';
import { useSacramentosStore } from '@/stores/sacramentos';
import { useRequisitosStore } from '@/stores/requisitos';
import { useAuthStore } from '@/stores/auth';
import { setSacramentoRequisito, updateSacramento } from '@/services/sacramentos';
import { showAlerta } from '@/funciones';
import AppPage from '@/components/AppPage.vue';

const sacramentosStore = useSacramentosStore();
const requisitosStore = useRequisitosStore();
const authStore = useAuthStore();

const { items: sacramentos, loading } = storeToRefs(sacramentosStore);
const { items: requisitos } = storeToRefs(requisitosStore);

const puedeEditar = computed(() =>
  authStore.canAny(['crear sacramentos', 'editar sacramentos', 'crear requisitos', 'editar requisitos']));

onMounted(async () => {
  await Promise.all([
    sacramentosStore.fetchAll({ force: true }),
    requisitosStore.fetchAll({ force: true }),
  ]);
});

// ── Matriz ─────────────────────────────────────────────────────────────────
const tiene = (sac, reqId) => (sac.requisitos ?? []).some(r => r.id === reqId);

const guardando = ref(new Set());
const celdaKey = (s, r) => `${s}-${r}`;

async function toggle(sac, req) {
  if (!puedeEditar.value) return;
  const key = celdaKey(sac.id, req.id);
  if (guardando.value.has(key)) return;

  const activar = !tiene(sac, req.id);
  // Optimista
  sac.requisitos = activar
    ? [...(sac.requisitos ?? []), { id: req.id, nombre: req.nombre }]
    : (sac.requisitos ?? []).filter(r => r.id !== req.id);

  guardando.value = new Set(guardando.value).add(key);
  try {
    await setSacramentoRequisito(sac.id, req.id, activar);
  } catch (e) {
    // Rollback
    sac.requisitos = activar
      ? (sac.requisitos ?? []).filter(r => r.id !== req.id)
      : [...(sac.requisitos ?? []), { id: req.id, nombre: req.nombre }];
    showAlerta(e?.message || 'No se pudo guardar el cambio', 'error');
  } finally {
    const s = new Set(guardando.value); s.delete(key); guardando.value = s;
  }
}

// ── Alta ───────────────────────────────────────────────────────────────────
const nuevoReq = ref('');
const nuevoSac = ref('');
const agregandoSac = ref(false);
const sacInput = ref(null);

async function crearRequisito() {
  const nombre = nuevoReq.value.trim();
  if (!nombre) return;
  try {
    await requisitosStore.add({ nombre });
    nuevoReq.value = '';
  } catch { /* el store ya avisa */ }
}

const abrirNuevoSac = async () => {
  agregandoSac.value = true;
  await nextTick();
  sacInput.value?.focus();
};

async function crearSacramento() {
  const nombre = nuevoSac.value.trim();
  if (!nombre) { agregandoSac.value = false; return; }
  try {
    await sacramentosStore.add({ nombre });
    nuevoSac.value = '';
    agregandoSac.value = false;
  } catch { /* el store ya avisa */ }
}

// ── Renombrar (inline) ─────────────────────────────────────────────────────
const editando = ref(null); // { tipo: 'sac'|'req', id, valor }
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
      const req = requisitos.value.find(r => r.id === e.id);
      if (req && req.nombre !== nombre) await requisitosStore.save(e.id, { nombre });
    } else {
      const sac = sacramentos.value.find(s => s.id === e.id);
      if (sac && sac.nombre !== nombre) {
        await updateSacramento(e.id, { nombre });
        sac.nombre = nombre; // el service no toca requisitos; parcheamos el nombre
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

    <div v-if="requisitos.length === 0 && sacramentos.length === 0" class="surface empty-state">
      Aún no hay sacramentos ni requisitos. Empezá agregando uno abajo.
    </div>

    <div class="surface matrix-wrap">
      <table class="matrix">
        <thead>
          <tr>
            <th class="matrix__corner">Requisito</th>
            <th v-for="sac in sacramentos" :key="sac.id" class="matrix__sac">
              <div v-if="editando?.tipo === 'sac' && editando.id === sac.id" class="matrix__edit">
                <input ref="editInput" v-model="editando.valor" class="matrix__input" @keyup.enter="guardarEdicion"
                  @keyup.esc="editando = null" @blur="guardarEdicion" />
              </div>
              <template v-else>
                <span class="matrix__sac-name" :class="{ 'is-clickable': puedeEditar }"
                  @click="abrirEdicion('sac', sac)">{{ sac.nombre }}</span>
                <button v-if="puedeEditar" class="matrix__del" title="Eliminar sacramento"
                  @click="borrarSacramento(sac)">
                  <Trash2 :size="13" />
                </button>
              </template>
            </th>
            <th v-if="puedeEditar" class="matrix__addcol">
              <input v-if="agregandoSac" ref="sacInput" v-model="nuevoSac" class="matrix__input"
                placeholder="Nombre…" @keyup.enter="crearSacramento" @keyup.esc="agregandoSac = false"
                @blur="crearSacramento" />
              <button v-else class="matrix__addbtn" title="Nuevo sacramento" @click="abrirNuevoSac">
                <Plus :size="15" />
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="req in requisitos" :key="req.id">
            <th class="matrix__req">
              <div v-if="editando?.tipo === 'req' && editando.id === req.id" class="matrix__edit">
                <input ref="editInput" v-model="editando.valor" class="matrix__input" @keyup.enter="guardarEdicion"
                  @keyup.esc="editando = null" @blur="guardarEdicion" />
              </div>
              <template v-else>
                <span class="matrix__req-name" :class="{ 'is-clickable': puedeEditar }"
                  @click="abrirEdicion('req', req)">{{ req.nombre }}</span>
                <span v-if="puedeEditar" class="matrix__req-actions">
                  <button class="matrix__ico" title="Renombrar" @click="abrirEdicion('req', req)">
                    <Pencil :size="13" />
                  </button>
                  <button class="matrix__ico matrix__ico--danger" title="Eliminar requisito"
                    @click="borrarRequisito(req)">
                    <Trash2 :size="13" />
                  </button>
                </span>
              </template>
            </th>

            <td v-for="sac in sacramentos" :key="sac.id" class="matrix__cell"
              :class="{ 'is-on': tiene(sac, req.id), 'is-clickable': puedeEditar }" @click="toggle(sac, req)">
              <Check v-if="tiene(sac, req.id)" :size="16" class="matrix__check" />
            </td>

            <td v-if="puedeEditar" class="matrix__cell matrix__cell--pad"></td>
          </tr>

          <tr v-if="requisitos.length === 0">
            <td :colspan="sacramentos.length + (puedeEditar ? 2 : 1)" class="matrix__empty">
              No hay requisitos todavía.
            </td>
          </tr>

          <tr v-if="puedeEditar" class="matrix__addrow">
            <th class="matrix__req">
              <input v-model="nuevoReq" class="matrix__input" placeholder="+ Nuevo requisito…"
                @keyup.enter="crearRequisito" @blur="crearRequisito" />
            </th>
            <td :colspan="sacramentos.length + 1"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="puedeEditar" class="matrix__hint">
      Tocá una celda para marcar que ese requisito se pide para ese sacramento. Los nombres se editan haciendo clic.
    </p>
  </AppPage>
</template>

<style scoped>
.matrix-wrap {
  overflow-x: auto;
}

.matrix {
  border-collapse: separate;
  border-spacing: 0;
  width: auto;
  min-width: 100%;
  font-size: 0.9rem;
}

.matrix th,
.matrix td {
  border-bottom: 1px solid #eef2f6;
  border-right: 1px solid #eef2f6;
  padding: 0;
}

.matrix thead th {
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 2;
}

/* Primera columna fija */
.matrix__corner,
.matrix__req {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #fff;
  text-align: left;
  min-width: 220px;
  max-width: 320px;
}

.matrix__corner {
  z-index: 3;
  background: #f8fafc;
  padding: 0.6rem 0.9rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  font-weight: 700;
}

.matrix__req {
  padding: 0.55rem 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.matrix__req-name {
  flex: 1;
  min-width: 0;
  color: #1f2937;
  font-weight: 500;
}

.matrix__req-name.is-clickable {
  cursor: text;
}

.matrix__req-actions {
  display: inline-flex;
  gap: 0.15rem;
  opacity: 0;
  transition: opacity 0.12s;
  flex-shrink: 0;
}

tr:hover .matrix__req-actions {
  opacity: 1;
}

.matrix__sac {
  padding: 0.55rem 0.75rem;
  text-align: center;
  min-width: 130px;
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
}

.matrix__sac-name.is-clickable {
  cursor: text;
}

.matrix__del {
  border: 0;
  background: transparent;
  color: #cbd5e1;
  padding: 0 0 0 0.35rem;
  cursor: pointer;
  vertical-align: middle;
}

.matrix__del:hover {
  color: #ef4444;
}

.matrix__ico {
  border: 0;
  background: transparent;
  color: #94a3b8;
  padding: 0.15rem;
  border-radius: 5px;
  cursor: pointer;
  line-height: 0;
}

.matrix__ico:hover {
  background: #f1f5f9;
  color: #475569;
}

.matrix__ico--danger:hover {
  background: #fef2f2;
  color: #ef4444;
}

/* Celdas */
.matrix__cell {
  width: 130px;
  height: 44px;
  text-align: center;
  vertical-align: middle;
}

.matrix__cell.is-clickable {
  cursor: pointer;
}

.matrix__cell.is-clickable:hover {
  background: #eff6ff;
}

.matrix__cell.is-on {
  background: #ecfdf5;
}

.matrix__cell.is-on:hover {
  background: #d1fae5;
}

.matrix__check {
  color: #059669;
}

.matrix__cell--pad,
.matrix__addcol {
  border-right: 0;
  background: #fff;
  width: 44px;
}

.matrix__addcol {
  background: #f8fafc;
  text-align: center;
}

.matrix__addbtn {
  border: 1px dashed #cbd5e1;
  background: #fff;
  color: #2563eb;
  border-radius: 7px;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.matrix__addbtn:hover {
  background: #eff6ff;
}

.matrix__input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.86rem;
}

.matrix__input:focus {
  outline: 2px solid #c7d2fe;
  outline-offset: -1px;
  border-color: #6366f1;
}

.matrix__edit {
  padding: 0.3rem 0.5rem;
}

.matrix__addrow th {
  padding: 0.4rem 0.9rem;
}

.matrix__empty {
  padding: 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}

.matrix__hint {
  margin-top: 0.75rem;
  font-size: 0.78rem;
  color: #94a3b8;
}
</style>
