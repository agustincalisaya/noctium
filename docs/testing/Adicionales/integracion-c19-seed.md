# Corrección de regresiones tras las PR #240–#243

Base: `develop` f5dc4fd. Alcance autorizado: revisar y corregir los fallos de integración siguiendo la documentación, con pruebas ligeras y secuenciales.

## Contratos y relevamiento

- HU-C-19, «Alcance» y «Tests existentes previstos a ajustar»: Clase/Clases y estados femeninos; mantener códigos, status, rutas, enums y aserciones funcionales. Los 11 fallos reproducidos conservan expectativas de presentación anteriores a C-19.
- RULES, «Lecturas y datos de presentación», y PR-0 §2.12/§2.16: fixtures repetibles y pruebas contra bases descartables. F-03 §9.3 documenta interferencia entre archivos en la suite global.
- `test-pg.mjs` comparte una base entre archivos. Tres archivos ejecutan el seed completo: asistencia, tarifa y cancelaciones. Sus fixtures usan selecciones por DNI y relojes distintos; otros archivos agregan datos que pueden cambiar las selecciones y resultados al repetir el seed.

## Archivos y solución

Solo expectativas de copy en `evento-calendario-materia.test.tsx`, `paso-fecha-horario-turno.test.tsx`, `listado-sin-permiso.route.test.ts`, `operacion.service.pg.test.ts`, `inscripcion.service.pg.test.ts`, `turno.inscripciones.pg.test.ts` y `turno.reservas.pg.test.ts`. Se conservan los controles de comportamiento, permisos y persistencia.

`scripts/test-pg.mjs` separa los archivos que invocan `prisma/seed.ts`: cada uno recibe una base nueva con migraciones y se elimina al terminar. Los demás siguen compartiendo su base; las guardas existentes de nombre fijo permanecen. No se cambia el seed de desarrollo ni la selección de escenarios ni se borran hechos para hacer pasar pruebas. Este documento y una nota aditiva en PR-0 registran la decisión.

## Verificación

Verificación ejecutada el 11/10/2026, secuencial y con prioridad baja (`nice -n 15`):

- Vitest: los tres archivos de interfaz/API corregidos más `terminologia-clases.test.ts`, **17/17 aprobadas**.
- Runner PostgreSQL con los cuatro archivos corregidos más las tres suites que ejecutan el seed: **61/61 aprobadas**. La pasada compartida tiene 49 casos; las bases propias ejecutan asistencia (1), cancelaciones (6) y tarifa (5). El log muestra cuatro bases distintas. Cada suite del seed lo ejecuta dos veces: seis cargas completas en total.
- Asistencia: conserva los alumnos, estados históricos y conteos después de repetir el seed. Cancelaciones: conserva hechos y resultados. Tarifa: conserva la tarifa modificada y su historial, y comprueba precio congelado y nuevas inscripciones.
- ESLint dirigido, `node --check scripts/test-pg.mjs` y `git diff --check`: aprobados.
- Al terminar quedaron **cero bases `noctium_pruebas_*`** en la instancia temporal; PostgreSQL se detuvo. No se tocó la base habitual ni `siguientepasos.md`.

Comandos de pruebas (con `PG_PRUEBAS_ADMIN_URL` apuntando al servidor local temporal, sin credenciales de la base habitual):

```sh
nice -n 15 npx vitest run --no-file-parallelism \
  src/components/shared/evento-calendario-materia.test.tsx \
  'src/app/(dashboard)/turnos/paso-fecha-horario-turno.test.tsx' \
  src/app/api/turnos/listado-sin-permiso.route.test.ts \
  src/lib/terminologia-clases.test.ts
nice -n 15 node scripts/test-pg.mjs \
  src/server/pagos/operacion.service.pg.test.ts \
  src/server/turnos/inscripcion.service.pg.test.ts \
  src/server/turnos/turno.inscripciones.pg.test.ts \
  src/server/turnos/turno.reservas.pg.test.ts \
  src/server/historial/seed-asistencia.pg.test.ts \
  src/server/materias/materia.tarifa.pg.test.ts \
  src/server/indicadores/cancelaciones.service.pg.test.ts
```

Límites: no se ejecutó un build local, la suite global, HTTP autenticado ni un recorrido de navegador. El cambio solo afecta pruebas, su runner y documentación; estos resultados no certifican todas las historias del sistema ni la repetibilidad del seed sobre una base de desarrollo modificada arbitrariamente.
