import { describe, it, expect } from 'vitest'
import { validarRed, validarPrefijo, enlaceWhatsapp, prefijoSugerido } from './contactoParroquia'

describe('lib/contactoParroquia', () => {
  it('acepta redes vacías (no se muestran) y enlaces válidos', () => {
    expect(validarRed('instagram', '  ')).toEqual({ valor: null, error: '' })
    expect(validarRed('instagram', 'https://www.instagram.com/confirmacion_scj/').error).toBe('')
    expect(validarRed('facebook', 'https://www.facebook.com/profile.php?id=615880').error).toBe('')
  })

  it('rechaza enlaces que no son de la red', () => {
    expect(validarRed('instagram', 'instagram.com/x').error).not.toBe('')
    expect(validarRed('facebook', 'https://evil.com/facebook.com/x').error).not.toBe('')
    expect(validarRed('instagram', 'javascript:alert(1)').error).not.toBe('')
  })

  it('normaliza el prefijo', () => {
    expect(validarPrefijo('51')).toEqual({ valor: '+51', error: '' })
    expect(validarPrefijo('+593')).toEqual({ valor: '+593', error: '' })
    expect(validarPrefijo('+0').error).not.toBe('')
    expect(validarPrefijo('+12345').error).not.toBe('')
  })

  it('sugiere el prefijo según la zona horaria', () => {
    expect(prefijoSugerido('America/Bogota')).toBe('+57')
    expect(prefijoSugerido('Europe/Madrid')).toBe('+51')
  })

  it('arma el enlace de WhatsApp con el prefijo', () => {
    expect(enlaceWhatsapp('987 654 321', '+51')).toBe('https://wa.me/51987654321')
    expect(enlaceWhatsapp('3001234567', '+57')).toBe('https://wa.me/573001234567')
    expect(enlaceWhatsapp('51987654321', '+51')).toBe('https://wa.me/51987654321')
    expect(enlaceWhatsapp('', '+51')).toBeNull()
  })
})
