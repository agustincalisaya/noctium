# HU-C-19 — Evidencia

Base: develop `e753682` (PR #239 integrada). Relevamiento confirmado explícitamente por el usuario. La interfaz usa Clase/Clases y sus concordancias mediante `texto()`; las claves anteriores, URLs `/turnos`, enums, códigos, permisos, SQL y eventos siguen vigentes. No hay cambios en schema, migraciones, persistencia ni reglas.

## Regresión dirigida

Ejecuciones secuenciales, prioridad baja y un worker; sin build local ni suite PostgreSQL global:

- Catálogo y estados: 3 pruebas aprobadas. Valores centrales sin la palabra Turno; estados internos PENDIENTE/DISPONIBLE/COMPLETO/CANCELADO conservados y etiquetas Pendiente/Disponible/Completa/Cancelada.
- Regresión de 37 archivos, 656 casos: primera ronda 628 aprobados y 28 fallidos; se corrigieron concordancias, espacios y expectativas de presentación. Repetición de los 13 archivos afectados: 267 aprobados y 2 fallidos por expectativas anteriores; última ronda focal: 68 aprobados en 4 archivos, incluidos esos casos.
- Tras el recorrido, cierre de 7 archivos (139 casos): 137 aprobados y 2 fallidos de la tarjeta de datos. Se corrigió una colisión entre claves nuevas; repetición de esa tarjeta: 40 aprobados. Las otras 6 suites del cierre estaban aprobadas. Incluye el servicio de generación y mantiene los límites de cantidad/horario.
- Lint dirigido, TypeScript y checker C-23 finales: exit 0. Una advertencia preexistente CALENDARIO sin uso en Sidebar; sin errores. `git diff --check` sin errores.

Las expectativas conservan rutas, IDs, códigos, status y comprobaciones funcionales. El control de POST /api/pagos ahora comprueba la referencia al catálogo junto con su código y status; conserva la cobertura del contrato. No se atribuyen solicitudes HTTP ni PostgreSQL a mocks.

## Navegador y HTTP reales

Chromium mediante Playwright MCP configurado. Escritorio 1366×900 y móvil 390×844. Cuentas oficiales Gerente, Mesa de entrada, Profesor y Alumno; base descartable D-08 existente, sin seed adicional ni mutaciones de negocio para producir evidencia.

| Rol | Vistas comprobadas | Resultado |
|---|---|---|
| Gerente | Home, Clases, detalle mediante enlace `/turnos`, calendario por profesor con selección y Mes | Clase/Clases, Cancelada y textos accesibles actualizados; conserva enlaces |
| Mesa de entrada | Home, Clases, Nueva clase individual y recurrente | Migas Nueva clase, navegación Progreso de la nueva clase, Generar varias clases; selección de Materia por teclado |
| Profesor | Home, Clases filtradas y calendario | Presentación y menú actualizados; lectura de detalle ajeno responde 403 |
| Alumno | Home, Mis clases/Próximas/Anteriores y Solicitar clase | Terminología femenina y diseño vigente de tarjetas; listado administrativo responde 403 |

En las vistas y atributos accesibles inspeccionados no quedó Turno. Mesa, Profesor y Alumno se comprobaron también a 390 px, sin desborde horizontal del documento. No se afirma que cada variante de cada pantalla se haya recorrido: los estados/modales adicionales se cubren con las pruebas dirigidas y la auditoría estática.

HTTP Gerente `/api/turnos/c19-inexistente`: 404, `TURNO_NO_ENCONTRADO`, «No se encontró la clase». HTTP Profesor `/api/turnos/seed-turno-01` y Alumno `/api/turnos`: 403, `SIN_PERMISO`. Al comenzar se descartó una cookie JWT vieja del contexto reutilizado; los logins posteriores funcionaron y la consola final del recorrido estaba sin errores.

Figuras 8/9: se verificaron menú y título Clases, búsqueda, columnas, estados femeninos y Mis clases/Próximas. Se conserva el diseño integrado de la aplicación; las fechas, nombres y cantidades son los del seed descartable y no los datos del prototipo. La acción existente Configurar clase mantiene el flujo anterior.

## Auditoría transversal y límites

La revisión AST de literales/templates/JSX cubre src, incluyendo ayudas, rótulos pasados como JSX, errores ServiceError, migas y aria. Las coincidencias restantes son técnicas y están clasificadas en [inventario.json](inventario.json). Los invariantes de calendario/historial y logs técnicos se conservan; sus fallos inesperados no se muestran literalmente al usuario.

Metadata: título Noctium sin terminología antigua. Email de recuperación/contacto existente: sin Turno. Servicios de comprobante existentes: datos y contratos sin copy antiguo. I-11/I-12 aún no tienen pantallas de impresión en esta base; su revisión visual se difiere a esas historias. Repetir esta auditoría cuando se integren y al cierre del sprint (CA8).

No se ejecutó una nueva prueba PostgreSQL ni TablePlus: la HU cambia presentación y mensajes, no escrituras o contratos de BD. No se declara cobertura global del sistema. Build y controles completos requeridos se verifican en CI sobre el SHA publicado.
