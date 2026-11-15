# Le Croissant · Control de asistencia

Aplicación interna para importar, revisar y analizar exportaciones de HikCentral. React, Vite, TypeScript y Tailwind CSS; Supabase Auth, PostgreSQL y Storage. No usa un backend Node, Laravel ni Express.

Proyecto académico de ingeniería de software aplicado a la gestión de asistencia. El repositorio contiene código, documentación y pruebas con datos ficticios; no distribuye archivos de empleados, cuentas personales ni credenciales. No es un producto oficial de HikCentral, Odoo o Supabase.

## 1. Instalación y ejecución

Requisitos: Node.js **24 LTS**, npm y un proyecto Supabase.

```powershell
npm install
Copy-Item .env.example .env
# Completa .env con los valores públicos de Supabase.
npm run dev
```

Abre la URL impresa por Vite, normalmente `http://127.0.0.1:5173`. Sin configuración, el acceso muestra instrucciones; no inventa datos ni permite omitir la autenticación. Reinicia Vite después de editar `.env`.

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE
```

Nunca incluir claves `secret`, `service_role` ni contraseñas de base de datos en variables `VITE_*`.

## 2. Configurar Supabase

1. En [Supabase Dashboard](https://supabase.com/dashboard), crea un proyecto y guarda su contraseña de base de datos de forma privada.
2. Copia **Project URL** y la clave pública **Publishable** o **anon** desde Connect / configuración del proyecto y API Keys. Pégalas en `.env`.
3. Abre **SQL Editor**, crea una consulta y ejecuta TODO `supabase/migrations/202611150001_attendance.sql`. Se ejecuta una sola vez en un proyecto nuevo. Crea tablas, funciones, índices, RLS, bucket privado y políticas. No necesitas crear tablas a mano.
4. En **Authentication**, habilita correo y contraseña y desactiva el registro público. Las cuentas serán creadas por el administrador.
5. En **Authentication → URL Configuration**, configura Site URL con la URL local o definitiva. Agrega `http://127.0.0.1:5173` y `http://localhost:5173` como redirect URLs de desarrollo.
6. En **Authentication → Users → Add user → Create new user**, crea el primer usuario con correo y contraseña; confirma su correo. El trigger crea automáticamente un perfil **inactivo**, sin privilegios administrativos.
7. Activa el primer administrador desde SQL Editor, reemplazando el correo:

```sql
update public.profiles
set role = 'ADMIN', active = true, full_name = 'Administrador RRHH'
where id = (select id from auth.users where email = 'tu-correo@empresa.com');
select email, role, active from public.profiles;
```

8. En **Storage**, verifica que `attendance-imports` existe y es **Private**. No lo hagas público.
9. Ejecuta `npm run dev` e inicia sesión.
10. Para usuarios adicionales, crea las cuentas desde Authentication y luego activa su acceso desde **Usuarios** en la aplicación. ADMIN puede modificar roles y desactivar otras cuentas. No puede modificar su propio acceso. Después de cambios de permisos, vuelve a iniciar sesión para actualizar el perfil visual; RLS aplica los permisos nuevos inmediatamente.

Alternativa reproducible con Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Para Supabase local con Docker: `npx supabase start`, `npx supabase db reset` y credenciales públicas de `npx supabase status`. Configuración en `supabase/config.toml`. No ejecutar reset contra datos que quieras conservar.

## 3. Estructura y rutas

```text
src/
  components/ui.tsx                 Loaders, errores, paginación, notificaciones
  features/auth/AuthProvider.tsx    Sesión y perfil
  features/imports/
    csvNormalizer.ts               Nombres, fechas, horas y minutos
    csvValidator.ts                Calidad por fila
    csvParser.ts                   CSV/XLSX, metadata y encabezados
    importService.ts               Hash, Storage y confirmación transaccional
  features/attendance/RecordDetail.tsx
  hooks/useAsync.ts                Carga y descarte de respuestas antiguas
  layouts/AppLayout.tsx            Navegación y rutas privadas
  lib/supabase.ts                  Cliente con clave pública
  pages/                          Todas las pantallas
  services/attendance.ts           Consultas, filtros, paginación y dashboard
  services/export.ts               Adaptador CSV y auditoría
  types/index.ts                  Entidades y estados
supabase/migrations/               SQL, RLS y Storage
tests/                            Parser y PostgreSQL/RLS con PGlite
scripts/verify-real.ts             Verificación local del Excel real
```

| Ruta | Función |
| --- | --- |
| `/login` | Acceso con Supabase Auth |
| `/dashboard` | Totales reales y gráficos; filtro por fechas e importación |
| `/attendance` | Búsqueda, filtros, orden y páginas de 25 filas desde PostgreSQL |
| `/issues` | Registros con incidencias, inicialmente pendientes |
| `/imports/new` | Selección/arrastre, lectura, vista previa y confirmación |
| `/imports` | Últimas 1 000 importaciones |
| `/imports/:id` | Metadata, resultado, registros y descarga privada del original |
| `/employees` | Personas detectadas y estadísticas paginadas |
| `/users` | ADMIN: activación y roles |
| `/settings` | Reglas, límites e historial de auditoría para ADMIN |

