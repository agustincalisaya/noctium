# TASK: HU-C-09 — Consultar detalles del turno

**Módulo:** C (Turnos) · **Sprint:** 2 · **SP estimado:** **2** (Excel Sprint 2, fila 70; `docs/tasks/Sprint 2/HU-Sprint-2.md` aún dice 1 → alinear solo esa cifra, sin tocar AC)
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.4, §3.8, §3.9 y §3.11 · `spec_modulo_A.md` §2.5 · `spec_modulo_D.md` §2.8 · `spec_modulo_E.md` §§2.1, 2.3 y 2.4 · `spec_modulo_I.md` §§2.3 y 2.4 · `docs/RULES.md` Reglas 3, 4, 5, 10 y 11 · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 y §4 · `docs/DESIGN.md`
**Diseño de referencia (obligatorio):** `docs/Noctium pantallas Sprint 2.pdf` (29 páginas, capturas del 28/09/2026): pág. 5 (detalle) y págs. 6–11 (modales de las acciones). **Prevalece sobre cualquier otro PDF**; el de 13 páginas es una versión anterior con la tarjeta «Forma de pago» retirada: no usarlo.
**RBAC:** `turnos:leer` para el GET. Capacidades opcionales que solo se leen: `pagos:leer`, `historial:leer`, `turnos:cancelar`, `turnos:reprogramar`, `turnos:priorizar`, `pagos:crear`, `clases:registrar`. No se crea ningún permiso.
**Schema:** ya completo (`prioridadTurno`, `Pago`, `ClaseDictada`, `CANCELADO`), sin migración.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, reportar y **esperar confirmación explícita**:

1. Rama, HEAD y `git status`. Las fases SDD citan tres fotografías (`d02c0cb`, `36223e2`, `5481277`); ninguna es vinculante: describir el árbol real y qué cambió.
2. **Archivos nuevos** (ruta exacta, uno por uno) y **archivos existentes a modificar** (ruta y qué cambia en cada uno).
3. Consumidores reales de `presentar()`, tipos actuales del detalle y sus imports, firma real de `withPermission` y del chequeo booleano de permisos (`tienePermiso` o equivalente), y helpers de tiempo de `turno.validaciones.ts` (`turnoSigueVigente`, `turnoNoHaComenzado`; hace falta uno nuevo para «hora de fin»).
4. **`turnoInclude` y Regla N.° 3:** qué campos de Alumno, Materia, Profesor y Aula selecciona hoy y si respeta la excepción de spec C §3.11 (Alumno: id, nombre, apellido, DNI; Materia: id, nombre, código; Profesor: id, nombre, apellido, DNI; Aula: id, nombre, capacidad). Informar sobrantes y restringirlos. Para el Profesor, el `where` de la consulta que trae las relaciones filtra por `idTurno` **y** profesor efectivo a la vez.
5. Existencia real, ruta y firma de: A `obtenerEmailDeUsuario()` (`src/server/usuarios/usuario.service.ts`); D `obtenerOpcionProfesorDeUsuario()` (ya publicada en `profesor.publico.ts`); I `listarPagosDeTurno()` (`src/server/pagos/pago.publico.ts`); E `obtenerClaseDictadaDeTurno()` y `profesorAtendioAlumno()`; E-05 (tab Historial); operaciones y modales de C-05, C-06, C-10, I-01 y E-01. Distinguir **contrato escrito** de **función implementada**.
6. Grafo transitivo de imports `turno.publico.ts` ↔ `turno.service.ts` ↔ I/E. El ensamblado del detalle no puede quedar importado por `turno.publico.ts`.
7. **Pruebas existentes que afirmen campos que la UI dejará de mostrar** (Identificador, DNI del profesor, Código de materia, Capacidad del aula, Última actualización, Modificado por). Listarlas: **no editarlas**; se consulta antes.
8. Consumidores de `modificado_por` (campo legado): si ninguno lo usa, consultar si se retira para ahorrar una lectura a A.
9. Cómo descomponer `turno-detalle.tsx` en subcomponentes en **archivos separados** (encabezado y acciones, «Datos del turno», «Alumnos inscriptos», «Pago», «Clase»), para que C-05, C-06, C-10, I-01 y E-01 se enganchen sin pisarse.
10. Entorno de evidencia: `noctium_test` (solo migrada, para suites Postgres) y `noctium_sim` (con seed, para HTTP). Ver §6.

