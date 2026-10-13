# HU-D-08 — Evidencia

> Evidencia histórica de la implementación inicial. La selección por página descrita aquí fue corregida según el criterio 2 y la revisión de #169. Ver [evidencia actual de selección por filtro](seleccion-filtro/README.md).

Base: `develop` en `10e3ffb`. Todas las mutaciones de prueba se hicieron en bases PostgreSQL descartables; no se modificó la base de desarrollo. Se conservaron las cuentas oficiales.

## UI y API

Chromium mediante MCP Playwright, Gerente oficial. Comparación con figuras 58–64: agrupación de datos e historial a izquierda, materias y cuenta a derecha; resolución con filtro, tabla de diez, acciones en lote, vista previa, resultados por fila y confirmación reversible de baja. Se mantienen el shell y componentes integrados del proyecto.

- `ficha.png`, `confirmacion-baja.png`, `futuras.png`, `preview.png`, `parcial.png`, `cancelacion.png`: estados equivalentes a figuras 58–64 con datos reales del seed descartable.
- `futuras-movil.png`: 390 × 844, sin desbordamiento de la página; la tabla permite desplazamiento horizontal y el modal vertical. `baja-movil-primera-revision.png`: foco visible del motivo.
- `sin-futuras.png`: después de resolver las restantes se ofrece Desactivar profesor. Se comprobó motivo obligatorio por historia, baja y reactivación, materias/horarios preservados e historial con usuario y motivo.
- Teclado: Escape cierra la confirmación; Tab permanece dentro de AlertDialog. Los controles de fila tienen nombres accesibles.
- Selección: 21 clases totales, diez seleccionadas en página 1; cambiar a página 2 dejó cero seleccionadas. Filtro limpia selección. Un cambio parcial movió una clase y mantuvo nueve fallidas seleccionadas; otro movió dos y mantuvo ocho. Se cancelaron las fallidas y luego las restantes, sin restaurarse al reactivar.
- Los archivos con `primera-revision` conservan el primer pase: aún mostraban plural para una clase. Se corrigió con claves singulares centralizadas y se verificó en el segundo pase.
- Los ids `seed-turno-*` hicieron visible una incompatibilidad del esquema CUID inicial. Se corrigió sin modificar datos y se volvió a ejecutar el flujo tras reiniciar el servidor de desarrollo.

`resultados-http.json`: las siete rutas retornaron 403 `SIN_PERMISO` para Mesa, Profesor y Alumno, con sesiones reales. Una sesión anterior a la baja recibió 401; restaurar esa misma cookie después de reactivar siguió dando 401. El intento de login inactivo mostró el mensaje previsto y el nuevo login tras reactivar llegó a `/home`. La renovación del inicio original y el caso de milisegundos se cubren también con tests del token/guard.

La colección Postman contiene las siete rutas y verificación del envelope; **no se ejecutó en Postman**. La evidencia HTTP proviene del navegador/API real. Completar variables y usar una cookie oficial solo sobre base descartable.

## PostgreSQL

`docs/testing/HU-D-08.sql` y `resultado-sql.json`: ficha y cuenta, revocación conservada, contraseña y número de cambios de estado de las fixtures de D-08.

Diez casos específicos verifican baja/reactivación con y sin cuenta, versión/unicidad/historial, motivo por clases pasadas, futuras bloqueantes y Pendientes, filtros/paginación, cancelación conservando inscripción y pago, trigger de reservas, cambio parcial, rollback después de actualizar cuenta, doble baja y bloqueo frente a creación/confirmación/reprogramación. Las tres carreras usan la baja real. Para creación/confirmación, un punto de sincronización detiene la baja después de tomar el bloqueo real; ambas operaciones esperan y releen actividad después de su commit.

Suite PostgreSQL completa final: dos fallos en H-03 y E-10, reproducidos en un checkout limpio del commit base; D-08 no añade fallos. La primera ejecución introducía interferencia del seed por alumnos de prueba: se corrigió aislando esas filas al terminar la suite D-08; la regresión del seed completo volvió a pasar. Las bases nombradas de regresión también se ejecutaron.

## Límites

I-06 (registro efectivo del reintegro) queda fuera de esta HU: solo se muestra su instrucción cuando existen pagos. La evidencia no certifica todas las pantallas del sistema. Los selectores reutilizan consultas de profesores activos existentes; se comprobaron Nueva clase, generación y calendario antes/durante/después de baja, además de Solicitar clase durante la baja. Reactivar no crea horarios disponibles si sus clases fueron canceladas. Las operaciones protegidas revalidan actividad bajo bloqueo.

Unidad: 2.652 aprobados, 292 PostgreSQL omitidos sin entorno. Lint: cero errores y una advertencia previa de Sidebar. Claves verificadas. TypeScript pasa después de `next typegen`; se apartó el archivo generado corrupto del dev detenido.

La build local con Turbopack falló por restricciones del entorno: descarga de fuentes bajo sandbox y luego puerto interno de procesamiento CSS. Se verifica la build de producción con `--webpack`; la build por defecto se verificará además en CI. Build de producción con webpack aprobada, incluyendo TypeScript y generación de páginas. CI del SHA final se verifica en la PR.
