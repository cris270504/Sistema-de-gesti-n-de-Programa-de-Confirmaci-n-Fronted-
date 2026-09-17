import { confirmarEliminacion, showAlerta, showErroresDeValidacion } from '@/funciones'

// Fábrica de estado/acciones CRUD compartidas por los stores de catálogo
// (roles, users, sacramentos, requisitos, grupos, reunions, confirmandos).
// Cada store combina `crudState()`/`crudActions()` (o las variantes
// paginadas) dentro de su propio `defineStore()`, y puede agregar encima
// getters y acciones propias (fetchById, acciones de negocio, etc.).
//
// No reemplaza el `defineStore` de cada store: solo evita repetir a mano el
// mismo patrón de fetchAll con caché + add/save/remove con manejo de error,
// que hasta ahora vivía duplicado casi línea por línea en 7 stores.

const FRESH_MS_DEFAULT = 30_000

export function crudState() {
  return {
    items: [],
    loading: false,
    error: null,
    lastFetch: 0,
    _inflight: null,
  }
}

/**
 * @param {object} opts
 * @param {() => Promise<any[]>} opts.list
 * @param {(payload: any) => Promise<any>} opts.create
 * @param {(id: any, payload: any) => Promise<any>} opts.update
 * @param {(id: any) => Promise<any>} opts.remove
 * @param {string} opts.entityLabel - nombre en español para los mensajes ("rol", "requisito", ...)
 * @param {(response: any) => any} [opts.extract] - saca la entidad de la respuesta de create/update (default: identidad)
 * @param {string} [opts.idKey] - nombre de la clave id (default: "id")
 * @param {number} [opts.freshMs]
 */
export function crudActions({
  list,
  create,
  update,
  remove,
  entityLabel,
  extract = (r) => r,
  idKey = 'id',
  freshMs = FRESH_MS_DEFAULT,
}) {
  return {
    async fetchAll({ force = false } = {}) {
      // Dedupe: si dos componentes montan a la vez, una sola petición.
      if (this._inflight) return this._inflight

      // Stale-while-revalidate: si la lista es reciente, no repetimos la llamada.
      if (!force && this.items.length > 0 && Date.now() - this.lastFetch < freshMs) {
        return
      }

      // Skeleton solo si todavía no hay nada que mostrar; si ya hay datos,
      // refrescamos en silencio.
      if (this.items.length === 0) this.loading = true
      this.error = null

      this._inflight = list()
        .then((data) => {
          this.items = data
          this.lastFetch = Date.now()
        })
        .catch((e) => {
          this.error = e?.message || `Error al listar ${entityLabel}s`
        })
        .finally(() => {
          this.loading = false
          this._inflight = null
        })

      return this._inflight
    },

    async add(payload) {
      try {
        const response = await create(payload)
        const created = extract(response)
        if (!created?.[idKey]) {
          throw new Error(`La API no devolvió un${entityLabel === 'rol' ? '' : ' '}${entityLabel} válido.`)
        }
        this.items.unshift(created)
        showAlerta(`${capitalize(entityLabel)} creado correctamente`, 'success')
        return created
      } catch (e) {
        showErroresDeValidacion(e)
        throw e
      }
    },

    async save(id, payload) {
      try {
        const response = await update(id, payload)
        const updated = extract(response)
        if (!updated?.[idKey]) {
          throw new Error(`La API no devolvió un${entityLabel === 'rol' ? '' : ' '}${entityLabel} actualizado.`)
        }
        const idx = this.items.findIndex((i) => i[idKey] === Number(id))
        if (idx !== -1) this.items[idx] = { ...this.items[idx], ...updated }
        showAlerta(`${capitalize(entityLabel)} actualizado correctamente`, 'success')
        return updated
      } catch (e) {
        showErroresDeValidacion(e)
        throw e
      }
    },

    async remove(id, nombre) {
      const ok = await confirmarEliminacion(nombre || `${entityLabel} con ID ${id}`)
      if (!ok) {
        showAlerta('Operación cancelada', 'info')
        return false
      }
      try {
        await remove(id)
        this.items = this.items.filter((i) => i[idKey] !== Number(id))
        showAlerta(`${capitalize(entityLabel)} eliminado correctamente`, 'success')
        return true
      } catch (e) {
        this.error = e?.message || `No se pudo eliminar el ${entityLabel}`
        showAlerta(this.error, 'error')
        return false
      }
    },
  }
}

export function paginatedCrudState({ pageSize = 25 } = {}) {
  return {
    items: [],
    loading: false,
    error: null,
    lastFetch: 0,
    lastFetchKey: null,
    _inflight: null,
    pagination: { page: 1, pageSize, total: 0 },
    filters: {},
  }
}

/**
 * Variante paginada server-side: `list({ page, pageSize, filters })` debe
 * devolver `{ items, total }`. Pensada para listas que antes traían la
 * tabla completa y paginaban/filtraban en memoria.
 *
 * @param {object} opts
 * @param {(params: { page: number, pageSize: number, filters: object }) => Promise<{ items: any[], total: number }>} opts.list
 * @param {string} opts.entityLabel
 * @param {number} [opts.freshMs]
 */
export function paginatedCrudActions({ list, entityLabel, freshMs = FRESH_MS_DEFAULT }) {
  return {
    async fetchAll({ force = false, page, pageSize, filters } = {}) {
      if (this._inflight) return this._inflight

      const filtrosCambiaron = filters !== undefined && JSON.stringify(filters) !== JSON.stringify(this.filters)
      if (filtrosCambiaron) {
        this.filters = filters
        this.pagination.page = 1
      } else if (page !== undefined) {
        this.pagination.page = page
      }
      if (pageSize !== undefined) this.pagination.pageSize = pageSize

      const key = JSON.stringify({ page: this.pagination.page, pageSize: this.pagination.pageSize, filters: this.filters })
      if (!force && this.lastFetchKey === key && Date.now() - this.lastFetch < freshMs) {
        return
      }

      if (this.items.length === 0) this.loading = true
      this.error = null

      this._inflight = list({ page: this.pagination.page, pageSize: this.pagination.pageSize, filters: this.filters })
        .then((response) => {
          this.items = response.items
          this.pagination.total = response.total
          this.lastFetch = Date.now()
          this.lastFetchKey = key
        })
        .catch((e) => {
          this.error = e?.message || `Error al listar ${entityLabel}s`
        })
        .finally(() => {
          this.loading = false
          this._inflight = null
        })

      return this._inflight
    },
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