**Resueltas tras el relevamiento (30/09/2026):**
- **P1.** Lista de alumnos vacía con cupo asignado: se conserva el texto que ya usa el producto, «El turno no tiene alumnos inscriptos.». Ni el Excel ni el mockup definen otro y no se inventa uno.
- **P2.** Duración: múltiplo de 60 → «1 hora», «N horas»; en cualquier otro caso, «N min». Hoy solo se admiten 60, 120 y 180 (`DURACIONES_PERMITIDAS_TURNO_MIN`), pero la columna no tiene `CHECK`.
- **P3.** Se conserva el comportamiento actual. Los controles del turno `PENDIENTE` quedan donde están; «Agregar alumno» va al encabezado de la tarjeta «Alumnos inscriptos» y «Quitar» sigue por fila (HU-C-04, con sus condiciones actuales).

### Decisiones resueltas (no relevar de nuevo)

| Tema | Decisión | Fuente |
|---|---|---|
| «Creado por» | Se muestra el **email** (`Usuario` no tiene nombre y Mesa no tiene ficha) | **PO, 30/09/2026** |
| «Total registrado» | **No se implementa**: no figura en los criterios de HU-C-09 ni de HU-I-01, aunque aparece en el mockup | **PO, 30/09/2026** |
| Regla N.° 3 | Excepción acotada de solo lectura (campos básicos de Alumno, Materia, Profesor y Aula) | spec C §2.4 y §3.11, 29/09 |
| 2 SP | Estimación oficial | Excel, 29/09 |
| Cancelar / Reprogramar | Solo con el turno **no vencido** (inicio futuro estricto) | spec C §3.8, PO Q5, 29/09 |
| Asignar prioridad / Registrar pago | Se admiten con el turno vencido | spec C §3.8 y spec I §2.4, PO Q5 y Q6a |
| Registrar clase dictada | Desde la **hora de fin**, sin registro previo; el Profesor solo en sus turnos | spec E §2.1, PO Q7c |
| `403` neutro | Profesor ajeno, inexistente o sin ficha → mismo `403 SIN_PERMISO`; Mesa/Gerente → `404` si no existe | spec C §2.4 |
| `pagos` | Sin `pagos:leer` la propiedad se omite; con permiso y sin registros, `[]`; el Profesor nunca recibe datos de pago | spec A §2.4 (Q6d), spec C §2.4 |
| Q13 | «Ver historial» por alumno elegible; **no es AC6** | spec C §2.4 y E §2.3, PO 29/09 |
| Turno `CANCELADO` | Sin acciones | spec C §2.4 e I/E: ninguna admite `CANCELADO` |
| Breadcrumb | `Turnos / {materia} · {dd/mm}` (no existe un código de turno) | SM, 30/09 |
| `creado_por` en el listado | **Fuera** de la primera entrega: el Excel lo pide solo en el detalle (ticket aparte) | SM, 30/09 |
| Helper de vigencia | `turnoSigueVigente()` puede recibir un parámetro opcional `ahora` (por defecto la hora actual), sin cambiar su comportamiento | SM, 30/09 |
| Pruebas existentes que rompe el cambio | Se editan **solo** las aserciones afectadas (no se borran casos) y se informa el diff de cada una | SM, 30/09 |
| `modificado_por` (email) | Se retira del JSON; se conservan `creado_por_id` y `modificado_por_id` | SM, 30/09 |
| Badge de `CANCELADO` | Fuera de C-09: ticket para C-05 (donde los turnos cancelados empiezan a verse) | SM, 30/09 |
| Enlace «Turnos» del breadcrumb | Apunta a `retorno` si existe (conserva página y filtros); si no, a `/turnos` | SM, 30/09 |
| Capacidades del GET | Se calculan solo las relevantes para el rol, en paralelo (`Promise.all`); sin cambios en `with-permission.ts`. Costo aceptado y anotado como deuda | SM, 30/09 |
| Aislamiento | No se edita `publico.aislamiento.test.ts`: ya prohíbe importar cualquier archivo fuera de su lista. Como mucho, se agrega un caso negativo | SM, 30/09 |

