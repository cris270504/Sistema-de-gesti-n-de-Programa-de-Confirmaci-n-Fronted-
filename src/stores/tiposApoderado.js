import { defineStore } from 'pinia'
import { getTiposApoderadoList } from '../services/tiposApoderado'
import { showAlerta } from '@/funciones'

export const useTiposApoderadoStore = defineStore('tiposApoderado', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
    }),

    getters: {
        byId: (state) => (id) => state.items.find(t => t.id === Number(id)),
    },

    actions: {
        async fetchAll() {
            if (this.items.length > 0) return;

            this.loading = true;
            this.error = null;
            try {
                this.items = await getTiposApoderadoList();
            } catch (e) {
                this.error = e?.message || 'Error al cargar tipos de apoderado';
                console.error(this.error);
                showAlerta('No se pudieron cargar los tipos de parentesco', 'error');
            } finally {
                this.loading = false;
            }
        }
    }
})