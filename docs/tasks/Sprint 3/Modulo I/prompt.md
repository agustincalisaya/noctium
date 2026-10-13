El PO validó HU-I-10 y encontró un bloqueante real, ya verificado contra el código de develop (no es apreciación, confirmé la causa exacta).

BLOQUEANTE: el botón "Registrar pago" viejo de HU-I-01 sigue activo en el detalle de la clase, en la tarjeta "Pago" (src/app/(dashboard)/turnos/[id]/turno-detalle.tsx:72, componente registrar-pago-dialog.tsx). Esto es aparte del botón "Registrar pago" por alumno en la lista de inscriptos (turno-alumnos-card.tsx), que SÍ usa el flujo nuevo vía HU-C-24 y no se toca.

Causa verificada: el diálogo viejo llama a POST /api/pagos → registrarPago() → registrarOperacion(tx, { modo: "compatSprint2" }). En src/server/pagos/operacion.service.ts casi toda la revalidación nueva está condicionada a `completo` (true solo si modo === "completo"), así que en modo compat se saltea:
- la validación de clase ya empezada,
- el bloqueo de un segundo pago sobre la misma inscripción (contarPagosNoAnulados),
- el motivo obligatorio cuando el importe difiere del precio.
Además el diálogo no tiene el paso de confirmación de HU-C-25 (envía directo al submit).

La task HU-I-10 dejó este botón fuera de alcance "hasta que se integre HU-C-24", que ya está integrada. Lo que falta es sacar el botón viejo (no solo deshabilitarlo: ya expone un camino que rompe reglas de negocio).

Decisión a tomar antes de programar: ¿sacamos directamente RegistrarPagoDialog de turno-detalle.tsx y la tarjeta "Pago" (TurnoPagoCard) pasa a ser solo lectura de pagos existentes, con el registro de pago yendo siempre por el botón de la fila del alumno o por el menú "Registrar pago"? Revisá si TurnoPagoCard necesita algún otro ajuste al perder ese botón, y si el endpoint POST /api/pagos (modo compatSprint2) queda sin ningún llamador en el frontend — si es así, decime si conviene eliminarlo entero (servicio, ruta, schema) o dejarlo (puede que algún test o integración externa lo use; revisá antes de borrar).

No bloqueantes, para la misma vuelta:
1. src/lib/textos.ts, clave "ui.pagos.importe.usarPrecio": cambiar "Usar el precio de la clase" por "Usar el precio" (texto literal de la HU, criterio 4).
2. src/app/(dashboard)/turnos/buscador-alumnos.tsx líneas 42 y 44: el string "No se pudo buscar alumnos" está hardcodeado dos veces. Centralizalo en textos.ts (clave nueva, p. ej. "ui.turnos.buscador.errorBusqueda") y usá texto() en ambos lugares.
3. src/app/(dashboard)/pagos/registrar/registrar-pago-wizard.tsx línea 24: MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente." está hardcodeado. Centralizalo en textos.ts.

NO toques claves-textos.test.ts (el timeout a 60s es ajeno a esta HU, confirmado que corriendo por línea de comandos pasa).

Antes de programar, confirmame tu lectura del alcance (especialmente la decisión sobre RegistrarPagoDialog/TurnoPagoCard/el endpoint viejo) y esperá mi aprobación.

Al terminar: npx vitest run, npx tsc --noEmit, lint. Actualizá docs/tasks/Sprint 3/Modulo I/HU-I-10.md con esta corrección (causa y qué se sacó/cambió).

IMPORTANTE: NO ejecutes git commit, git push ni ningún comando de git que finalice cambios. Eso lo hago yo. Podés usar git status, git diff y git log.