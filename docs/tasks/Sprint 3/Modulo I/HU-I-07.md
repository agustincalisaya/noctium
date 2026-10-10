# TASK: HU-I-07 — Modificar, desactivar y reactivar forma de pago

**Sprint:** 3 · **SP:** 3 · **Prioridad:** 29
**Issue:** https://github.com/agustincalisaya/noctium/issues/180
**Base relevada:** develop, `6f553d0`, 10/10/2026.
**Estado:** relevamiento confirmado explícitamente por el usuario (10/10/2026: «Confirma, comienza.»); implementación y validación en curso.
**Contratos:** spec_modulo_I §§2.1–2.3, 2.16–2.17; spec_modulo_B §§2.3/2.8; PR-0; RULES; DESIGN; C-23/C-25.

## 0. Relevamiento previo a implementación

Issue abierto, asignado a AdrielRelos, sin comentarios. No se encontró PR abierto ni rama remota I-07. Esto no demuestra ausencia de trabajo local del asignado. El encargo del usuario autoriza ayudar con esta HU y preparar PR independiente a develop, sin merge.

### Archivos nuevos previstos

- `src/app/api/formas-pago/[id]/route.ts`: PATCH nombre.
- `src/app/api/formas-pago/[id]/impacto/route.ts`: GET impacto.
- `src/app/api/formas-pago/[id]/desactivacion/route.ts`: POST baja.
- `src/app/api/formas-pago/[id]/reactivacion/route.ts`: POST alta de estado.
- `src/app/api/formas-pago/[id]/route.test.ts`.
- `src/app/api/formas-pago/[id]/impacto/route.test.ts`.
- `src/app/api/formas-pago/[id]/desactivacion/route.test.ts`.
- `src/app/api/formas-pago/[id]/reactivacion/route.test.ts`.
- `src/app/api/formas-pago/respuesta-error.ts`: traducción común de errores existentes, respetando envelopes.
- `src/server/alumnos/alumno.preferida.publico.test.ts`: contrato de conteo de B.
- `prisma/seed/fixtures/hu-i-07.ts`: datos repetibles por servicios públicos.
- `docs/testing/HU-I-07-evidencia.md` y capturas bajo `docs/testing/hu-i-07/`.

### Archivos existentes previstos

- `src/server/pagos/forma-pago.schema.ts`: extraer nombre reutilizable y schema estricto de baja.
- `src/server/pagos/forma-pago.service.ts`: edición, impacto, baja y reactivación; no modificar pagos ni snapshots.
- `src/server/pagos/forma-pago.schema.test.ts`, `forma-pago.service.test.ts`, `forma-pago.service.pg.test.ts`: casos de I-07.
- `src/server/alumnos/alumno.publico.ts`: publicar contarAlumnosConFormaPagoPreferida(id, db?). Hoy falta.
- `src/server/shared/bloquear.ts`, `bloquear.test.ts`, `bloquear.pg.test.ts`: admitir fila solicitada junto al conjunto activo y bloqueo individual para reactivar. Hoy solo admite booleano y bloquea activas.
- `src/components/shared/confirmar-accion-dialog.tsx`, `confirmar-accion-dialog.test.tsx`: permitir estilo destructivo reversible y deshabilitar confirmación cuando el motivo/impacto sea inválido; conservar compatibilidad C-25.
- `src/lib/textos.ts`: centralizar textos I-07, título y descripción del prototipo, confirmaciones y éxitos.
- `src/app/(dashboard)/formas-pago/formas-pago-interactivas.tsx`, `formas-pago-interactivas.test.tsx`: acciones por fila, edición precargada, confirmaciones y errores/reintento.
- `src/server/alumnos/alumno.service.ts`, `src/types/alumno.types.ts`: exponer estado de la preferida conservada.
- `src/app/(dashboard)/alumnos/[id]/ficha-alta-pago.tsx`, `page.tsx`, `page.test.tsx`, `src/server/alumnos/alumno.forma-pago.test.ts`: mostrar etiqueta Inactiva en ficha.
- `src/app/(dashboard)/alumnos/[id]/forma-pago/page.tsx`, `forma-pago-form.tsx`: presentar preferida inactiva sin convertir accidentalmente la preferencia persistida en otra selección.
- `prisma/seed/fixtures/index.ts`: registrar fixture propio.
- `docs/DESIGN.md`: añadir feedback de acciones I-07.
- `docs/specs/spec_modulo_I.md`, `docs/specs/spec_modulo_B.md`: solo notas aditivas de sincronización si corresponde; sin renumerar.
- Esta task: completar implementación y DoD tras la confirmación.

## 1. Alcance

Solo I-07 y ajustes mínimos de sus consumidores. Sin migración, sin edición de esEfectivo, sin otras HUs de personal/gerentes, sin rediseño de sidebar, sin pagos online. I-10 está integrado; los diferidos de I-06/I-11 se verifican por servicios disponibles y sus pantallas se documentarán según disponibilidad real.

