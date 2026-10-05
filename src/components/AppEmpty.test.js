import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import AppEmpty from './AppEmpty.vue'

const Icon = { name: 'FakeIcon', render: () => h('svg', { 'data-test': 'icon' }) }

describe('AppEmpty', () => {
  it('uses the global empty-state class and shows the message', () => {
    const w = mount(AppEmpty, { props: { message: 'No hay grupos registrados.' } })
    expect(w.classes()).toContain('empty-state')
    expect(w.text()).toContain('No hay grupos registrados.')
  })

  it('renders the icon (hidden from assistive tech) when provided', () => {
    const w = mount(AppEmpty, { props: { message: 'Vacío', icon: Icon } })
    expect(w.find('[data-test="icon"]').exists()).toBe(true)
    expect(w.find('.empty-state__icon').attributes('aria-hidden')).toBe('true')
  })

  it('renders the action slot only when given', () => {
    expect(mount(AppEmpty, { props: { message: 'x' } }).find('.empty-state__action').exists()).toBe(false)
    const w = mount(AppEmpty, { props: { message: 'x' }, slots: { default: '<button>Crear</button>' } })
    expect(w.find('.empty-state__action button').text()).toBe('Crear')
  })

  it('applies the compact modifier', () => {
    expect(mount(AppEmpty, { props: { message: 'x', compact: true } }).classes()).toContain('empty-state--compact')
  })
})
