import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { h } from 'vue'
import AppButton from './AppButton.vue'

const Icon = { name: 'FakeIcon', render: () => h('svg', { 'data-test': 'icon' }) }

describe('AppButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders the slot text inside a button', () => {
    const w = mount(AppButton, { slots: { default: 'Guardar' } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.text()).toBe('Guardar')
  })

  it('defaults to type="button"', () => {
    expect(mount(AppButton).attributes('type')).toBe('button')
  })

  it('allows type="submit"', () => {
    expect(mount(AppButton, { props: { type: 'submit' } }).attributes('type')).toBe('submit')
  })

  it('applies variant and size classes (primary/md by default)', () => {
    const def = mount(AppButton)
    expect(def.classes()).toContain('app-btn--primary')
    expect(def.classes()).toContain('app-btn--md')
    const w = mount(AppButton, { props: { variant: 'soft-danger', size: 'sm' } })
    expect(w.classes()).toContain('app-btn--soft-danger')
    expect(w.classes()).toContain('app-btn--sm')
  })

  it('adds the block class', () => {
    expect(mount(AppButton, { props: { block: true } }).classes()).toContain('app-btn--block')
  })

  it('loading disables the button, sets aria-busy and shows a spinner', () => {
    const w = mount(AppButton, { props: { loading: true }, slots: { default: 'Guardar' } })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.attributes('aria-busy')).toBe('true')
    expect(w.find('.app-btn__spinner').exists()).toBe(true)
  })

  it('does not set aria-busy nor spinner when idle', () => {
    const w = mount(AppButton)
    expect(w.attributes('aria-busy')).toBeUndefined()
    expect(w.find('.app-btn__spinner').exists()).toBe(false)
  })

  it('shows the icon when not loading and replaces it with the spinner when loading', () => {
    expect(mount(AppButton, { props: { icon: Icon } }).find('[data-test="icon"]').exists()).toBe(true)
    const w = mount(AppButton, { props: { icon: Icon, loading: true } })
    expect(w.find('[data-test="icon"]').exists()).toBe(false)
    expect(w.find('.app-btn__spinner').exists()).toBe(true)
  })

  it('propagates click when enabled', async () => {
    const onClick = vi.fn()
    const w = mount(AppButton, { attrs: { onClick } })
    await w.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire click when disabled or loading', async () => {
    const onClick = vi.fn()
    await mount(AppButton, { props: { disabled: true }, attrs: { onClick } }).trigger('click')
    await mount(AppButton, { props: { loading: true }, attrs: { onClick } }).trigger('click')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('iconOnly uses aria-label and hides the slot text', () => {
    const w = mount(AppButton, {
      props: { iconOnly: true, ariaLabel: 'Cerrar', icon: Icon },
      slots: { default: 'Cerrar' },
    })
    expect(w.attributes('aria-label')).toBe('Cerrar')
    expect(w.classes()).toContain('app-btn--icon')
    expect(w.find('[data-test="icon"]').exists()).toBe(true)
    expect(w.find('.app-btn__label').exists()).toBe(false)
  })

  it('warns in dev when iconOnly has no ariaLabel', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(AppButton, { props: { iconOnly: true, icon: Icon } })
    expect(warn).toHaveBeenCalled()
  })

  it('passes attrs through (data-bs-dismiss, title)', () => {
    const w = mount(AppButton, { attrs: { 'data-bs-dismiss': 'modal', title: 'Cancelar' } })
    expect(w.attributes('data-bs-dismiss')).toBe('modal')
    expect(w.attributes('title')).toBe('Cancelar')
  })

  it('renders a router-link when "to" is given', () => {
    const w = mount(AppButton, {
      props: { to: '/grupos' },
      slots: { default: 'Volver' },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const link = w.findComponent(RouterLinkStub)
    expect(link.exists()).toBe(true)
    expect(link.props('to')).toBe('/grupos')
    expect(link.classes()).toContain('app-btn')
  })

  it('soft variant applies the tone class (default primary)', () => {
    const def = mount(AppButton, { props: { variant: 'soft' } })
    expect(def.classes()).toContain('app-btn--soft')
    expect(def.classes()).toContain('app-btn--tone-primary')
    const w = mount(AppButton, { props: { variant: 'soft', tone: 'warning' } })
    expect(w.classes()).toContain('app-btn--tone-warning')
  })

  it('soft-danger keeps working as soft + danger tone', () => {
    const w = mount(AppButton, { props: { variant: 'soft-danger' } })
    expect(w.classes()).toContain('app-btn--soft-danger')
    expect(w.classes()).toContain('app-btn--tone-danger')
  })

  it('does not add a tone class for non-soft variants', () => {
    expect(mount(AppButton, { props: { variant: 'primary', tone: 'warning' } }).classes().join(' ')).not.toContain('tone')
  })

  it('iconOnly renders slot content (icon markup) when no icon prop is given', () => {
    const w = mount(AppButton, {
      props: { iconOnly: true, ariaLabel: 'Editar' },
      slots: { default: '<svg data-test="slot-icon"></svg>' },
    })
    expect(w.find('[data-test="slot-icon"]').exists()).toBe(true)
  })

  it('iconOnly shows the spinner instead of slot content while loading', () => {
    const w = mount(AppButton, {
      props: { iconOnly: true, ariaLabel: 'Editar', loading: true },
      slots: { default: '<svg data-test="slot-icon"></svg>' },
    })
    expect(w.find('[data-test="slot-icon"]').exists()).toBe(false)
    expect(w.find('.app-btn__spinner').exists()).toBe(true)
  })

  it('router-link variant is not disabled natively but reports aria-disabled', () => {
    const w = mount(AppButton, {
      props: { to: '/x', disabled: true },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(w.attributes('aria-disabled')).toBe('true')
  })
})