## 2. Historia

Como Gerente necesito modificar el nombre, desactivar y reactivar formas de pago para mantener el catálogo sin perder los pagos ya hechos.

## 3. Criterios, contratos y validación

| Criterio | Implementación | Evidencia prevista |
|---|---|---|
| 1 y 3 | PATCH, nombre 2–40, normalización, unicidad global excluyendo propia; editar precargado, guardar sin cambios deshabilitado, cancelar | schemas, servicio, API, UI y PG |
| 2 | Renombrar solo FormaPago; consumidores por consulta; Comprobante.datos conserva snapshot | PG con pagos, preferencia y comprobante |
| 4 | GET impacto por fachada B; POST baja con motivo hasta 300, obligatorio con pagos; historial tras commit | API/UI y PG con actor/motivo/fecha |
| 5 | Opciones activas, preferida conservada e identificada Inactiva, sin preselección I-10 | B e I-10, UI y PG |
| 6 | Bloqueo contractual de conjunto activo más solicitada, count dentro de transacción | dos bajas simultáneas de las dos únicas activas en PG real |
| 7 y 8 | Reactivar fila bloqueada, historial, toast; permisos servidor solo Gerente | estados, autorización de cuatro endpoints y recarga |

PATCH conserva `{ data: { id, nombre, is_active }, error: null }`; baja conserva respuesta directa `{ id, nombre, is_active: false }`. Impacto expone los tres campos del §2.16.2. Errores mantienen HTTP/códigos §2.16.4; no uniformar respuestas anteriores.

## 4. Frontend y fidelidad

Referencia visual: imágenes adjuntas, figuras 83 y 84. Nombre y Estado más acciones Editar/Desactivar o Reactivar, sin Preferida por. Descripción literal del catálogo del prototipo. Modal centrado con pregunta que incluye nombre, alumnos con preferida, conservación de pagos/preferencias, textarea Motivo de la baja, contador 0/300, Volver y Desactivar rojo. No leyenda de irreversible. Conservar alta/listado, tokens oficiales y sidebar existente. Verificar desktop y móvil con Chromium /bin/chromium mediante MCP Playwright.

## 5. Plan de pruebas y entorno

Instalar por package-lock y leer documentación local Next antes de código. Entorno PG aislado nuevo; ningún dato anterior se restaura. Un solo proceso de validación y un worker: bloques de schemas/servicios, API, UI, PG, lint, catálogo de textos, types y build por separado. Evidencia HTTP/SQL/capturas sin secretos. Apagar servicios propios al terminar. No marcar como aprobado un criterio no ejecutado.

## 6. Definition of Done

- [x] Clon nuevo y copia externa del traspaso.
- [x] Base, remoto, issue y ramas/PRs inspeccionados.
- [x] Rama propia `feat/hu-i-07-formas-pago`.
- [x] Confirmación explícita del relevamiento SDD.
- [x] Implementación y contratos verificados.
- [x] Pruebas dirigidas y PostgreSQL real.
- [x] Comparación visual Playwright desktop/móvil.
- [ ] Evidencia, PR a develop y CI del SHA final.
- [x] Servicios propios apagados.
- [ ] Merge después de checks verdes, autorizado por la instrucción posterior del usuario.

## 7. Decisiones de implementación

- API conserva los envelopes diferentes del §2.16; reactivar usa objeto directo como baja. Dominios nuevos reciben tx primero.
- Extensión aditiva de `bloquear` reutiliza orden y SQL parametrizado: booleano previo intacto, activas más ids o ids solamente.
- C-25 separa estilo destructivo de irreversibilidad y permite contenido/validación del motivo sin duplicar el componente.
- `FichaDatos` en `src/app/(dashboard)/alumnos/[id]/ficha-seccion.tsx` acepta ReactNode para mostrar la etiqueta junto al nombre.
- Pruebas de dominio y PG de I-07 en archivos propios `src/server/pagos/forma-pago.i07.test.ts` y `forma-pago.i07.pg.test.ts`, evitando mezclar escenarios con el alta I-03.
- Sin cambios de rutas de pantalla ni proxy: /formas-pago y /alumnos/[id]/forma-pago ya están protegidas. Los nuevos endpoints verifican permiso directamente.
- Fixture repetible añade únicamente Cheque inactiva; respeta modificaciones posteriores del usuario. La demo visual usa una base nueva, sin seed masivo, con datos creados por fábricas/servicios.

## 8. Evidencia y autorización de entrega

Ver [evidencia ejecutada](../../../testing/HU-I-07-evidencia.md). El usuario pidió expresamente asociar la PR al issue #180 y mergear después de que pasen los checks. Esta instrucción posterior reemplaza la prohibición de merge automático del traspaso; no reemplaza la condición de CI verde del SHA final.
