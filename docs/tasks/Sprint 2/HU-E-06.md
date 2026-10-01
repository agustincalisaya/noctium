# TASK: HU-E-06 — Registrar resultados de exámenes

**Módulo:** E (Atención académica / Historial) · **Sprint:** 2 · **SP estimado:** 2  
**Contrato de referencia:** `docs/specs/spec_modulo_E.md` §§1, 2.2, 2.4, 3.1, 3.5 y 4 · `spec_modulo_A.md` §2.4 · `spec_modulo_B.md` §2.8 · `spec_modulo_D.md` §2.8 · `spec_modulo_L.md` · `docs/RULES.md` Reglas 2–8, 10 y 11  
**Pantalla:** ficha del alumno, tab «Historial académico»; `Dialog`, mapa Sprint 2 §2 y §4; mockup de referencia, pág. 19.  
**RBAC:** permiso existente `examenes:registrar` (MESA_ENTRADA, PROFESOR); no se crean permisos.  
**Schema:** `ResultadoExamen` y parámetros de escala ya están migrados; esta ampliación agrega `observaciones` opcional con migración aditiva.

**Estado:** implementación y verificación completadas en `feature/hu-e-06`, apilada sobre `feature/hu-e-05`. Pasan TypeScript, ESLint y la suite completa. Se verificaron interfaz, API y persistencia usando Playwright/Chromium y una base PostgreSQL temporal.

---

## 0. Relevamiento previo a implementación

Relevamiento común autorizado por el usuario en la solicitud original; HU-E-06 se integra después de HU-E-05 para añadir su formulario al tab académico.

- Base revisada: `develop` en `830d4b4`; rama de publicación `feature/hu-e-06`, apilada sobre `feature/hu-e-05`.
- Archivos backend compartidos del lote: `src/types/historial.types.ts`; `src/server/historial/resultado-examen.service.ts`, `historial.service.ts`, `historial.publico.ts`, `resultado-examen.schema.ts`, `historial.schema.ts`; `src/server/materias/materia.publico.ts`; rutas `/api/alumnos/[id]/examenes`, `/api/alumnos/[id]/examenes/opciones` y `/api/alumnos/[id]/historial`.
- Archivos frontend compartidos: `src/app/(dashboard)/alumnos/[id]/page.tsx` y los nuevos `historial-academico.tsx`, `registrar-resultado-examen-dialog.tsx`; el listado usa `src/components/shared/pagination.tsx` con presentación ampliada opcional.
- A/B/D ofrecen los servicios requeridos. El contrato de `obtenerMateriasPorIds()` ya está publicado en `spec_modulo_L.md` §2.5 y su lectura pública está disponible desde HU-E-05. No crea una HU-L-03 ni habilita consultas directas a la tabla desde E.
- Aclaración de alcance solicitada el 30/09/2026: se incorpora «Observaciones» opcional del mockup pág. 19, se persiste en el resultado y aparece debajo del examen en la línea de tiempo. Se actualizan conjuntamente el contrato de §2.2, el modelo y la migración.

## 1. Nota de alcance

El examen se registra en la ficha del alumno y no está asociado a un turno particular. La materia debe estar respaldada por al menos una clase dictada de ese alumno. Cada resultado es un nuevo hecho inmutable.

**Fuera de alcance:** reemplazar notas anteriores, correcciones/anulación, promedios y aprobado/desaprobado.

## 2. Historia de Usuario

**Como** personal de mesa de entrada o el propio profesor,  
**necesito** registrar la nota de un examen para un alumno en una materia,  
**para** dejar constancia del resultado en su historial académico.

**SP estimado:** 2.

**Criterios de aceptación:**

1. Desde «Historial académico», solicitar materia cursada, fecha y nota dentro de la escala del centro; permitir ingresar observaciones opcionales.
2. Rechazar valores fuera de rango con un mensaje específico.
3. Permitir más de un examen por materia; nunca reemplazar uno previo.
4. Informar «Resultado registrado correctamente» y reflejarlo en el historial.
5. No calcular promedios ni condición académica.

## 3. Alcance de esta task