---

## 1. Nota de alcance: entrega por etapas

C-09 es la base de C-05, C-06, C-10, I-01, E-01 y E-05: cuatro personas tocan esta pantalla. Se entrega en hitos, **sin datos de relleno** (ningún `null`, `[]` ni texto simulado en lugar de un dato que todavía no se puede leer).

| Hito | Contenido | Dependencias |
|---|---|---|
| **Previo — A e I (propios)** | `obtenerEmailDeUsuario()` (A) y `listarPagosDeTurno()` (I), en commits separados y antes de C-09; el SM avisa al dueño de `usuario.service.ts` | Ninguna |
| **1 — Detalle base** | Tipos migrados; alcance del Profesor y `403`; `prioridad`; alumnos completos; `creado_por` por A; tarjeta «Pago» por I (solo con `pagos:leer`); cálculo puro de `acciones_habilitadas`; pantalla según mockup, con «Sin asignar» y sin botones de acción | Los dos previos (D ya publicado) |
| **2 — E (Iván)** | `clase_dictada`, tarjeta «Clase», `puede_ver_historial` y enlace «Ver historial» | Públicos de E y tab de E-05 |
| **3 — Acciones** | Cada botón y modal se conecta cuando su historia dueña lo publica | C-05, C-06, C-10, I-01, E-01 |

**AC1, AC2, AC3 y AC5 se cierran con el hito 1** (AC1 no incluye la clase dictada). **AC4 y Q13, con los hitos 2 y 3.** Ningún criterio se declara completo por un placeholder o un botón sin operación real.

**Fuera de alcance (explícito):**
- Implementar mutaciones, endpoints o modales de C-05, C-06, C-10, I-01 y E-01, y el tab de E-05.
- «Total registrado», estados «Pagado / Sin pago» por alumno, forma de pago única del turno (HU-C-11 retirada).
- `creado_por` en el listado, búsqueda y filtros (C-02, C-08), indicador de prioridad en el listado (C-10).
- Consultas directas a `usuarios`, `pagos` o `clases_dictadas`; migraciones; flags de producto o rutas provisionales.
- Cambiar el flujo de «Agregar alumno» de HU-C-04 a modal (el mockup lo dibuja, pero pertenece a C-04, Sprint 1).

---

## 2. Historia de Usuario

**Como** usuario autorizado (Mesa de Entrada, Gerente o Profesor sobre sus propios turnos)
**Necesito** ver el detalle completo de un turno, incluidos los datos que se agregan este sprint
**Para** contar con toda la información antes de modificarlo o cancelarlo

**SP estimado:** 2

**Criterios de aceptación (literales del Excel, filas 70–74):**
1. El detalle (/turnos/[id]) muestra Materia, Profesor, Fecha, Hora de inicio–fin, Duración, Aula, Cupo máximo, listado completo de alumnos inscriptos (no solo ocupación), Estado, Prioridad (HU-C-10), listado de pagos registrados (HU-I-01), fecha de creación y usuario que lo creó.
2. Un profesor que consulta el detalle de un turno que no es suyo recibe 403 — mismo criterio de alcance por rol ya usado en el calendario (HU-J-01).
3. Si el turno está Pendiente, los datos no asignados todavía se muestran como “Sin asignar” — mismo criterio ya usado en el listado (HU-C-01).
4. Desde el detalle se accede a las acciones habilitadas para el estado y el rol: Cancelar (HU-C-05), Reprogramar (HU-C-06), Asignar prioridad (HU-C-10), Registrar pago (HU-I-01) y Registrar clase dictada (HU-E-01, cuando corresponda).
5. Esta historia formaliza y completa la vista que ya existía parcialmente desde HU-C-01 (criterio 4) y HU-C-15 — no crea una pantalla nueva (ver docs/mapa-pantallas-sprint-2.md §1).

