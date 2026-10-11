# HU-I-01 — Evidencia de implementación y validación

Fecha: 01/10/2026. Task: [HU-I-01](../tasks/Sprint%202/HU-I-01.md). Contrato: [Módulo I](../specs/spec_modulo_I.md) §§2.3–2.5.

## Implementación

Registro real desde `/turnos/[id]`, modal con alumno inscripto, monto decimal, forma activa y fecha; toast y recarga del detalle. Cada parcial es una fila inmutable, con identidad del alumno y auditoría. Se utiliza el modelo y los permisos existentes: sin migraciones, sin modificar seed, sidebar, navbar ni footer.

La integración encontró una divergencia de la spec: las formas del catálogo inicial usan `formapago-*`, no CUID. Se documentó aditivamente y se admiten únicamente los cuatro ids históricos exactos además de los CUID de altas nuevas. No se cambian ids ni referencias existentes.

## Entorno aislado

Docker estaba detenido y su inicio requería contraseña local. Se utilizó PostgreSQL **17** instalado en el equipo (el stack objetivo del proyecto es PostgreSQL 16), instancia temporal en `/tmp/noctium-hu-i-01/postgres`, puerto `55441`, base `noctium_hui01_test`. Se aplicaron inicialmente 33 migraciones con `migrate deploy` y el seed vigente; al integrar develop se aplicó también su migración de observaciones de exámenes (34 en total); no se reseteó ni modificó una base habitual/compartida. El dato de compatibilidad con PG17 no reemplaza la comprobación de despliegue del equipo en PG16.

La aplicación final integrada sobre `origin/develop` (`c5e8294`) se compiló con Next.js 16.3.8/webpack y se comprobó mediante `next start`, puerto 3000, apuntando exclusivamente a esta base. El desarrollo con webpack mostró recargas continuas y un error transitorio de lectura de manifiesto; se cerró y la verificación final se hizo sobre producción, sin depender de HMR.

## Nivel 1 — Tests

| Verificación | Resultado | Evidencia |
|---|---|---|
| Suite general sobre develop integrado | 1469 pasados; 64 omitidos por guarda | [unit.txt](hu-i-01/unit.txt) |
| Tests específicos después del ajuste visual final: schema, servicio, rutas y detalle | 93 pasados | [unit-targeted.txt](hu-i-01/unit-targeted.txt) |
| PostgreSQL real: pagos + contratos públicos de Pagos y Turnos | 19 pasados (5 registro, 3 consulta de pagos, 11 Turnos) | [postgres-tests.txt](hu-i-01/postgres-tests.txt) |
| ESLint | Sin errores | [lint.txt](hu-i-01/lint.txt) |
| TypeScript | `tsc --noEmit` sin errores | Ejecución local final, exit 0 |
| Compilación de producción | Correcta, incluye las tres rutas nuevas | [build.txt](hu-i-01/build.txt) |

Los tests de pagos cubren fechas de calendario imposibles, borde de medianoche argentino, payload estricto, importes decimales, catálogo inicial/CUID, estados permitidos, precondiciones y prioridades de errores. Los tests reales verifican auditoría, alumno inactivo en turno vencido, dos pagos concurrentes cuya suma exacta es `0.30`, rechazo sin INSERT, lectura histórica después de quitar inscripción/desactivar forma y una cancelación concurrente: el lector `FOR SHARE` espera el UPDATE y rechaza después del commit sin registrar el pago.

## Nivel 2 — Contrato HTTP

Ejecutado contra endpoints **reales** con sesiones de navegador, mediante la API de Playwright. La [colección Postman](HU-I-01.postman_collection.json) se entrega para reproducir el contrato; **no se afirma ejecución dentro de la aplicación Postman**. Las cookies y fixtures deben completarse localmente; no se incluyen secretos en la colección.

| Caso | HTTP / código observado |
|---|---|
| Pago válido, incluidos parciales | `201`, `{ data, error: null }` |
| Monto cero, fecha imposible, falta alumno o campos extra | `400 VALIDACION`, detalle `flatten()` |
| Fecha futura | `400 FECHA_PAGO_FUTURA`, sin `flatten()` |
| Turno inexistente | `404 TURNO_NO_ENCONTRADO` |
| Forma inexistente | `404 FORMA_PAGO_NO_ENCONTRADA` |
| Alumno no inscripto | `409 ALUMNO_NO_INSCRIPTO` |
| Forma inactiva | `409 FORMA_PAGO_NO_DISPONIBLE` |
| Turno pendiente/cancelado | `409 TURNO_NO_ADMITE_PAGO` |
| Opciones sin `turno_id` | `400 VALIDACION` |
| Sin sesión | `401 SESION_INVALIDA` |
| Gerente/Profesor intentando crear pago o pedir opciones de registro | `403 SIN_PERMISO` |
| Detalle consultado por Gerente | `200`, contiene `pagos` |
| Detalle propio consultado por Profesor | `200`, **omite** `pagos` por completo |

## Nivel 3 — Base de datos

Consultas ejecutadas con `psql`, equivalente al cliente SQL requerido por SDD. [Script de solo lectura](HU-I-01.sql) y [salida real](hu-i-01/sql-evidence.txt).

Pago creado desde la UI, ID `cmup25wom0002jmste2x460zv`: alumno Emilia Acosta, turno `seed-turno-02`, monto guardado `12.50`, Transferencia, fecha `2026-10-01`, autor de la sesión Mesa de Entrada y timestamp persistidos. La consulta confirma múltiples filas y total decimal exacto. `montoPago` es `numeric(11,2)`, `fechaPago` es `date`; no existe `updatedAtPago`.