Crear POST de alta y GET de opciones; validar en Zod y servicio; mostrar el `Dialog` desde el tab existente. Alcance de Profesor se determina desde la sesión y `profesorAtendioAlumno()`, nunca desde un id enviado por el cliente.

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/historial/resultado-examen.schema.ts`. Seguir el contrato estricto de `spec_modulo_E.md` §2.2: materia, fecha calendario, nota decimal en string (hasta un decimal, coma decimal normalizada en UI) y `observaciones` opcional. No admitir otros campos.

### 4.2. Servicio y rutas

**Archivo:** `src/server/historial/resultado-examen.service.ts`  
**Funciones:** `registrarResultadoExamen()` y `listarOpcionesExamen()`.

- `POST /api/alumnos/[id]/examenes` — `examenes:registrar`.
- `GET /api/alumnos/[id]/examenes/opciones` — mismo permiso; materias cursadas, incluyendo dadas de baja, ordenadas por nombre; escala desde `ParametroSistema`.
- En transacción: alcance del profesor antes de revelar existencia; `verificarAlumnoActivo()`; validar materia cursada mediante el módulo E; fecha no futura en Buenos Aires; validar nota 1–10, hasta un decimal; insertar registro nuevo junto con observaciones opcionales (vacías se guardan como `NULL`).
- `201` al registrar. Errores contractuales: `403`, `404 ALUMNO_NO_ENCONTRADO`, `409 ALUMNO_INACTIVO`, `MATERIA_NO_CURSADA`, `400 FECHA_EXAMEN_FUTURA`, `422 NOTA_FUERA_DE_RANGO`.
- Consumir `obtenerMateriasPorIds()` de L una vez disponible; nunca consultar `materia` desde E.

### 4.3. Trazabilidad

Opción (a): `createdAtResultadoExamen` y `creadoPorUsuarioId`. Los resultados no admiten corrección desde esta task.

## 5. Frontend

- En `/alumnos/[id]` → tab «Historial académico», mostrar «Registrar resultado de examen» solo si el permiso existe.
- Dialog con materia cursada, fecha, nota, observaciones opcionales, validación visible y estados de guardado/error; las observaciones aparecen debajo del examen en la línea de tiempo.
- Toast literal «Resultado registrado correctamente» y actualización de la línea de tiempo.
- Seguir tokens y controles existentes (`docs/DESIGN.md` §6.1; mapa §4); no crear ruta o pantalla independiente.

## 6. Testing (evidencia ejecutada)

### Nivel 1 — Unitarios

- Opciones por alumno sin clases/con materias cursadas; restricción de profesor; alumno inexistente/inactivo; fecha futura; decimal válido y fuera de rango; resultados repetidos.

### Nivel 2 — API (Playwright autenticado; contratos equivalentes a la colección Postman)

- Opciones y alta autorizadas; payload inválido; errores 403/404/409/422; varios resultados de la misma materia.

### Nivel 3 — BD / SQL directo y navegador

- Verificar Decimal(4,1), fecha, auditoría y persistencia de filas separadas; evidencia visual del dialog y del resultado en el historial.

### Evidencia — 2026-09-30 (Playwright / Chromium y PostgreSQL temporal)

- El dialog cargó «Programación I» como materia con clase dictada para la alumna y tomó la fecha local actual.
- La nota `11` fue rechazada por el API con `422 NOTA_FUERA_DE_RANGO` y el mensaje «La nota debe estar entre 1 y 10»; luego `8,5` se guardó con `201` y apareció como `8,5 / 10` en el historial.
- La vista ordenó el examen por encima de la clase anterior; la verificación de almacenamiento y auditoría se detalla a continuación.
- 7 unitarios cubren opciones válidas, orden de materias, alcance del profesor, múltiples notas, límites de nota, fecha futura, materia no cursada y normalización de observaciones opcionales.
- Las opciones de examen devolvieron `200` y «Matemática» para un alumno atendido por el profesor; para un alumno fuera de su alcance devolvieron `403 SIN_PERMISO`.
- Se registraron diez notas de prueba separadas por HTTP autenticado para ejercitar la paginación E-05; la base aislada las mantuvo como filas distintas, sin reemplazar resultados anteriores.
- SQL confirmó que `notaExamen` tiene tipo `numeric(4,1)`, las diez filas conservan sus fechas, valores y `creadoPorUsuarioId`, y sus notas van de 1.0 a 10.0. Las filas fueron creadas por el usuario de Mesa de Entrada del contexto de prueba.
- No se ejecutó Postman como aplicación: el alta, opciones y respuestas de error se comprobaron mediante interfaz y llamadas autenticadas de Playwright.
- La ampliación se aplicó en la migración `20260930180000_resultado_examen_observaciones`; desde Playwright se guardó `7,5` con «Parcial de prueba», se mostró bajo el examen y SQL confirmó `7.5|Parcial de prueba` en la base temporal.
- Chromium confirmó en escritorio y móvil el modal con observaciones opcionales, su persistencia y visualización en el historial, y la etiqueta «Examen» en azul petróleo. Suite completa: 72 archivos aprobados, 8 omitidos; 1.018 tests aprobados, 40 omitidos y 3 todo. TypeScript, ESLint, `prisma validate` y `npm run build` pasan.

## 7. Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Helper público de materias de L integrado, o dependencia bloqueada con evidencia.
- [x] POST/GET de opciones cumplen el contrato estricto y el aislamiento de módulos.
- [x] Dialog funcional con permisos, validación y toast.
- [x] Evidencia unitaria, de API y de persistencia/interfaz registrada; las llamadas API se hicieron desde Playwright, no desde Postman.