---

## 3. Alcance de esta task

Backend y frontend sobre la pantalla y la ruta existentes: `GET /api/turnos/[id]`, alcance por rol, presentador compartido, cálculo de acciones y la vista `/turnos/[id]`. El listado recibe solo `prioridad` (comparte `presentar()`).

---

## 4. Contrato backend

### 4.1. `GET /api/turnos/[id]`

- `withPermission("turnos:leer")` es el único permiso obligatorio. Las capacidades adicionales se calculan como booleanos, sin abortar el GET.
- **Profesor:** la ficha se resuelve desde la sesión con D `obtenerOpcionProfesorDeUsuario()`, nunca por un parámetro del cliente. Turno propio → `200`. Turno ajeno, inexistente o cuenta sin ficha → el mismo `403 SIN_PERMISO`, mensaje «No tenés permisos para acceder a esta sección» (igual que el calendario, HU-J-01). La consulta trae el turno con id **y** `profesorId` efectivo en el mismo `where`; no se lee nada más antes de ese resultado.
- **Mesa de Entrada y Gerente:** cualquier turno; id inexistente → `404 TURNO_NO_ENCONTRADO`.
- Un fallo de infraestructura (Prisma, D, A, I, E) nunca se traduce en `403`.
- El servicio devuelve una unión interna `ok | sin_permiso | no_encontrado`; el Route Handler la mapea a `200`, `403` y `404`, en el sobre `{ data, error }` (Regla 5).

### 4.2. Campos del detalle

Se conservan los campos actuales del presentador y se agregan los nuevos. `cupo_maximo` es `number | null` en JSON; «Sin asignar» es solo texto de la UI.

| Campo | Regla |
|---|---|
| `prioridad` | `"NORMAL" \| "ALTA" \| "URGENTE"` desde `Turno.prioridadTurno` (también en el listado) |
| `alumnos[]` | **Todos** los `TurnoAlumno`, sin paginar; `[]` si no hay. Elemento: `{ id, nombre, dni }` con `nombre` en formato «Apellido, Nombre» |
| `alumnos_inscriptos` | `"N/M"`; `"Sin asignar"` si `cupo_maximo` es `null`; `"0/M"` con cupo asignado y cero alumnos (incluso `PENDIENTE` o `CANCELADO`) |
| `creado_por` | Email vía A `obtenerEmailDeUsuario(creadoPorUsuarioId)`; `null` si el id es nulo o A devuelve `null`. **Nunca** el id como respaldo |
| `modificado_por` (email) | **Se retira** del JSON (sin consumidores tras el rediseño); se conservan `creado_por_id` y `modificado_por_id` |
| `pagos` | Hito 1. Solo con `pagos:leer`: `listarPagosDeTurno(turnoId)` completa, incluidos los pagos de alumnos ya retirados (no se filtra por `alumnos[]`); `[]` sin registros; **propiedad omitida** sin permiso |
| `clase_dictada` | Hito 2. `{ id, registrada_en } \| null` desde E |
| `puede_ver_historial` (por alumno) | Hito 2. Mesa/Gerente con `historial:leer` → `true`; Profesor → `profesorAtendioAlumno()`; otro → `false` |
| `acciones_habilitadas` | Arreglo ordenado de strings (§4.3) |

