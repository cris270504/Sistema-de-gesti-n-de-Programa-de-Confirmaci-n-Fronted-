<script setup>
/**
 * Single button for the whole system. Consumes only the global design tokens
 * defined in src/assets/main.css (--accent, --radius-md, --shadow-*, --ease...).
 *
 * Variant mapping from the legacy classes:
 *   primary      <- .btn-primary, .btn-success (primary action, parish accent)
 *   secondary    <- .btn-secondary, .btn-outline, .btn-light, .btn-outline-secondary
 *                   (neutral bordered button)
 *   ghost        <- Cancelar-style text buttons (.exp-btn-ghost, .btn-link)
 *   danger       <- .btn-danger (solid destructive)
 *   soft-danger  <- .btn-outline-danger / .btn-icon-delete (alias of soft + tone danger)
 *   soft         <- .btn-action .btn-soft-* row actions (tinted); pick the colour with `tone`:
 *                   primary (accent), info, warning, danger, success, secondary, suggest
 * Row actions use `icon-only` + `aria-label`; icon markup can be passed in the slot.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger', 'soft', 'soft-danger'].includes(v),
  },
  tone: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'info', 'warning', 'danger', 'success', 'secondary', 'suggest'].includes(v),
  },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md'].includes(v) },
  type: { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  icon: { type: [Object, Function], default: null },
  iconOnly: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
  block: { type: Boolean, default: false },
  to: { type: [String, Object], default: null },
})

if (import.meta.env?.DEV && props.iconOnly && !props.ariaLabel) {
  console.warn('[AppButton] iconOnly buttons require the "ariaLabel" prop.')
}

const isLink = computed(() => props.to !== null && props.to !== '')
const inactive = computed(() => props.disabled || props.loading)
// Un enlace deshabilitado/cargando NO debe navegar (ni con mouse ni con teclado): se
// renderiza como <span> inerte (sin href, fuera del orden de tabulación) en vez de <a>.
const tag = computed(() => {
  if (!isLink.value) return 'button'
  return inactive.value ? 'span' : RouterLink
})
const iconSize = computed(() => (props.size === 'sm' ? 14 : 16))

const toneClass = computed(() => {
  if (props.variant === 'soft-danger') return 'app-btn--tone-danger'
  return props.variant === 'soft' ? `app-btn--tone-${props.tone}` : null
})

const classes = computed(() => [
  'app-btn',
  `app-btn--${props.variant}`,
  toneClass.value,
  `app-btn--${props.size}`,
  {
    'app-btn--icon': props.iconOnly,
    'app-btn--block': props.block,
    'is-loading': props.loading,
    'is-disabled': inactive.value,
  },
])
</script>

<template>
  <component
    :is="tag"
    v-bind="$attrs"
    :to="isLink && !inactive ? to : undefined"
    :type="isLink ? undefined : type"
    :class="classes"
    :disabled="isLink ? undefined : inactive"
    :aria-disabled="isLink && inactive ? 'true' : undefined"
    :role="isLink && inactive ? 'link' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :aria-label="ariaLabel || undefined"
  >
    <span v-if="loading" class="app-btn__spinner" aria-hidden="true"></span>
    <component :is="icon" v-else-if="icon" :size="iconSize" aria-hidden="true" />
    <slot v-else-if="iconOnly" />
    <span v-if="!iconOnly" class="app-btn__label"><slot /></span>
  </component>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--fs-ui);
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.app-btn--md { padding: 0.5rem 1rem; }
.app-btn--sm { padding: 0.3rem 0.7rem; font-size: var(--fs-sm); }
.app-btn--icon.app-btn--md { padding: 0; width: 2.25rem; height: 2.25rem; }
.app-btn--icon.app-btn--sm { padding: 0; width: 1.875rem; height: 1.875rem; }
.app-btn--block { display: flex; width: 100%; }

.app-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Disabled / loading */
/* Sin pointer-events:none: el atributo title de un botón deshabilitado explica por qué
   lo está. Los <button disabled> ya no emiten clic; el enlace inerte no tiene href. */
.app-btn:disabled,
.app-btn.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.app-btn.is-loading { cursor: progress; }

/* Primary: parish accent */
.app-btn--primary {
  background: var(--accent);
  color: #fff;
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgb(255 255 255 / 0.12);
}
.app-btn--primary:hover:not(:disabled):not(.is-disabled) {
  background: color-mix(in srgb, var(--accent), #000 8%);
  box-shadow: 0 4px 12px -2px var(--accent-ring);
  transform: translateY(-1px);
}
.app-btn--primary:active:not(:disabled):not(.is-disabled) { transform: none; }

/* Secondary: neutral bordered */
.app-btn--secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--line-strong);
}
.app-btn--secondary:hover:not(:disabled):not(.is-disabled) {
  background: var(--surface-sunken);
}

/* Ghost: text only */
.app-btn--ghost {
  background: transparent;
  color: var(--text-muted);
}
.app-btn--ghost:hover:not(:disabled):not(.is-disabled) {
  background: var(--line);
  color: var(--text);
}

/* Danger: solid */
.app-btn--danger {
  background: var(--danger);
  color: #fff;
  box-shadow: var(--shadow-sm);
}
.app-btn--danger:hover:not(:disabled):not(.is-disabled) {
  background: color-mix(in srgb, var(--danger), #000 10%);
}

/* Soft: tinted background, coloured text, fills on hover. Colour comes from --tone. */
.app-btn--soft,
.app-btn--soft-danger {
  background: color-mix(in srgb, var(--tone) 10%, transparent);
  color: var(--tone);
  border-color: color-mix(in srgb, var(--tone) 22%, transparent);
}
.app-btn--soft:hover:not(:disabled):not(.is-disabled),
.app-btn--soft-danger:hover:not(:disabled):not(.is-disabled) {
  background: var(--tone);
  color: #fff;
  border-color: var(--tone);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.app-btn--tone-primary { --tone: var(--accent); }
.app-btn--tone-info { --tone: #0891b2; }
.app-btn--tone-warning { --tone: var(--warning); }
.app-btn--tone-danger { --tone: var(--danger); }
.app-btn--tone-success { --tone: var(--success); }
.app-btn--tone-secondary { --tone: var(--text-muted); }
.app-btn--tone-suggest { --tone: #7c3aed; }
/* Dark mode: lighten the tone for text on the tinted background. */
:root[data-bs-theme="dark"] .app-btn--soft,
:root[data-bs-theme="dark"] .app-btn--soft-danger {
  color: color-mix(in srgb, var(--tone) 55%, #fff);
}
:root[data-bs-theme="dark"] .app-btn--soft:hover:not(:disabled):not(.is-disabled),
:root[data-bs-theme="dark"] .app-btn--soft-danger:hover:not(:disabled):not(.is-disabled) {
  color: #fff;
}

.app-btn__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: app-btn-spin 0.7s linear infinite;
}
@keyframes app-btn-spin { to { transform: rotate(360deg); } }
</style>