## 4. Esquema de base de datos

| Tabla | Contenido |
| --- | --- |
| `profiles` | UUID de Auth, correo, nombre, ADMIN/HR, acceso activo |
| `employees` | Nombres, búsqueda no única e IDs futuros opcionales |
| `attendance_imports` | Archivo, Storage, SHA-256 único, metadata, uploader y conteos |
| `attendance_records` | Marcación, empleado/lote, originales, fingerprint, validez, incidencias y revisión |
| `attendance_record_notes` | Observaciones inmutables con usuario y fecha |
| `attendance_record_events` | Transiciones de estado inmutables |
| `audit_logs` | Acciones importantes y contexto |

`employee_summary` es una vista `security_invoker` que respeta RLS. UUID, FK, índices de fecha/empleado/lote/estado, GIN de incidencias y triggers de actualización. `work_date`: date; horas: time; exportación local: timestamp sin zona; auditoría: timestamptz.

`branch_id` es una reserva nullable sin catálogo todavía. IDs externos, HikCentral y Odoo son nullable. El UUID interno no se presenta como ID oficial de nómina. Los nombres NO tienen restricción única.

## 5. Probar el Excel proporcionado

1. Ingresa y abre **Importaciones → Importar archivo**.
2. Selecciona el XLSX proporcionado o un CSV equivalente.
3. La muestra debe producir **115 filas**, **19 nombres distintos** y **11 salidas faltantes con duración cero**. Son criterios de esa muestra, nunca constantes de la aplicación.
4. Revisa la metadata, luego pulsa **Importar registros**. El servidor vuelve a validar y confirma el lote en una transacción.
5. Consulta Marcaciones, abre una incidencia, agrega una observación y guarda un estado de revisión.
6. Vuelve a subir el mismo archivo: aparece la advertencia de duplicado.

Verificación local sin subir datos:

```powershell
npm run test:real -- "RUTA_LOCAL/archivo-de-aceptacion.xlsx"
```

La muestra real no está copiada al repositorio ni publicada. Los tests usan nombres ficticios.

## 6. Parser, calidad e identidad

CSV reconoce coma, punto y coma o tabulación desde el encabezado; soporta BOM UTF-8 y alternativa Windows-1252. XLSX usa la primera hoja mediante `read-excel-file`. Se buscan dinámicamente los seis encabezados, incluso reordenados y después de metadata. Se omiten filas completamente vacías.

`08 : 43` → 523 minutos. Salida `-` o vacía → null y `MISSING_CHECK_OUT`. Duración cero → `ZERO_DURATION`. Fechas se conservan como YYYY-MM-DD sin conversión accidental de zona horaria. Nombres originales permanecen en `raw_first_name`, `raw_last_name` y `raw_row`; búsqueda normaliza espacios y tildes.

Incidencias: `INVALID_DATE`, `INVALID_CHECK_IN`, `INVALID_CHECK_OUT`, `INVALID_DURATION`, `MISSING_CHECK_OUT`, `ZERO_DURATION`, `DURATION_MISMATCH`, `POSSIBLE_DUPLICATE`, `EMPLOYEE_MATCH_REQUIRED`, `NEEDS_EMPLOYEE_REVIEW`.

22:00–06:00 se interpreta como 480 minutos. No se calculan tardanzas, ausencias ni horas extra. Duraciones de más de 24 horas se señalan como diferencias; no se adivina una fecha de salida.

**Filas inválidas:** se preservan con `valid=false`, campos normalizados inválidos en null e incidencias para revisión. No suman horas al dashboard. Corrige el archivo en origen y vuelve a importarlo; la aplicación no sobrescribe marcaciones originales. Marcar resuelto no modifica valores ni borra incidencias de origen.

**Matching:** nombre y apellido son una clave provisional. Múltiples coincidencias activas dejan `employee_id=null` y `NEEDS_EMPLOYEE_REVIEW`. Sin identificadores oficiales no hay conciliación automática confiable de homónimos.

**Revisión:** filas normales empiezan revisadas; incidencias, pendientes. Se puede marcar revisado/resuelto/ignorado. Cada nota y cambio conserva usuario y fecha; no hay borrado del histórico.

## 7. Duplicados y transacciones

