# Validación PO — HU-E-04 y HU-E-08

Fecha: 13/10/2026. Rama: `fix/hu-e-04-e-08-validacion-po`, base `origin/develop` en `8882cc2`. No se modificó la base de desarrollo: se usó PostgreSQL local con bases descartables, migraciones completas y fixtures propios.

## Cambios y contrato

E08 autoriza explícitamente desglose del historial filtrado completo, descripción pública y nombre de autor del examen, nombre/fecha de registro de indicaciones y aula/horario de clases. Ver [especificación E](../../../specs/spec_modulo_E.md), revisión PO del 13/10/2026; las lecturas acotadas se documentan también en A y C. `descripcion_publica` es un campo nuevo: no se copiaron observaciones históricas ni se entregan al alumno.

E04 requiere contexto de origen firmado para Profesor, independiente del vínculo opcional a clase dictada. Valida usuario, alumno, materia, origen y primer dictado propio vigente. Mesa de Entrada conserva ambas variantes. Se quitó Alumnos del menú del Profesor y se ajustaron las confirmaciones E04/E07/E10/E11.

## Playwright reproducible

Instalar dependencias y navegador: `npm ci` y `npx playwright install chromium`. Con PostgreSQL local disponible y otro `next dev` de este repositorio cerrado:

```sh
npm run test:e2e:historial
```

Opcional: `PG_PRUEBAS_ADMIN_URL` permite elegir un PostgreSQL local de pruebas diferente de `DATABASE_URL`; `HISTORIAL_PO_PORT` cambia el puerto 3100. El runner crea una base `noctium_pruebas_po_<aleatorio>`, aplica migraciones, ejecuta seed y fixtures, compila e inicia Next.js en producción y ejecuta las pruebas; al terminar cierra Next.js y elimina únicamente esa base. No migra ni escribe en la base original. Los fixtures solo admiten bases cuyo nombre comienza con `noctium_pruebas_`.

Validación final:

- **Playwright: 7/7** sobre la compilación de producción (13,9 s), con API y PostgreSQL reales para datos/autorización.
- **Vitest completo: 4097 aprobadas**, 517 omitidas por sus guardas existentes; 307 archivos aprobados y 62 omitidos. Comando: `npm test -- --maxWorkers=4`.
- **PostgreSQL del módulo E: 40 aprobadas** y una prueba de seed aislada; después del ajuste de nombres/fachadas, **7/7** de E04/E08 reejecutadas y aprobadas.
- **Compilación de producción**, TypeScript, ESLint de los archivos revisados y `git diff --check`: aprobados.

Suite: [historial-po.e2e.ts](../../../../scripts/testing/historial-po.e2e.ts). Resultado legible por máquina: [playwright-resultados.json](playwright-resultados.json).

| Caso | Evidencia verificada |
| --- | --- |
| Historial completo, más de 10 | 12 clases + 2 exámenes + 2 indicaciones; páginas 10 + 6; desglose idéntico en ambas y en página 99 vacía |
| Filtro | Física I: 6 clases + 1 examen + 1 indicación; vuelve de página 2 a 1 |
| Tres tipos y privacidad | Datos reales de API; texto público y autor legible; sin secretos internos, exámenes anulados, clases anuladas ni campos administrativos |
| Histórico incompleto | Examen sin descripción ni autor: solo se omiten esos detalles, fecha/materia/nota permanecen |
| Responsive | 320, 390, 768 y 1440 px: ancho de documento y main sin desbordamiento; nota debajo del título en móvil y a la derecha en escritorio |
| Estados | Carga con respuesta retenida; error inyectado solo para verificar recuperación; reintento consulta la API real; vacío literal de cuenta sin registros |
| E04, dos materias propias | Contexto de A con materia B: 403, sin alta; A con contexto válido: 201 por formulario real |
| E04, contexto | Ausente, firma alterada u otro alumno: 403, sin alta |
| E04, futura | Botón deshabilitado y leyenda; POST con contexto válido de origen futuro antes de primer dictado: 403 |
| E04, ajeno | Otro profesor: API 403 y navegación a sin-permiso |
| E04, Mesa | Dos POST válidos: con vínculo y sin vínculo/origen, ambos 201 |
| C25, E07/E10/E11 | Resumen real de temas e internas; valores anterior/nuevo y motivo del examen; hora, alumno y estados de asistencia; foco en Volver y motivo conservado tras rechazo inline de anulación |

Las respuestas 403 y 500 inducidas son parte de las pruebas y no defectos inesperados de consola. El error de E08 se simula mediante interceptación de Playwright; las verificaciones de datos y autorización usan la API y PostgreSQL reales.

## Comparación con el prototipo

[Comparación visual escritorio/móvil](comparacion.html), con referencia a la figura 76, página 69 de `Noctium_Prototipo.pdf`.

| Composición | Prototipo | Implementación |
| --- | --- | --- |
| Encabezado | Título/subtítulo compactos | Conservados en la identidad visual existente |
| Filtro y desglose | Juntos | Juntos en escritorio; se ajustan a dos líneas en móvil |
| Línea de tiempo | Una tarjeta con filas, fecha, punto, materia y etiqueta | Misma jerarquía, separadores sutiles y tres etiquetas textuales |
| Nota | A la derecha | A la derecha en escritorio; línea propia en móvil |
| Asistencia | Texto por clase | Presente/ausente/sin control; sin control en estilo neutro, porcentaje arriba |
| Contenido histórico incompleto | Ejemplos completos | No se inventan descripciones ni nombres inexistentes |

Capturas: [escritorio](e08-desktop.png), [móvil](e08-mobile.png), [móvil con texto largo](e08-mobile-texto-largo.png), [filtro](e08-filtrado.png), [error](e08-error.png), [vacío](e08-vacio.png), [confirmación E04](e04-confirmacion.png), [clase futura E04](e04-futura.png), [confirmación de asistencia E11](e11-confirmacion-asistencia.png) y [error de anulación E11](e11-error-anulacion.png). La captura móvil filtra Física I para mostrar los tres tipos en el mismo viewport; la de texto largo conserva todas las materias.

## Limitaciones documentadas

- No es fiable deducir una descripción pública a partir de observaciones existentes. Exámenes históricos mantienen descripción null; los nuevos pueden cargarla en el formulario separado.
- Un usuario sin ficha no aporta un nombre legible: no se reemplaza por email o identificador.
- Aula/horario pertenecen al turno conservado; no existe una fotografía histórica independiente para reconstruir modificaciones anteriores.
- El DTO propio no incorpora la clase vinculada de la indicación del ejemplo visual; muestra autor y fecha/hora de registro, conforme al pedido.
- El sidebar del alumno y la cabecera global mantienen la navegación existente; el alcance visual se concentra en `/mi-historial`.
- Un contexto legítimo de otra navegación propia puede reutilizarse mientras siga válido. La firma impide editar alumno/materia/turno dentro de un contexto; no identifica cuál pestaña está activa. Vence a las dos horas y se renueva al reabrir el historial.
