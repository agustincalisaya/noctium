# Evidencia HU-I-02 — 13/10/2026

## Entorno y alcance

Rama `HU-F-02`, base `5745c88`, worktree `noctium-codex`. Todas las consultas y fixtures PostgreSQL de esta HU se ejecutaron en `noctium_i02_pg` (`127.0.0.1:55434`), con `DATABASE_URL=postgresql://postgres@127.0.0.1:55434/postgres`. El runner `scripts/test-pg.mjs` creó y eliminó bases descartables en ese mismo contenedor. La base compartida con Claude no se tocó.

Se regeneró Prisma Client y se aplicaron las 40 migraciones, incluida `20261013040000_hu_e11_anulacion_append_only`, únicamente en esta base. La migración agrega anulaciones append-only y la proyección de clases dictadas vigentes de E; no cambia tablas ni lecturas de pagos de I-02. No se agregaron migraciones a esta HU.

## Nivel 1 — unidad, componentes y rutas

- `vitest` dirigido a servicio, fachada pública, rutas y componente: **6 archivos, 78/78 pruebas** en la corrida final. Se verificaron queries inválidas, total decimal exacto y paginación, pagos anulados, correcciones, opciones históricas, permisos, cambio de modo, reintento, respuestas viejas, comprobantes y atajos.
- `tsc --noEmit`: pasó antes de la última refactorización del componente; el build final volvió a ejecutar el chequeo de TypeScript.

## Nivel 2 — HTTP real y colección Postman

`api-check.mjs` obtuvo sesiones reales de NextAuth de las cuentas seed de Mesa, Gerente, Profesor y Alumno; ejecutó los 11 GET contra `next dev` en el puerto 3005 y la base aislada. El alumno de prueba fue Sofía Fernández (`cmv69kx9e000ouwlgl09p746q`). **11/11 pasaron**: historial y opciones 200, estado 200 con 6 filas, combinación prohibida y fecha inválida 400, alumno inexistente 404, Gerente 200 y sin atajos, Profesor/Alumno 403 y sin sesión 401. Las respuestas no incluyeron saldo, deuda ni datos de caja. El guion no imprime ni persiste cookies. [Colección Postman](HU-I-02.postman_collection.json) con esos pedidos y aserciones; la ejecución automatizada fue por HTTP Node, no por Newman.

## Nivel 3 — PostgreSQL real

`node scripts/test-pg.mjs src/server/pagos/pago.historial.pg.test.ts src/server/turnos/inscripcion.lecturas.pg.test.ts` terminó con **2 archivos, 9/9 pruebas**. Los datos de cobro, corrección y anulación se crearon con los servicios del dominio y `conReloj`; el runner aisló y eliminó la base. La lectura no cambió las filas de pago, inscripción ni caja. La consulta SQL ejecutada en la prueba comprobó:

| Pago | Original | Vigente | Anulado |
|---|---:|---:|---|
| Corregido | 100.00 | 101.01 | No |
| Ajustado al registrar | 90.00 | 90.00 | No |
| Anulado | 100.00 | 100.00 | Sí |

El historial devolvió `total_pagado=191.01`, mantuvo el pago de la inscripción quitada y ofreció la forma inactiva usada y la materia del anulado. La lectura de C sin `estadoPago` conservó las tres inscripciones; el modo `PAGADA` excluyó la quitada y una reserva vencida sin marcar quedó excluida del estado Reservada. [Consulta SQL](HU-I-02.sql).

## Comparación visual

Referencias abiertas antes de construir la UI: `C:\Users\agust\Desktop\Imagenes HU\HU-F-02\Historial de pagos.png` y `Filtro por estado de pago.png`. Se compararon con capturas de la app local autenticada como Mesa, escritorio 1440×900 y móvil 390×844. En móvil se desplazó la vista hasta la tabla.

| Modo | Escritorio | Móvil |
|---|---|---|
| Historial | [Captura](historial-escritorio.png) | [Captura](historial-movil.png) |
| Estado | [Captura](estado-escritorio.png) | [Captura](estado-movil.png) |

La composición coincide en ficha/pestañas, filtros en dos filas, encabezado de historial con total, tabla, badges de reserva y botones de registro. La navegación lateral y cabecera siguen el diseño real de Noctium; los importes y nombres son los del seed aislado. En móvil, las columnas conservan legibilidad mediante desplazamiento horizontal. Chrome usó la fuente alternativa existente porque el entorno no pudo descargar Geist; no se cambió la configuración de fuentes.

## Checks finales

`npm run lint` pasó. Quedó un aviso preexistente en `src/components/layout/Sidebar.tsx` por `CALENDARIO` sin uso; no corresponde a esta HU. `npm run build` pasó con `DATABASE_URL` de la base aislada; compiló, ejecutó TypeScript y generó las páginas, incluidas `/alumnos/[id]/pagos` y ambas rutas de historial. El primer intento dentro del sandbox no pudo descargar la fuente Geist; la ejecución con acceso de red terminó con código 0. `git diff --check` pasó, con avisos de conversión LF/CRLF en Windows. La integración de botones Corregir/Anular (I-06) y la vista Mis pagos (I-05) quedan fuera del alcance de esta HU.

## Ajustes tras revisión del diff staged

Las etiquetas de estado de pago ahora usan las variantes semánticas de `Badge` y los tokens de DESIGN: `success` para Pagada, `warning` para Reservada y `outline` para Pago sin registrar (estas dos últimas según §6.6). Se retiraron los colores de la paleta Tailwind y las variantes `dark:*` escritas en el componente. Los encabezados llaman a `texto` con cada clave literal, sin interpolación ni casts.

`npx tsx scripts/verificar-claves-textos.ts` terminó con «Claves de textos verificadas». Requirió el ajuste local de `os.userInfo` ya usado para el seed, porque Node 24 en este Windows devolvió `uv_os_get_passwd ENOMEM` antes de ejecutar el script. La primera corrida de Vitest en paralelo con el verificador agotó el tiempo de inicio de un worker; repetida sola, la suite dirigida terminó con **6 archivos y 78/78 pruebas**. ESLint dirigido de `tabla-historial-pagos.tsx` pasó. Las capturas visuales de arriba preceden este ajuste de tokens; la estructura y los textos de las vistas no cambiaron.