- SHA-256 del archivo completo, comprobado antes de subir y protegido por índice único en SQL.
- Fingerprint calculado en PostgreSQL con valores normalizados: omite filas idénticas incluso entre archivos distintos.
- Mismo nombre, fecha y entrada con datos distintos: conserva `POSSIBLE_DUPLICATE` para comparar, sin sobrescribir.
- Bloqueo transaccional serializa importaciones y evita carreras de matching y deduplicación.
- Storage se sube antes de la transacción. Al fallar SQL, se intenta eliminar el huérfano. Una interrupción de red puede dejar un huérfano para limpieza administrativa. Originales confirmados no pueden eliminarse desde el cliente.
- Reintentar después de perder una respuesta detecta el checksum si el lote ya fue confirmado.

`valid_rows` cuenta filas válidas procesadas, incluidos duplicados omitidos. `issue_rows` cuenta nuevas filas insertadas con incidencias. `inserted_rows + duplicate_rows = total_rows`. Horas son duraciones válidas importadas, no nómina: posibles correcciones se conservan y pueden sumar hasta que exista un proceso empresarial de conciliación.

## 8. Seguridad y auditoría

RLS en las siete tablas; sin INSERT/UPDATE/DELETE directo para clientes. RPC privilegiados verifican usuario y perfil activo y fijan search_path. Ningún cliente puede elevar su propio rol. Una cuenta de Auth pendiente no puede consultar marcaciones ni archivos.

Bucket `attendance-imports` privado, hasta 20 MB. Subidas solo bajo carpeta del propio usuario, sin sobreescritura. Descargas mediante URL firmada por 60 segundos.

Auditoría: FILE_UPLOADED, IMPORT_CONFIRMED, RECORD_REVIEWED, RECORD_RESOLVED, NOTE_ADDED, EXPORT_GENERATED y USER_UPDATED. FILE_UPLOADED se registra al confirmar el lote, no para cargas abandonadas. La exportación se audita antes de entregar el archivo; no puede verificarse que el navegador lo haya guardado.

Referencias: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones](https://supabase.com/docs/guides/database/functions), [Storage](https://supabase.com/docs/guides/storage/security/access-control).

## 9. Exportación

**Exportar registros** descarga todos los resultados filtrados, no solo la página visible. Incluye nombre, apellido, fecha, entrada, salida, duración, calidad, revisión y observaciones con fechas. UTF-8 con BOM, escapado correcto y protección contra fórmulas CSV.

El adaptador está en `src/services/export.ts`. Un futuro `OdooExportAdapter` implementará `ExportAdapter` con el mapping oficial. **Este CSV no está certificado como compatible con Odoo.** Evita importaciones simultáneas durante una exportación masiva: la paginación REST no representa una instantánea transaccional única.

## 10. Pruebas y despliegue

```powershell
npm test
npm run build
npm run preview
```

Tests de parser y PostgreSQL embebido PGlite ejecutando la migración real, con esquemas Auth/Storage simulados. Verifican RLS, roles, transacciones, deduplicación, fechas inválidas, medianoche y auditoría. No reemplazan el ensayo final en tu Supabase: prueba acceso, carga/descarga con ADMIN, HR, usuario inactivo y cliente anónimo.

Producción: despliega `dist/` en un host estático HTTPS con fallback de rutas a `index.html`. Variables públicas antes del build y URL definitiva en Supabase Auth. No se publican automáticamente archivos de asistencia ni datos personales.

### Vercel

La configuración de `vercel.json` usa Vite, `npm ci`, `npm run build` y el directorio `dist`. Incluye el fallback de React Router para abrir directamente `/dashboard`, `/issues` y las demás rutas. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las variables del proyecto Vercel, nunca en el repositorio. Usa Node.js 24.x.

El sitio público muestra el acceso; consultar registros requiere una cuenta activa y autorizada en Supabase. Las variables `VITE_*` son públicas en el bundle por diseño: solo se admiten URL y clave publishable/anon. Ninguna contraseña ni clave privilegiada debe incorporarse al frontend. Para evaluación académica, usa cuentas autorizadas y registros ficticios; los datos de un entorno privado no forman parte del entregable público.

## 11. Límites y segunda fase

- No hay APIs de lectores/HikCentral/Odoo, biometría, horarios supuestos, tardanzas ni horas extra.
- Límite de 10 000 filas y 20 MB por importación; primera hoja XLSX. Períodos mayores deben dividirse; a futuro puede usarse una Edge Function por lotes.
- Altas de cuentas y recuperación administrativa de contraseñas se gestionan en Supabase Auth. La aplicación administra roles y activación.
- Historial muestra hasta 1 000 lotes; empleados y marcaciones se paginan en servidor; dashboard agrega en SQL sin truncamiento REST.
- La empresa debe proporcionar: identificadores oficiales y reglas de homónimos, sucursales, horarios y tolerancias aprobadas, reglas de permisos/incapacidades/vacaciones, formato oficial de nómina/Odoo y acceso autorizado a las APIs.
- Las siguientes tablas podrán relacionarse por employee_id: planned_shifts, sucursales y justificaciones. Solo entonces podrán calcularse tardanzas, ausencias y horas extra.
