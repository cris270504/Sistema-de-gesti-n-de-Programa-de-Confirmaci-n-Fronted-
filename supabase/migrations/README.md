# Migraciones SQL

Este directorio empezó a existir el 2026-09-13. Todo el esquema anterior a esa
fecha no tiene historial en git — vive solo en la base de datos de producción.
A partir de acá, **todo cambio de esquema/función/policy se escribe primero
como un archivo `.sql` acá, se commitea, y recién después se corre a mano en
el SQL Editor de Supabase** (no hay pipeline automático todavía — ver más
abajo).

## Cómo nombrar un archivo nuevo

`YYYYMMDDHHmmss_descripcion_corta.sql`, timestamp del momento en que se
escribe (no hace falta que sea exacto, solo que ordene cronológicamente).

## Cómo aplicar un archivo

1. Escribilo acá primero, commiteá.
2. Copiá el contenido completo al SQL Editor de Supabase y corré.
3. Si falla a mitad de camino, **no reintentes a ciegas**: mirá qué se aplicó
   parcialmente (`CREATE OR REPLACE FUNCTION`/`ALTER TABLE ... ADD COLUMN IF
   NOT EXISTS` son seguros de re-correr; un `DROP` + `CREATE` a mitad de
   camino puede dejar el objeto inexistente).
4. Si el cambio toca una función `SECURITY DEFINER` o políticas de RLS,
   corré también `supabase/tests/` relevante (ver ese directorio) antes de
   dar el cambio por bueno.

## Limitación conocida: no hay staging

Hoy no existe un segundo proyecto Supabase para probar antes de producción.
Cada migración de este directorio se aplicó directo a producción con
usuarios reales conectados. Esto ya causó 2 incidentes menores en esta
sesión (un `GRANT` faltante, un tipo de columna mal declarado en un
`RETURNS TABLE`) — ninguno grave porque se detectaron rápido, pero un
proyecto de staging los habría atajado antes de que fueran visibles.

Pendiente (requiere acceso al dashboard de Supabase, no ejecutable por
Claude): crear un proyecto de staging, replicar el esquema ahí, y correr las
migraciones nuevas primero contra ese proyecto.