## Playwright funcional

Se operó la UI real en producción y se comprobaron:

- Búsqueda local sin acentos/mayúsculas (`DOMINGUEZ`) y por DNI parcial (`429239`), selección con Enter y navegación con flechas.
- Preferida propuesta y editable, alumno sin preferencia, único inscripto preseleccionado en turno COMPLETO.
- Monto cero inline, fecha futura rechazada por servicio, coma decimal normalizada, registro `201`, cierre, toast `Pago registrado correctamente` y persistencia al recargar.
- Turno sin inscriptos con acción deshabilitada; búsqueda sin coincidencias.
- Fallo de red conservando valores; fallo de carga de opciones y reintento. Estas dos fallas se simularon con interceptación de Playwright.
- Catálogo vacío bloqueando el envío: respuesta de opciones simulada, identificada como prueba de estado UI, no como operación del catálogo.
- Cierre con Cancelar y Escape, manteniendo la lista en flujo hasta selección/cierre para evitar que el botón se mueva durante el click.
- **Integración con la HU productora, no solo seed:** un Gerente creó desde UI una forma nueva `Billetera HU-I-01 mup2mj3v`, ID `cmup2mj6o0005jm8i31to34hl`; Mesa de Entrada la eligió desde el modal y registró `0.30` en `hui01-unico`, pago ID `cmup2mjje0007jm8iir8q10tr`.

## Fidelidad visual

Referencia: `Noctium pantallas Sprint 2-1.pdf`, páginas **5** (detalle) y **7** (modal). También se revisó `Documento Sprint 2 Developres-1.pdf`, incluidas las precisiones de negocio de pagos. El modal conserva el ancho máximo de 390 px en desktop (358 px en el viewport móvil de 390 px), el buscador con resultados en flujo, orden y textos de campos; el detalle sigue las dos columnas y tarjetas de la referencia. El shell existente se conserva.

| Vista | Captura final |
|---|---|
| Desktop, 1306 × 900 | [Detalle](hu-i-01/desktop.png), [modal](hu-i-01/desktop-modal.png) |
| Móvil, 390 × 844 | [Detalle superior](hu-i-01/mobile.png), [alumnos](hu-i-01/mobile-students.png), [detalle inferior y pagos](hu-i-01/mobile-lower.png), [modal](hu-i-01/mobile-modal.png) |

Los ejemplos de fechas, autor y los pagos adicionales de prueba son datos reales de la base aislada; no se reemplazan por textos ficticios para la captura. Las acciones de Cancelar/Reprogramar/Prioridad/Clase del PDF pertenecen a otras HU: se conservan las implementaciones funcionales que ya incorpora develop. HU-I-01 añade su registro y total, sin reemplazar esos controles ni duplicar la consulta pública de pagos.

Revisión visual independiente inicial: disposición `fix` y pase final **`pass` limitado a F1–F4**; altura desktop 390×510, calendario al extremo derecho, datos móviles en dos columnas con autor abarcando ambas, opción activa visible y foco conservado con teclado. Al integrar develop una revisión fresca identificó cuatro regresiones de densidad del detalle; se ajustaron márgenes, proporción 2:1, tipografía y filas manteniendo los controles vigentes. Las capturas finales corresponden a la integración y el pase final de veredicto dio **`ship`**, con las cuatro correcciones resueltas. El detector de la habilidad no se pudo ejecutar porque su archivo carecía de permiso de ejecución; no se reporta un detector aprobado.

**Deuda preexistente fuera de alcance:** la navbar móvil recorta Cerrar sesión. No se modificó el shell dentro de HU-I-01.

## Integración y prueba final antes de publicar

Rama `feature/hu-i-01-registrar-pago`, basada en develop `c5e8294`. Se reutilizan `pago.publico.ts`, los tipos de `src/types/turno.types.ts` y el GET de detalle existentes; no se incorporan los dos commits de indicadores de la rama local anterior. El sidebar queda exactamente como lo define develop. `Total registrado` sigue la instrucción explícita del PDF, documentada aditivamente en spec I; representa la suma de pagos existentes, no un saldo esperado.

Playwright sobre producción integrada: Mesa de Entrada buscó `DOMINGUEZ`, recibió Transferencia como preferida y registró `0,45` con HTTP 201; observó el toast y el pago después de recargar. ID `cmup3gj810001jmgackt457fr`, turno `T-0602`, alumno Lara Domínguez, fecha `2026-10-01`, monto decimal `0.45`. El detalle devolvió cinco pagos y total exacto `18.026,05`; se conservaron Reprogramar, Asignar prioridad y Cancelar turno. Un contexto anónimo obtuvo `401 SESION_INVALIDA`. SQL confirma monto, alumno, forma y auditoría del mismo pago.

Las pruebas de errores, preferencias, permisos de Gerente/Profesor y estados vacíos de las secciones anteriores se ejecutaron durante la implementación inicial. La suite de integración vuelve a comprobar el contrato vigente; el humo funcional final usa la versión compilada sobre develop.

Veredicto final de integración: **ship**, limitado a las cuatro correcciones solicitadas. Playwright midió tarjetas desktop de 656/328 px (2:1), gap de 18 px y tarjetas móviles de 358 px con márgenes de 16 px, sin desborde del detalle. La navegación por teclado conservó foco, última opción visible y scroll de 38 px.
