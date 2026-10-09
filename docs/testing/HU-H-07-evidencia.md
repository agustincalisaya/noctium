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

## Pendientes de integración

- Fixture ejecutado dos veces en la base de demostración para comprobar idempotencia y conteos.
- TypeScript/build con HU-E-09 y HU-H-06 integradas; la rama H07 no incluye archivos de otras historias.
- Ejecución HTTP real de colección Postman o equivalente por rol, y contraste de `HU-H-07.sql`.
- Revisión Playwright del gráfico real y capturas `docs/testing/hu-h-07/` en escritorio, móvil, 24 meses y sin datos; registrar comandos/resultados reales al finalizar.

## Verificaciones diferidas

- Acceso efectivo del Gerente al historial: HU-E-02; esta HU sólo propaga la materia a la pantalla y conserva permisos actuales.
- Anulación/corrección mediante pantallas de HU-E-11; la lectura vigente ya está comprobada con PostgreSQL.
- Edición del umbral por UI: HU-N-01; la consulta ya lee el parámetro vigente.
