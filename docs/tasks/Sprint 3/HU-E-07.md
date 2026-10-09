# HU-E-07 — Registrar observaciones de la clase

**Módulo:** E (Atención académica / Historial) · **Sprint:** 3 · **SP:** 1
**Contrato:** docs/tasks/Sprint 3/HU-Sprint-3.md, HU-E-07 · docs/specs/spec_modulo_E.md §§2.3, 2.6.3, 2.8 y 2.12 · docs/tasks/Sprint 3/PR-0.md §§2.9, 2.10, 2.13 y 2.16 · docs/RULES.md · docs/DESIGN.md.
**Prototipo:** Figura 68, página física 61 de Noctium_Prototipo.pdf.
**Issue:** #172.
**Estado:** implementada y verificada con evidencia incluida.

## Alcance aplicado

La Figura 68 coincide con los dos campos, contadores y acción de registro. La confirmación de HU-C-25 prevalece sobre el botón directo del dibujo. La spec define el POST /api/turnos/[id]/clase-dictada/observaciones, persistencia en ObservacionClase ya existente por PR-0 y ampliación del GET de clase dictada y del historial académico.

La inspección y el inventario de archivos se aprobaron explícitamente antes de implementar. No se modifican schema.prisma, migraciones ni RBAC: el modelo, la unicidad y el permiso ya existen en PR-0. No se ofrecen edición ni borrado. El campo interno no se agrega a la fachada pública obtenerClaseDictadaDeTurno().

## Archivos implementados

- docs/tasks/Sprint 3/HU-E-07.md: alcance aplicado, verificación y diferidos.
- src/server/historial/observacion-clase.schema.ts y pruebas: validación estricta, recorte de extremos y límites.
- src/server/historial/observacion-clase.service.ts, pruebas unitarias y PostgreSQL real: permiso por rol y titularidad, persistencia transaccional, auditoría, concurrencia y lectura con privacidad.
- src/app/api/turnos/[id]/clase-dictada/observaciones/route.ts y route.test.ts: contrato JSON y códigos de estado.
- src/app/(dashboard)/turnos/[id]/registrar-observaciones-dialog.tsx y pruebas: formulario, contadores, errores, estados de envío y confirmación C-25.
- src/server/historial/clase-dictada.service.ts y pruebas: GET incorpora observación, autor, fecha y permiso de registro sin ampliar la fachada pública.
- src/server/historial/historial.service.ts y pruebas: temas y privacidad del texto interno.
- src/types/historial.types.ts, src/lib/textos.ts y src/lib/turno-detalle.ts: tipos y presentación local de metadatos.
- src/app/(dashboard)/alumnos/[id]/historial-academico.tsx y pruebas; src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx, turno-clase-card.tsx y turno-detalle.test.tsx: visibilidad en el detalle y el historial.
- prisma/seed/fixtures/hu-e-07.ts y prisma/seed/fixtures/index.ts: escenario de muestra idempotente sobre la clase de HU-E-09.
- docs/DESIGN.md: patrón nuevo Dialog, confirmación C-25 y toast conforme a §6.4.
- docs/testing/HU-E-07.sql, HU-E-07.postman_collection.json, HU-E-07-evidencia.md y docs/testing/hu-e-07/: guía técnica y resultados.

No fue necesario modificar src/app/api/turnos/[id]/clase-dictada/route.ts: el sobre y el permiso de lectura existentes ya admitían la ampliación del servicio.

## Criterios de aceptación

1. El formulario aparece solo para una clase dictada vigente que aún no tiene observaciones. Temas vistos es obligatorio; el texto interno es opcional; ambos admiten 1000 caracteres. Se recortan extremos, se rechaza el obligatorio vacío o compuesto por espacios, se muestra el contador y se confirma con C-25.
2. Solo Mesa de Entrada o el profesor titular registra. Otro profesor recibe 403; clase inexistente o anulada recibe 404 CLASE_NO_REGISTRADA.
3. Hay una sola observación por clase dictada. En escrituras concurrentes, una gana y la otra recibe 409 OBSERVACIONES_YA_REGISTRADAS. El alta responde 201 con textos, email de autor y fecha.
4. El detalle de turno y el historial muestran temas y metadatos. El texto interno solo se entrega a Mesa, Gerente y profesor titular; no se ofrece edición.
5. La interfaz preserva el formulario en errores, muestra el toast literal de éxito y funciona con teclado en los tamaños probados.

## Verificación

- Suite completa: 147 archivos aprobados, 27 omitidos; 1.944 pruebas aprobadas y 182 omitidas.
- PostgreSQL real aislado: cinco pruebas aprobadas de HU-E-07, incluyendo concurrencia, permisos, auditoría, clase anulada y una nueva clase del mismo turno.
- Playwright real: POST 201, GET de detalle e historial 200; comprobado que ambos devuelven los textos con los permisos esperados. Escritorio 1440 × 1000 y móvil 390 × 844. El Escape descarta el formulario; Tab/Enter abre la confirmación y el foco inicial queda en Volver. La consola del navegador no mostró errores.
- Responsive: el documento no tiene overflow horizontal a 390 px y los diálogos caben en el viewport. El encabezado compartido del sitio recorta parte del botón Cerrar sesión en esa anchura; no forma parte del inventario aprobado y no fue modificado en esta HU.
- npm run lint terminó sin errores y con un aviso preexistente de variable sin uso en src/components/layout/Sidebar.tsx:46.
- npx tsx scripts/verificar-claves-textos.ts pasó.
- npm run build -- --webpack compiló, verificó tipos y generó las rutas. La variante Turbopack no se usa en este worktree porque el enlace de node_modules apunta fuera de su raíz; se validó el build oficial con webpack.
- La fixture se ejecutó dos veces contra una base temporal y quedó idempotente. La comprobación SQL de solo lectura se adjunta.
- Capturas y respuestas de lectura: docs/testing/hu-e-07/.

## Diferidos

- E-08 añade la vista del alumno en «Mi historial»; esta HU entrega el registro a los lectores autorizados del historial existente.
- E-11 integra la corrección/anulación completa de clase; esta HU ya oculta en servicio una observación si la clase se anula y admite una nueva observación en una clase posterior, cubierto por la prueba PostgreSQL.
