# Evidencia de HU-E-07

Se implementó el registro inmutable de observaciones de una clase dictada. El endpoint transaccional valida el permiso específico y que el profesor sea titular; el detalle y el historial incluyen temas, autor y hora, y filtran el texto interno según rol y titularidad. La fixture usa la clase de muestra estable de HU-E-09 y no agrega migraciones ni permisos.

## Resultado de verificación

- Pruebas completas: 147 archivos aprobados, 27 omitidos; 1.944 pruebas aprobadas y 182 omitidas.
- Prueba PostgreSQL real con instancia local desechable: cinco aprobadas, incluyendo dos escrituras simultáneas, privacidad, titularidad, auditoría y clase anulada/nueva.
- Lint sin errores; un aviso existente de variable sin uso en Sidebar.tsx:46.
- Verificación de claves de textos aprobada.
- Build con webpack completado con TypeScript y rutas generadas.
- Seed de HU-E-07 ejecutado dos veces: la segunda ejecución no duplica la observación.
- Playwright en Chromium: escritorio 1440 × 1000 y móvil 390 × 844. POST de alta respondió 201; detalle e historial respondieron 200 y mostraron temas, nota interna, fecha/hora y email del autor. Sin errores de consola.
- Teclado: el formulario inicia en Temas vistos; Tab alcanza Continuar; Enter abre HU-C-25 con foco en Volver; Escape cierra el diálogo sin guardar. El formulario puede cancelarse y preserva el texto al fallar la validación.
- En móvil, la página no genera scroll horizontal y los diálogos caben en el viewport. El encabezado compartido recorta parte del botón Cerrar sesión a 390 px; ese componente queda fuera del alcance aprobado de esta HU.

Las respuestas GET de ejemplo están en get-class-response.json y get-history-response.json. Las capturas de escritorio y móvil se encuentran en hu-e-07/.

## Capturas

- desktop-detalle-sin-observacion.png: acción disponible antes del registro.
- desktop-form.png y desktop-confirmacion.png: formulario y confirmación C-25.
- desktop-detalle-con-observacion.png y desktop-detalle-observacion-interna.png: detalle actualizado y metadatos.
- desktop-historial-observacion.png: observación en el historial.
- mobile-form.png y mobile-confirmacion.png: flujo responsive y foco inicial accesible.
- mobile-historial-observacion.png: tarjeta del historial en viewport móvil.

## Evidencia PostgreSQL y reproducción manual

HU-E-07.sql consulta los registros de ejemplo y verifica que no haya más de una fila por clase. HU-E-07.postman_collection.json contiene la lectura, un alta válida, la validación 400 y el duplicado 409. Configure baseUrl, turnoId, alumnoId y sessionCookie con un usuario autorizado de la base de pruebas. No se incluyen credenciales.

La evidencia transitoria se generó en una instancia PostgreSQL local separada del servicio histórico, que permaneció intacto. No se guardó ningún secreto de autenticación en este repositorio.
