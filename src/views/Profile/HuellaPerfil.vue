<script setup>
// "Mi perfil" → Inicio con huella: activar en este dispositivo, ver y quitar
// los dispositivos registrados (passkeys de Supabase Auth).
import { onMounted, ref } from 'vue'
import { Fingerprint, Trash, Smartphone } from 'lucide-vue-next'
import AppButton from '@/components/AppButton.vue'
import { showAlerta, confirmar } from '@/funciones'
import {
  dispositivoCompatible, listarPasskeys, registrarPasskey, eliminarPasskey, mensajePasskey,
} from '@/lib/passkeys'

const compatible = ref(false)
const cargando = ref(true)
const errorCarga = ref('')
const dispositivos = ref([])
const activando = ref(false)
const quitando = ref(null)

const fmt = (iso) => iso
  ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    dispositivos.value = await listarPasskeys()
  } catch (e) {
    errorCarga.value = mensajePasskey(e) || 'No se pudieron cargar tus dispositivos.'
  } finally {
    cargando.value = false
  }
}

async function activar() {
  activando.value = true
  try {
    await registrarPasskey()
    showAlerta('Huella activada en este dispositivo.', 'success')
    await cargar()
  } catch (e) {
    const msg = mensajePasskey(e)
    if (msg) showAlerta(msg, 'error')
  } finally {
    activando.value = false
  }
}

async function quitar(d) {
  const ok = await confirmar({
    titulo: `¿Quitar «${d.friendly_name || 'este dispositivo'}»?`,
    texto: 'Ya no podrás entrar con la huella de ese dispositivo. Tu contraseña sigue funcionando.',
    icono: 'warning',
    confirmarTexto: 'Sí, quitar',
  })
  if (!ok) return
  quitando.value = d.id
  try {
    await eliminarPasskey(d.id)
    dispositivos.value = dispositivos.value.filter((x) => x.id !== d.id)
    showAlerta('Dispositivo quitado.', 'success')
  } catch (e) {
    showAlerta(mensajePasskey(e) || 'No se pudo quitar el dispositivo.', 'error')
  } finally {
    quitando.value = null
  }
}

onMounted(async () => {
  compatible.value = await dispositivoCompatible()
  await cargar()
})
</script>

<template>
  <section class="surface surface--pad" aria-labelledby="huella-titulo">
    <header class="hp-head">
      <span class="hp-head__icon" aria-hidden="true"><Fingerprint :size="18" /></span>
      <h2 id="huella-titulo" class="hp-head__title">Inicio con huella</h2>
    </header>

    <p class="hp-nota">
      Entra sin escribir tu DNI ni tu contraseña, con la huella, el rostro o el PIN del dispositivo.
      Tu contraseña sigue funcionando.
    </p>

    <p v-if="cargando" class="hp-nota" aria-live="polite">Cargando dispositivos…</p>
    <p v-else-if="errorCarga" class="hp-error" role="alert">{{ errorCarga }}</p>

    <ul v-else-if="dispositivos.length" class="hp-lista">
      <li v-for="d in dispositivos" :key="d.id" class="hp-item">
        <Smartphone :size="18" class="hp-item__icono" aria-hidden="true" />
        <div class="hp-item__texto">
          <strong>{{ d.friendly_name || 'Dispositivo' }}</strong>
          <span>Agregado {{ fmt(d.created_at) }} · Último uso {{ fmt(d.last_used_at) }}</span>
        </div>
        <AppButton variant="soft" tone="danger" icon-only :loading="quitando === d.id"
          :aria-label="`Quitar ${d.friendly_name || 'dispositivo'}`" title="Quitar" @click="quitar(d)">
          <Trash :size="16" />
        </AppButton>
      </li>
    </ul>
    <p v-else class="hp-nota">Aún no tienes dispositivos registrados.</p>

    <div class="hp-acciones">
      <AppButton v-if="compatible" :icon="Fingerprint" :loading="activando" @click="activar">
        {{ activando ? 'Esperando al dispositivo…' : 'Activar en este dispositivo' }}
      </AppButton>
      <p v-else class="hp-nota">
        Este dispositivo no tiene huella ni reconocimiento facial compatible. Puedes activarla desde tu celular.
      </p>
    </div>
  </section>
</template>

<style scoped>
.hp-head {
  display: flex; align-items: center; gap: 0.6rem;
  padding-bottom: 0.9rem; margin-bottom: 1.1rem; border-bottom: 1px solid var(--line);
}
.hp-head__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: var(--radius-md);
  background: var(--accent-soft); color: var(--accent);
}
.hp-head__title { font-size: var(--fs-base); font-weight: 700; color: var(--text); margin: 0; }
.hp-nota { font-size: var(--fs-sm); color: var(--text-muted); margin: 0 0 0.9rem; }
.hp-error { font-size: var(--fs-sm); color: #dc2626; margin: 0 0 0.9rem; }
.hp-lista { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.hp-item {
  display: flex; align-items: center; gap: 0.75rem; min-height: 52px;
  padding: 0.55rem 0.75rem; border: 1px solid var(--line); border-radius: var(--radius-md);
}
.hp-item__icono { color: var(--text-muted); flex-shrink: 0; }
.hp-item__texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.hp-item__texto strong { font-size: var(--fs-sm); color: var(--text); overflow-wrap: anywhere; }
.hp-item__texto span { font-size: var(--fs-xs); color: var(--text-muted); }
.hp-acciones { display: flex; justify-content: flex-end; }
</style>
