# Verificación de la entrega

Comprobaciones ejecutadas localmente:

- Instalación de dependencias finalizada; lockfile incluido.
- Build de TypeScript y Vite correcto; rutas divididas en chunks.
- 21 pruebas correctas: parser (10), base de datos/RLS (10), exportación CSV (1).
- Auditoría npm final: 0 vulnerabilidades reportadas.
- Pantalla de configuración/acceso comprobada en navegador local.

## Archivo de aceptación

El script `scripts/verify-real.ts` leyó directamente el XLSX proporcionado, sin copiarlo al repositorio ni subirlo a servicios externos.

| Comprobación | Resultado |
| --- | --- |
| Fila de encabezados | 8 |
| Marcaciones | 115 |
| Nombres y apellidos distintos | 19 |
| Filas válidas en formato | 115 |
| Salidas faltantes | 11 |
| Salidas faltantes con duración cero | 11 |
| Diferencias entre duración reportada y entrada/salida | 48 |
| Registros con al menos una incidencia | 59 |
| Período | 2026-09-12 a 2026-09-19 |
| Exportación local | 2026-09-21 10:05 |

Las 48 diferencias adicionales no invalidan las cifras de aceptación. La duración reportada no siempre equivale a la diferencia simple entre horas; sin reglas adicionales de HikCentral no se presupone una causa. Se conserva el valor exportado y se señala para revisión. Un registro puede tener varias incidencias: los 11 sin salida también tienen duración cero.

## Alcance de la prueba de seguridad

PGlite ejecutó el SQL real, con esquemas de Auth y Storage de prueba. Se verificaron:

- Archivo duplicado rechazado y transacción sin inserciones parciales.
- Filas idénticas omitidas entre lotes.
- Correcciones conservadas con advertencia de posible duplicado.
- Datos inválidos, jornadas nocturnas y nombres ambiguos.
- Observaciones y cambios de estado auditados.
- HR sin capacidad de elevar roles.
- Usuario inactivo sin acceso a registros, vista de empleados ni archivos.
- Cliente anónimo sin acceso a tablas ni RPC de estadísticas.
- RLS habilitado y bucket privado.
- Subidas restringidas por carpeta; originales confirmados protegidos contra borrado.

## Verificación del entorno configurado

Se comprobó el acceso local de un administrador y la visualización de registros importados desde Supabase. La configuración del entorno se mantiene fuera del repositorio. Para cada nuevo entorno, deben ejecutarse la migración y el alta inicial según README y comprobar:

1. Login y logout con ADMIN y HR.
2. Subida y descarga real mediante Supabase Storage.
3. Confirmación del Excel desde el navegador.
4. Dashboard, filtros, notas y descarga CSV con datos persistidos.
5. Acceso denegado con una cuenta inactiva y un cliente anónimo.

El frontend puede desplegarse en Vercel con la configuración incluida. No existe integración directa con Odoo/HikCentral. Este documento conserva únicamente resultados agregados, sin nombres, correos ni archivos de empleados.
