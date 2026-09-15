# Paginación de listas — plan (no implementado todavía)

## Por qué no lo apuré

Las listas (`getConfirmandosList`, y por el mismo patrón usuarios/grupos/
asistencias) traen la tabla completa con un solo `.select()` sin `.range()`.
Convertir esto a paginación real rompe algo que hoy funciona: el buscador de
cada lista filtra **en el cliente** sobre el array completo ya cargado (ver
`filterQuery`/`filteredPendientes` en `ListJustificaciones.vue` como
ejemplo del patrón repetido en las demás listas). Si solo pagino la carga
inicial sin tocar el buscador, el buscador deja de encontrar resultados que
no estén en la página actual — un bug silencioso, peor que el problema
original. Por eso esto queda como plan, no como cambio de esta sesión: tocar
mal el patrón de búsqueda en varias pantallas sin poder probarlas en vivo es
más riesgo del que vale la pena correr sin testing real.

## El patrón a aplicar (cuando se haga)

Por cada lista (empezar por Confirmandos, es la más grande hoy: ~100 filas
por parroquia y va a crecer con los años de programa):

1. **El buscador pasa a ser server-side.** El servicio recibe `{ q, page,
   pageSize }` y arma el filtro con `.or('nombres.ilike...,apellidos.ilike...')`
   + `.range((page-1)*pageSize, page*pageSize - 1)` en vez de traer todo y
   filtrar en el store/computed.
2. **El store guarda `items`, `total`, `page`, `pageSize`** en vez de asumir
   que `items` es la lista completa. Cualquier código que hoy calcula cosas
   sobre `pendientes.value`/`confirmandos.value` completo (contadores,
   agrupaciones) hay que revisarlo: si dependía de tener TODA la lista en
   memoria, necesita su propia consulta agregada (`count`, `group by`) en
   vez de derivarse del array paginado.
3. **UI**: controles de paginación (siguiente/anterior o "cargar más") en
   vez de renderizar todo de una. `vue3-easy-data-table` (ya es dependencia
   del proyecto) trae paginación server-side de fábrica — vale la pena
   evaluarlo antes de escribir controles a mano.
4. **Probar en vivo** buscador + paginación + los contadores/exports que
   dependan de la lista completa (ej. `exportarConfirmandosExcel` sigue
   necesitando TODA la data, no la página — eso se queda como una consulta
   aparte sin `.range()`).

## Orden sugerido

1. Confirmandos (la más visitada, la más grande).
2. Usuarios.
3. Asistencias / matriz (`fn_asistencia_matriz`) — ya construye un JSON
   grande en una sola llamada; conviene acotarlo por reunión/mes en vez de
   traer todo el historial, no solo paginar el resultado ya armado.
4. El resto, a demanda (si una parroquia grande empieza a sentir lentitud
   en una lista puntual).
