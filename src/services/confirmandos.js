import api from '@/lib/api'

export function getConfirmandosList() {
  return api.get('/confirmandos').then(res => res.data)
}

export function getConfirmandoById(id) {
  return api.get(`/confirmandos/${id}`).then(res => res.data)
}

export function createConfirmando(confirmando) {
  return api.post('/confirmandos', confirmando).then(res => res.data)
}

export function obtenerPerfilConfirmando(id){
  return api.get(`/confirmandos/${id}/perfil`).then(res => res.data)
}

export function updateConfirmando(id, confirmando) {
  return api.put(`/confirmandos/${id}`, confirmando).then(res => res.data)
}

export function deleteConfirmandoById(id) {
  return api.delete(`/confirmandos/${id}`).then(res => res.data)
}

export function retirarConfirmandoById(id) {
  return api.put(`/confirmandos/${id}/retirar`).then(res => res.data);
}

export function getConfirmandosStats() {
  return api.get('/confirmandos/retention-stats').then(res => res.data);
}

export function importarConfirmandosExcel(formData) {
    // Agregamos el header para que Laravel sepa que viene un archivo
    return api.post('/confirmandos/importar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(res => res.data);
}

export const exportarConfirmandosExcel = async () => {
    // Para descargas de archivos, usamos 'blob' como tipo de respuesta
    const response = await api.get('/confirmandos/exportar', { responseType: 'blob' });
    
    // Creamos un link temporal para descargar el archivo
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Confirmandos_por_Grupos.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
};

