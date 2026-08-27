<script setup>
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, default: undefined },
  placeholder: { type: String, default: '••••••••' },
  autocomplete: { type: String, default: 'current-password' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  minlength: { type: [Number, String], default: undefined },
  inputClass: { type: [String, Array, Object], default: '' },
})
defineEmits(['update:modelValue'])

const visible = ref(false)
</script>

<template>
  <div class="pf">
    <input
      :id="id"
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :required="required"
      :minlength="minlength"
      class="pf__input"
      :class="inputClass"
      @input="$emit('update:modelValue', $event.target.value)"
    >
    <button
      type="button"
      class="pf__toggle"
      :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      :title="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
      tabindex="-1"
      :disabled="disabled"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" :size="17" />
      <Eye v-else :size="17" />
    </button>
  </div>
</template>

<style scoped>
.pf {
  position: relative;
}
.pf__input {
  width: 100%;
  padding-right: 2.75rem;
}
.pf__toggle {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}
.pf__toggle:hover:not(:disabled) {
  color: #475569;
  background: #f1f5f9;
}
.pf__toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
