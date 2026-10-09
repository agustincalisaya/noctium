# HU-H-07 — Evidencia de verificación

**Issue:** #208 · **Fecha:** 08/10/2026 · **Estado:** implementación y controles individuales; integración final pendiente.

## Controles individuales ejecutados

- Unitarias de servicio, esquema y tres Route Handlers: 51 pruebas aprobadas en 5 archivos.
- Preselección de materia en la ficha, conservando verificación granular de permisos: 1 prueba aprobada.
- Pestaña de presentismo: 4 pruebas aprobadas con gráfico/hook de H06 mockeados; cobertura de series, aviso cero, enlace, paginación/reset, error/vacío independientes. Esto no sustituye revisión del gráfico real.
- PostgreSQL real: 5 pruebas aprobadas en `src/server/historial/asistencia.pg.test.ts` y `src/server/indicadores/presentismo.pg.test.ts`, mediante `npm run test:pg` sobre base descartable con las 38 migraciones. Comprueba estados corregidos, anuladas, conteo de clases sin control, mínimo dos clases, umbral exacto 75 %, once grupos y total correcto en páginas 1, 2 y fuera de rango. Primer intento del test nuevo falló por hora no rellenada con cero en fábrica; corregido el dato de prueba y repetida la suite satisfactoriamente.
- ESLint sobre servicios, esquema y componente propios: aprobado.

## Receta determinista de demostración

`prisma/seed/fixtures/hu-h-07.ts` usa el helper de HU-E-09 y los servicios de configuración, asignación y registro, sin inserciones directas en turnos, inscripciones ni asistencias. Recursos del seed base: Laura (`profesor1@noctium.local`), usuario `mesa.entrada@noctium.local`, aula activa de mayor capacidad y doce alumnos activos ordenados por DNI. Clave natural: fecha/hora/profesor/materia, a las 11:00.

| Clases del fixture H07 | Materia | Inscriptos con control | Presentes | Ausentes | Índice |
| --- | --- | ---: | ---: | ---: | ---: |
| 04–07/05/2026, cuatro clases | Matemática | 48 | 25 | 23 | 52,1 % |
| 01–02/06/2026, dos clases | Física | 24 | 24 | 0 | 100 % |
| 03/06/2026, una clase sin control | Física | Excluidos | Excluidos | Excluidos | — |
| Resumen mayo–junio, solo fixture H07 | Ambas | 72 | 49 | 23 | 68,1 % |

Once grupos alumno/Matemática tienen 50 % (cuatro clases, dos ausencias); el duodécimo tiene exactamente 75 % y queda afuera de la tabla con umbral 75. Todos tienen 100 % en Física. El fixture aporta una clase sin control, no doce. Página 1: diez grupos; página 2: uno; fuera de rango: cero filas con total once. Otros datos de la base pueden sumarse al consultar un rango amplio; aislar estas fechas/turnos para contrastar aportes del fixture.

## Verificación final integrada — 09/10/2026

Validación sobre una rama local de revisión con E09, H06 y H07; cada rama de entrega mantiene únicamente su historia. Base PostgreSQL descartable local, sin modificaciones en una base compartida.

- `npm test`: **1851 aprobados**, 177 PostgreSQL omitidos por diseño; esos casos se ejecutaron separadamente.
- `npm run test:pg`: **177 aprobados** (143 + 18 + 16), migraciones reales, bases temporales eliminadas por el runner.
- Next.js build webpack y TypeScript: aprobados con Node 24.21.0. ESLint: cero errores; un warning preexistente de `CALENDARIO` en Sidebar.
- Catálogo de textos y detalle después del último ajuste de confirmación: 44 aprobados. Componentes de indicadores: 16 aprobados después del ajuste final de etiquetas.
- Fixtures combinados repetidos: 72 turnos, 205 inscripciones, 10 clases dictadas, 93 snapshots, 24 pagos, 136 eventos y 229 entradas de historial; conteos iguales antes/después. Esta medición incluye el registro de 05/01 realizado por la revisión UI.
- Playwright/Chromium con sesiones reales del seed, escritorio 1440×1000 y móvil 390×844. Sin excepciones de página. Capturas inspeccionadas visualmente. Las capturas inferiores usan scroll del contenido de la aplicación.
- La colección Postman queda disponible para repetir los casos; la ejecución HTTP efectiva se realizó con Playwright y sus cookies de sesión. No se ejecutó la aplicación Postman ni TablePlus: SQL read-only se ejecutó con `psql`.

API y SQL coinciden mayo–octubre: **72 inscripciones, 49 presentes, 23 ausentes, 68,1 %**; una clase sin control excluida. Bajo umbral: 11 grupos, página 1 diez filas, página 2 una, página 3 ninguna con total once. El alumno con exactamente 75 % queda excluido. HTTP 400/401/403 reales; Mesa, Profesor y Alumno sin permiso de indicadores. Playwright verificó gráficos por mes/materia, 6/24 meses, estados vacíos, paginación y móvil sin overflow documental. Scroll del gráfico largo: ancho 326 px, contenido 1824 px, posición inicial 1498 px (últimos meses).

Capturas y resultados: `hu-h-07/`. **Entrega como PR borrador dependiente de E09 y H06**; las pruebas completas corresponden a integración local, no a esta rama aislada contra develop. Tras integrar ambos prerrequisitos se debe actualizar H07 y resolver las extensiones compartidas. Acceso del Gerente al historial continúa diferido a E02; el enlace conserva la materia sin ampliar RBAC.

## Verificaciones diferidas

- Acceso efectivo del Gerente al historial: HU-E-02; esta HU sólo propaga la materia a la pantalla y conserva permisos actuales.
- Anulación/corrección mediante pantallas de HU-E-11; la lectura vigente ya está comprobada con PostgreSQL.
- Edición del umbral por UI: HU-N-01; la consulta ya lee el parámetro vigente.

Último build integrado de producción y revisión final Playwright: aprobados.

PR propio: https://github.com/agustincalisaya/noctium/pull/219. Draft hasta integrar #217 y #218; no afirmar compilación independiente antes de esos prerrequisitos.

## Actualización de develop durante la entrega

Se integró `b7c3b42` (HU-C-23 y componente HU-C-25) en cada rama por separado, preservando únicamente el diff de la historia frente a develop. Claves de UI migradas a `ui.historial.asistencia.*` / `ui.indicadores.*`, sin modificar claves legacy de dominio. Comprobador de referencias TypeScript aprobado. Suite completa sobre la integración actualizada: **1913 aprobados**, 177 PostgreSQL omitidos en la corrida unitaria; la verificación PostgreSQL de177 casos anterior sigue aplicando, sin cambios adicionales en los servicios ni persistencia. Lint actualizado: cero errores y el warning preexistente de Sidebar.

Build webpack/TypeScript sobre develop actualizado: aprobado. Playwright repetido sobre ese build, sin errores de página. Los tres PR quedaron sin conflictos frente a develop al verificar GitHub.

## CI remoto observado

Sobre el commit de código `df83eb6`: [Textos C23](https://github.com/agustincalisaya/noctium/actions/runs/37930869788) aprobado y CodeQL aprobado. [Build independiente](https://github.com/agustincalisaya/noctium/actions/runs/37930869743) falla por los módulos de E09/H06 todavía ausentes en develop (fixture `hu-e-09`, `grafico-indicador`, `use-indicador` y tipos derivados). Estado esperado del PR borrador dependiente; no se declara CI independiente aprobado. La integración local completa tiene1913 pruebas y build aprobado.