El resto de los campos actuales de la respuesta se mantienen para no romper consumidores (`materia_id`, `profesor_id`, `aula_id`, etc.); que la UI deje de mostrarlos no cambia el JSON.

### 4.3. `acciones_habilitadas`

Función pura `calcularAccionesHabilitadas()` en `src/server/turnos/turno.acciones.ts`, con un único `ahora` por request y sin `Date.now()` interno. Devuelve, en este orden fijo y solo las elegibles: `cancelar`, `descartar`, `reprogramar`, `prioridad`, `registrar_pago`, `registrar_clase`; sin acciones, `[]`. Expresa elegibilidad de dominio: cada endpoint dueño vuelve a autorizar y validar al ejecutarse.

| Acción | Permiso | Estado | Tiempo | Otras condiciones |
|---|---|---|---|---|
| `cancelar` | `turnos:cancelar` | `DISPONIBLE`, `COMPLETO` | inicio **futuro** estricto (`turnoSigueVigente`) | nunca `PENDIENTE` |
| `descartar` | `turnos:cancelar` | `PENDIENTE` | incluso vencido | — |
| `reprogramar` | `turnos:reprogramar` | `DISPONIBLE`, `COMPLETO` | inicio futuro estricto | — |
| `prioridad` | `turnos:priorizar` | cualquiera menos `CANCELADO` | incluso vencido | — |
| `registrar_pago` | `pagos:crear` | `DISPONIBLE`, `COMPLETO` | incluso vencido | al menos un alumno inscripto |
| `registrar_clase` | `clases:registrar` | `DISPONIBLE`, `COMPLETO` | `fecha + hora_fin ≤ ahora` | sin clase previa; el Profesor solo en turno propio |

- Un turno `CANCELADO` no tiene ninguna acción. El Gerente no tiene permisos de acción: recibe `[]`.
- `registrar_clase` no se emite hasta que E publique `obtenerClaseDictadaDeTurno()` (hito 2); antes no se sabe si ya hay una clase registrada.
- El cálculo de «hora de fin» usa un helper nuevo, puro, en `America/Argentina/Buenos_Aires`. `turnoSigueVigente` puede recibir un parámetro opcional `ahora` (por defecto la hora actual), sin cambiar su comportamiento, para que todo el cálculo use un único instante; `turnoNoHaComenzado` no se modifica.

### 4.4. Presentador y lecturas externas

- `presentar()` sigue **síncrono**: los emails se resuelven antes y se le pasan. El listado no cambia su forma salvo por `prioridad`.
- Se elimina la lectura directa de `usuarios` en `obtenerTurno()`.
- La proyección de Alumno, Materia, Profesor y Aula se limita a la excepción de spec C §3.11.
- Los públicos de I y E se importan desde un ensamblador aislado, nunca desde `turno.publico.ts`.
- Tipos de dominio en `src/types/turno.types.ts` (Regla 11), migrados desde `src/app/(dashboard)/turnos/turno.types.ts`, con imports por alias `@/`.

### 4.5. Funciones de otros módulos que este trabajo necesita (ver §8)

- **A:** `obtenerEmailDeUsuario(usuarioId): Promise<string | null>` en `src/server/usuarios/usuario.service.ts` (spec A §2.5).
- **I:** `listarPagosDeTurno(turnoId, db?)` en `src/server/pagos/pago.publico.ts`: `{ id, alumno: { id, nombre_completo }, monto, forma_pago: { id, nombre }, fecha_pago, registrado_en }[]`, más recientes primero; los nombres salen de `obtenerAlumnosBasicos()` en una sola consulta en lote (spec I §2.3).
- **E:** `obtenerClaseDictadaDeTurno()` y `profesorAtendioAlumno()`: los publica su dueño.

---

## 5. Frontend

La pantalla sigue siendo `/turnos/[id]` y el componente actual se rearma según el mockup (pág. 5). Se respetan los tokens de `docs/DESIGN.md`. Nada de hex ni paleta por defecto de Tailwind.

