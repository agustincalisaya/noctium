# TASK: HU-E-01 — Registrar clase dictada

**Módulo:** E (Atención académica / Historial) · **Sprint:** 2 · **SP estimado:** 2  
**Contrato de referencia:** `docs/specs/spec_modulo_E.md` §§1, 2.1, 2.4, 3.1–3.5 y 4 · `spec_modulo_C.md` §§2.4 y 2.15 · `spec_modulo_A.md` §2.5 · `spec_modulo_B.md` §2.8 · `spec_modulo_D.md` §2.8 · `docs/RULES.md` Reglas 2–8, 10 y 11  
**Pantalla:** Detalle de turno (`/turnos/[id]`), mapa Sprint 2 §1 y §4; mockup de referencia, págs. 5 y 11.  
**RBAC:** permisos existentes `clases:registrar` (MESA_ENTRADA, PROFESOR) y `historial:leer`; no se crean ni alteran permisos.  
**Schema:** `ClaseDictada` y `ClaseDictadaAlumno` ya están migrados; no requiere migración ni cambios en `schema.prisma` o el seed.

**Estado:** implementación y verificación completadas en `feature/hu-e-01`, apilada sobre `develop`. Pasan TypeScript, ESLint y la suite completa. Se verificaron interfaz, API y persistencia usando Playwright/Chromium y una base PostgreSQL temporal.

---

## 0. Relevamiento previo a implementación

Relevamiento confirmado por el usuario el 30/09/2026: iniciar HU-E-01 y agregar el contrato público de materias indicado por `spec_modulo_L.md` §2.5 para las HUs dependientes.

