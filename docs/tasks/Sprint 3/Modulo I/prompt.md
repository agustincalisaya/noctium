Tarea: HU-I-02 — Ver el historial de pagos del alumno.

Contexto: trabajás en Noctium (Next.js App Router + TypeScript + PostgreSQL + Prisma + Tailwind + shadcn/ui). Verificá la versión real del proyecto y AGENTS.md; no asumas Next.js 15. En la base relevada el proyecto usa Next.js 16.

Rama: HU-F-02 (nombre indicado por Cali; la HU a implementar es I-02, no F-02). Trabajá en una carpeta/worktree distinta de la que usa Claude para feature/HU-C-26, a partir de develop actualizado. Si HU-F-02 ya existe, inspeccioná su base y contenido sin resetearla. Si la carpeta actual pertenece al trabajo de Claude, no cambies su rama ni sus archivos: informá el problema antes de seguir.

Spec de referencia: docs/specs/spec_modulo_I.md §2.13 (historial, opciones y modo estado de pago), §2.6.2 (valores vigentes) y §2.17 (lecturas públicas); spec C §2.18.4 (condición de cobro).
Task doc: docs/tasks/Sprint 3/Modulo I/HU-I-02.md — leelo completo. Es la guía operativa y referencia las specs sin reemplazarlas. Incluye inventario inicial, decisiones y coordinación con C-26.

Prototipo: Noctium_Prototipo.pdf, figuras 77 y 78, páginas 70 y 71 (historial de pagos y filtro por estado). Abrilas antes de construir el frontend. Si no están disponibles en tu entorno, informalo en Fase 1 y pedí la ubicación; no inventes una ruta de Windows ni marques la comparación visual como realizada. El mapa de pantallas de Sprint 3 se cita en las specs pero no se encontró en develop: usá el contrato y el prototipo, sin inventar ese documento.

Reglas de git (siempre): podés investigar libremente (git log, git blame, git status, git diff y git fetch), crear la rama/worktree propia si hace falta y hacer git add de los archivos de esta task. NUNCA hagas commit, push, merge, pull, rebase ni amend, ni reset, limpieza o descartes de cambios de otra persona. Si la base requiere actualización que implique una operación prohibida, informá qué debe hacer el usuario, preservando sus cambios. Dejá el resultado en working tree/staged para mi revisión.

Trabajo en dos fases:

FASE 1 — Relevamiento (no implementes nada todavía):
- Leé AGENTS.md, docs/RULES.md, docs/DESIGN.md y docs/adicionales/sdd-metodologia.md completos, el task doc completo y las secciones normativas de las specs/PR 0 que referencia.
- Verificá la rama y base actual, los cambios locales y las dependencias reales (I-01, I-10, I-11, L-06, B-04 y acceso de gerente de E-02).
- Verificá listarPagosDeAlumno, obtenerClasesBasicas, listarInscripcionesDeAlumno, puedeCorregirPago, permisos, comprobantes y preselección de /pagos/registrar?alumno=&clase=.
- Contrastá cada campo del response de §2.13 con las lecturas reales: precio congelado, valores vigentes, ajuste/actor, comprobante, cambios y datos para puede_corregir. Reportá lo que falte y su extensión aditiva propuesta; no consultes tablas ajenas directamente ni dupliques lecturas.
- Mirá las figuras 77 y 78.
- Aplicá las decisiones resueltas de §0.4. Para las propuestas, informá la solución recomendada y cualquier contradicción real; no vuelvas a abrir decisiones ya resueltas.
- Respondeme con confirmación de lo existente, lista exacta de archivos a crear/modificar, puntos genuinamente ambiguos y solapamientos concretos con Claude.
- Esperá mi OK explícito antes de Fase 2. No escribas ni modifiques código todavía.

FASE 2 — Implementación completa (recién después de mi OK):
- Implementá la task de punta a punta: schemas Zod, listarHistorialDePagos y opciones, dos GET de historial, tipos, pestaña Pagos de la ficha y frontend completo de ambos modos.
- Historial: pagos del alumno, precio congelado, monto/fecha/forma vigentes, usuario, ajuste cuando corresponda, comprobante y anulados visibles sin sumar. Filtros combinables, orden y paginación de 10; total decimal exacto de TODO el resultado filtrado.
- Estado de pago: clases Disponibles/Completas con inscripción vigente; fecha filtra clase, forma/materia se limpian y deshabilitan. Reutilizá vigencia de C; excluí reservas vencidas sin marcar. Mostrá el atajo de cobro solo para mesa y clases cobrables que todavía no empezaron; usá I-10 existente sin crear otro modal.
- Opciones por pagos del alumno, incluidas formas inactivas usadas y pagos anulados. No usar el catálogo general de materias activas.
- No implementes I-06, I-05, N-01, caja, reservas globales ni saldo/deuda. No agregues migraciones ni cambies schema, seed base o wizard de cobro.
- No vuelvas a preguntarme decisiones confirmadas en Fase 1. Reportá una contradicción nueva de contrato si aparece antes de resolverla silenciosamente.
- Respetá la coordinación de §0.5: en inscripcion.lecturas.ts tocá únicamente listarInscripcionesDeAlumno y su tipo; no modifiques/reformatees resumenReservas, listarReservasPendientes ni listarReservasVencidas. Claude puede ampliar esta última para profesor/aula. Conservá comportamiento de los otros consumidores cuando no se usa estadoPago.
- Agregá textos solo bajo ui.pagos.historial.*, sin tocar ui.reservas.*. Sumá notas acotadas de I-02 en RULES y DESIGN preservando las de C-26. No modifiques Sidebar, proxy/rutas de reservas ni quitarAlumnoTurno.
- No compartas ni reinicies la BD que usa Claude. Usá datos aislados y servicios del dominio para pruebas.
- Escribí y EJECUTÁ pruebas unitarias, API/Postman y PostgreSQL según §6. Dejá evidencia en docs/testing/Modulo I/hu-i-02/, con capturas de ambas vistas en escritorio/móvil y comparación con el prototipo.
- Ejecutá checks apropiados del proyecto; distinguí fallos previos y criterios bloqueados de fallos nuevos. No declares pruebas ejecutadas si solo escribiste scripts.
- Recorré el DoD de §7; actualizá la task con archivos finales, decisiones y evidencia real.
- Hacé git add solo de archivos de esta tarea, sin commit. Avisame que está listo para revisar el diff, indicando checks, bloqueos y archivos compartidos que requerirán integración con C-26.