### 5.1. Estructura y textos literales

| Zona | Contenido |
|---|---|
| **Migas** | `Turnos / {materia} · {dd/mm}` (usar el componente `Breadcrumb` compartido) |
| **Título** | `{materia}` + etiqueta de estado (`EstadoTurnoBadge`, DESIGN §6.5). Subtítulo: `{día} {d} de {mes} de {año} · {HH:mm}–{HH:mm} · {aula} · {profesor}` (ej. «Martes 6 de octubre de 2026 · 16:00–17:00 · Aula 3 · Méndez, Laura»); `Sin asignar` donde falte aula o profesor (el sistema usa «Apellido, Nombre»; el mockup usa orden natural en sus datos de ejemplo) |
| **Acciones** (arriba a la derecha) | Área reservada. Hito 3: «Reprogramar», «Asignar prioridad», «Cancelar turno». Cada botón aparece solo si su clave está en `acciones_habilitadas` **y** existen su endpoint y su modal |
| **Tarjeta «Datos del turno»** (grilla de 3 columnas, etiquetas en mayúsculas) | MATERIA · PROFESOR · AULA · FECHA (`dd/mm/aaaa`) · HORA DE INICIO–FIN · DURACIÓN («1 hora», «2 horas») · CUPO MÁXIMO («6 alumnos») · ESTADO · PRIORIDAD · CREADO (`dd/mm/aaaa`) · CREADO POR (email; `null` → «Sin registrar») |
| **Tarjeta «Alumnos inscriptos · N de M»** | Una fila por alumno, con iniciales y nombre; se conserva «Quitar» por fila (HU-C-04) y «Agregar alumno» va en el encabezado de la tarjeta. Cupo sin asignar → «Sin asignar» en lugar de «N de M». Lista vacía con cupo asignado → «El turno no tiene alumnos inscriptos.». Hito 2: «Ver historial» como enlace de texto al final de la fila |
| **Tarjeta «Pago»** (solo con `pagos:leer`) | Título «Pago»; «PAGOS REGISTRADOS»; por pago: alumno, `dd/mm/aaaa · {forma}`, monto alineado a la derecha (`$ 12.000`); vacío: «Ninguno todavía.». **Sin total.** Botón «Registrar pago» solo en el hito 3 |
| **Tarjeta «Clase»** (hito 2) | Antes de la hora de fin: «Podés registrarla cuando haya pasado la fecha y hora del turno.» con botón «Registrar clase dictada» deshabilitado. Ya pasó y sin registro: «La clase ya pasó y todavía no se registró.» con el botón habilitado |

### 5.2. Reglas de la pantalla

- **`PENDIENTE`:** «Sin asignar» solo en los datos no asignados (profesor, aula, cupo). Una lista vacía con cupo asignado no es un dato pendiente.
- **`CANCELADO`:** conserva la lista de alumnos y no muestra acciones.
- **Prioridad:** texto o ícono además del color (DESIGN); `Normal` con contorno, como en el mockup.
- **Se retiran de la vista** (el mockup no los muestra): Identificador, DNI del profesor, Código de materia, Capacidad del aula, Última actualización, «Modificado por» y el DNI del alumno.
- **Se conservan** con su comportamiento actual: los controles de configuración del turno `PENDIENTE` y «Agregar/Quitar alumno» (§0).
- El **Profesor** nunca ve la tarjeta «Pago» ni recibe la propiedad `pagos`.
- El **Gerente** ve todo en modo lectura: sin botones de acción.
- Sin controles rotos, flags ni rutas provisionales. Con `acciones_habilitadas` vacío o sin operación real, no hay botón.
- **Q13:** «Ver historial» solo si `puede_ver_historial` es `true`, hacia la URL del tab que publique E-05; hasta entonces no se renderiza.

---

## 6. Testing (tres niveles + UI)