- Base revisada: `develop` en `830d4b4` (merge de PR #131); rama de publicación: `feature/hu-e-01`.
- No existe aún implementación del módulo E. Sí existen el modelo/migración, permisos, `bloquearTurnoParaOperacion()`, el ensamblador de C-09 y el helper `turnoYaTermino()`.
- Archivos nuevos de esta HU: `src/server/historial/clase-dictada.service.ts` y su test, `src/server/historial/historial.publico.ts`, `src/app/api/turnos/[id]/clase-dictada/route.ts` y `src/app/(dashboard)/turnos/[id]/turno-clase-card.tsx`.
- Archivos existentes de esta HU: `src/server/turnos/turno.detalle.ts` y su test, `src/app/api/turnos/[id]/route.ts` y su test, `src/app/(dashboard)/turnos/[id]/page.tsx`, `turno-detalle.tsx` y `src/types/turno.types.ts`.
- Contratos ya disponibles: C `bloquearTurnoParaOperacion`; B `obtenerAlumnosBasicos`, `obtenerAlumnoBasico`, `verificarAlumnoActivo`; D `obtenerNombresProfesores`, `obtenerOpcionProfesorDeUsuario`; A `obtenerEmailDeUsuario`.
- **Dependencia de E-05/E-06:** el contrato de `obtenerMateriasPorIds()` ya está definido en `spec_modulo_L.md` §2.5. Su implementación se agrega en la rama HU-E-05, donde la usa por primera vez; no requiere crear una HU-L-03 ni modifica el alcance de esa historia.
- Decisiones ya fijadas por la spec: el turno debe haber terminado (hora de fin, zona Buenos Aires); se permite lista vacía; no hay asistencia individual ni edición/corrección; el alta es idempotente y conserva una fotografía de fecha, materia, profesor y alumnos.

## 1. Nota de alcance

HU-E-01 registra una sola clase por turno y publica `obtenerClaseDictadaDeTurno()` para que C-09 presente el estado del registro. La integración extiende la tarjeta «Clase» del detalle existente; no reemplaza el trabajo de HU-C-09. El acceso desde la fila del alumno a su historial se entrega con HU-E-05.

**Fuera de alcance:** asistencia individual, indicaciones académicas, edición/anulación del hecho, migraciones, pagos y datos de contacto del alumno.

## 2. Historia de Usuario

**Como** personal de mesa de entrada o el propio profesor,  
**necesito** registrar que una clase efectivamente se dictó,  
**para** dejar constancia en el historial académico del alumno.

**SP estimado:** 2.

**Criterios de aceptación:**

1. En el detalle, ofrecer «Registrar clase dictada» solo para turnos `DISPONIBLE` o `COMPLETO` que ya terminaron; nunca para `PENDIENTE` o `CANCELADO`.
2. Confirmar crea un registro inmutable vinculado al turno, con fecha, materia, profesor y copia de los alumnos inscriptos.
3. Repetir el alta no duplica; devuelve el registro existente.
4. La clase aparece en el historial de cada alumno copiado.
5. No se registra asistencia individual: todos los inscriptos al momento del alta se consideran presentes.

## 3. Alcance de esta task

Implementar el servicio, sus `GET`/`POST`, el contrato público para leer la clase de un turno y la integración UI con C-09. Usar `bloquearTurnoParaOperacion()` de C y los servicios públicos de A/B/D; no consultar directamente sus tablas. E-01 no consume el helper de materias; se implementa junto a HU-E-05 para sus consumidores de historial.

## 4. Contrato Backend

### 4.1. Schema Zod

`POST /api/turnos/[id]/clase-dictada` no tiene body; el id de turno no se valida como CUID. No agregar un schema vacío sin necesidad.

### 4.2. Servicio

**Archivo:** `src/server/historial/clase-dictada.service.ts`  
**Funciones:** `registrarClaseDictada()` y lectura del registro de un turno.

Seguir `spec_modulo_E.md` §2.1: dentro de una transacción, bloquear/leer el turno mediante C, validar alcance de profesor y estado, exigir hora de fin pasada, insertar con `ON CONFLICT (turnoId) DO NOTHING`, copiar alumnos y snapshot de fecha/materia/profesor. La operación no modifica ni elimina hechos existentes. `historial.publico.ts` exporta `obtenerClaseDictadaDeTurno()` sin importar módulos externos.

**Rutas:**

- `POST /api/turnos/[id]/clase-dictada`, `withPermission("clases:registrar")`: `201` al crear, `200` si ya existía.
- `GET /api/turnos/[id]/clase-dictada`, `withPermission("historial:leer")`: devuelve el registro existente y resuelve nombres/email mediante los públicos de B/A.
- Sobre estándar `{ data, error }`; códigos: `403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO` / `CLASE_NO_REGISTRADA`, `409 TURNO_NO_ADMITE_CLASE`, `CLASE_NO_FINALIZADA`.

### 4.3. Trazabilidad

Opción (a), ya modelada: `createdAtClaseDictada` y `creadoPorUsuarioId` en la propia fila. Sin tabla de eventos ni mutaciones posteriores.

## 5. Frontend

- En el detalle actual, agregar una tarjeta «Clase» que presenta el estado; antes del fin muestra el aviso y el botón deshabilitado; al terminar habilita la confirmación para quien tenga `clases:registrar`; tras el alta muestra el registro existente.
- Usar `AlertDialog` simple sin campos y el toast literal «Clase dictada registrada correctamente» (`docs/DESIGN.md` §6.1; mapa §4).
- Mantener la composición y los tokens existentes de C-09. No agregar otra pantalla.

## 6. Testing (evidencia ejecutada)

### Nivel 1 — Unitarios

- Alta de turno elegible, clase ya existente, turno no permitido, turno aún no finalizado, profesor sobre turno ajeno y turno sin alumnos.
- Verificar idempotencia y copia congelada de alumnos.

### Nivel 2 — API (Playwright autenticado; contratos equivalentes a la colección Postman)

- `POST` autorizado y repetido; `GET` existente/no existente; estados/roles y códigos de error contractuales.

### Nivel 3 — BD / SQL directo y navegador

- Verificar una fila por turno, filas snapshot en `clases_dictadas_alumnos` y valores de auditoría.
- Evidencia visual del estado futuro, confirmación y estado ya registrado.

### Evidencia — 2026-09-30 (Playwright / Chromium y PostgreSQL temporal)

- Con el seed en una base PostgreSQL descartable, `seed-turno-27` (pasado, `DISPONIBLE`, 12 inscriptos) mostró la confirmación con esos 12 alumnos; al confirmar, el detalle mostró la clase registrada.
- Un segundo `POST /api/turnos/seed-turno-27/clase-dictada` desde el contexto autenticado devolvió `200`, `ya_existia: true` y `alumnos_registrados: 12`; no agregó otro registro.
- `seed-turno-01` (futuro, `COMPLETO`) mostró el aviso y la acción deshabilitada.
- Playwright verificó además: GET de clase propia `200` con 8 alumnos; turno ajeno `403 SIN_PERMISO`; turno sin clase `404 CLASE_NO_REGISTRADA`; y POST de turno futuro `409 CLASE_NO_FINALIZADA`.
- 7 unitarios cubren alta, copia snapshot, idempotencia, estados, fin del turno, alcance del profesor, turno vacío y lectura/mapeo.
- Consultas SQL de solo lectura confirmaron exactamente una fila de clase para cada turno probado, 8 y 12 filas snapshot respectivamente, y el usuario creador de auditoría esperado (`mesa.entrada@noctium.local`).
- No se ejecutó Postman como aplicación: los mismos contratos HTTP se ejercitaron desde el contexto autenticado de Playwright, según la solicitud de prueba del usuario.

## 7. Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Servicios y rutas cumplen las Reglas 3–8 y 10; sin `UPDATE`/`DELETE` de los hechos.
- [x] Tarjeta de C-09 funcional con modal, estados y feedback definidos.
- [x] La clase queda disponible para el historial mediante el contrato público; la vista de consulta se entrega en HU-E-05.
- [x] Evidencia unitaria, de API y de persistencia/interfaz registrada; las llamadas API se hicieron desde Playwright, no desde Postman.