| Nivel | Casos mínimos |
|---|---|
| **Unit** | `calcularAccionesHabilitadas`: matriz completa con límites (1 minuto antes, mismo minuto y 1 minuto después del inicio y del fin, en zona Buenos Aires), `CANCELADO` sin acciones, pago sin alumnos, Gerente `[]`. Presentador con `prioridad`, creador nulo y `creado_por` sin respaldo por id. Alcance del Profesor: propio, ajeno, inexistente, sin ficha. Alumnos: todos, cero, pendiente con y sin cupo, cancelado vacío y con alumnos. Pagos: omitidos, `[]`, y pago histórico de alumno retirado |
| **HTTP / Postman** | `200` para Mesa, Gerente y Profesor propio; `403` neutro (ajeno, inexistente y sin ficha, con el mismo cuerpo); `404` para Mesa y Gerente; JSON completo sin fuga de datos de pago al Profesor; `creado_por` `null` |
| **BD** | Comparar el turno, la prioridad, los alumnos, el creador y los pagos contra la respuesta real (`noctium_sim`, solo lectura). Los casos límite sin filas (pendiente con cupo, cancelado vacío, creador nulo) se preparan con fixtures en `noctium_test` o se marcan **Bloqueado** |
| **UI** | Comparar con la pág. 5 del PDF (capturas del SM): campos, «Sin asignar», tarjetas por rol, ausencia de «Total registrado» y de botones sin operación |

- Las pruebas contra Postgres corren **solo** en `noctium_test` (ya existe, no se borra ni se recrea) con `DATABASE_URL` y `HU_C15_TEST_DATABASE_URL` iguales. Las simulaciones HTTP, en `noctium_sim` con seed y `next dev` en el puerto 3100. Nunca la base habitual.
- No se cuenta `it.skip` ni `it.todo` como evidencia. Lo no ejecutable se documenta como **Bloqueado** con motivo.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento (§0) confirmado antes de editar código; task del repositorio con 2 SP.
- [ ] **Previo:** `obtenerEmailDeUsuario()` (A) y `listarPagosDeTurno()` (I) publicados, con pruebas.
- [ ] **Hito 1:** AC1, AC2, AC3 y AC5 verificados con respuestas y pantalla reales (incluye `creado_por` por A y pagos por I).
- [ ] Sin lectura directa de `usuarios`, `pagos` ni `clases_dictadas`; sin ciclos de imports; excepción de la Regla 3 limitada a los campos autorizados.
- [ ] Tipos en `src/types/turno.types.ts` con imports por alias.
- [ ] Pagos omitidos para el Profesor y `[]` para Mesa/Gerente sin registros.
- [ ] **Hito 2:** `clase_dictada`, tarjeta «Clase», `puede_ver_historial` y «Ver historial» (Q13, con E-05).
- [ ] **Sin** «Total registrado» (decisión del PO, 30/09).
- [ ] **Hito 3:** cada acción con endpoint, modal y prueba de su dueño; AC4 completo.
- [ ] Evidencia Unit, HTTP/Postman, BD y UI registrada; lo no ejecutado, «Bloqueado» con motivo.
- [ ] Sin commits ni push realizados por Claude Code.

---

## 8. Tareas del SM (fuera de esta task)

- Crear `obtenerEmailDeUsuario()` (A) y `listarPagosDeTurno()` (I) como cambios chicos y separados, y **avisar** al dueño de `usuario.service.ts` antes de tocarlo.
- Avisar a Iván del hito 2 (públicos de E y URL del tab de E-05) y de la descomposición en subcomponentes de `turno-detalle.tsx`.
- Alinear el 1 SP de C-09 en `docs/tasks/Sprint 2/HU-Sprint-2.md` (de paso, I-03 figura con 1 SP y el Excel dice 3).
- Anotar el ticket de `creado_por` en el listado y actualizar la spec C §2.4 con las decisiones del PO del 30/09.
- Retirar del proyecto el PDF de pantallas de 13 páginas.
