# HU-C-27 — Evidencia de pruebas

**Fecha:** 13/10/2026 · **Base:** `feature/HU-C-27` sobre `develop` (`1f503e9`), sin commits.
Solo lo marcado «Ejecutado» tiene un comando y su salida. El SQL se corrió en `noctium_dev` dentro de una transacción `READ ONLY`. Las pruebas con PostgreSQL usan la base descartable de `npm run test:pg`.

## 1. Comandos ejecutados

| # | Comando | Resultado | Exit |
|---|---|---|---|
| 1 | `npx prisma migrate dev --name hu_c_27_indices_turnos` | genera `20261013153953_hu_c_27_indices_turnos` (ver 2) | 0 |
| 2 | `npx prisma migrate status` | «Database schema is up to date!» | 0 |
| 3 | `npx tsc --noEmit -p .` | sin errores (solo los previos de `@playwright/test`, no instalado, en `playwright.historial.config.ts` y `scripts/testing/historial-po.e2e.ts`) | 2 |
| 4 | `npm run lint` | 0 errores; 1 aviso previo en `Sidebar.tsx` (`CALENDARIO` sin usar, ya estaba en `develop`) | 0 |
| 5 | `npx tsx scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.» | 0 |
| 6 | `npm test` (suite completa) | 4153 pasan, 1 falla por timeout (ver 3), 523 omitidos | 1 |
| 7 | `npx vitest run src/lib/claves-textos.test.ts` (aislado) | 36/36 | 0 |
| 8 | `npm run test:pg` (suite completa) | pasada principal: 53 archivos, 465 tests pasan (44 omitidos); en las pasadas con base propia, 3 timeouts por carga (ver 3); una corrida anterior completa, con el mismo seed final, terminó con exit 0 | 1 |
| 8 b | `npm run test:pg --` con los 3 archivos que vencieron | 2/2, 1/1 y 6/6 | 0 |
| 9 | `SEED_SOLO_VALIDAR=1 SEED_FECHA_HOY=<fecha> npx tsx prisma/seed.ts` con 05, 06, 07, 10, 11, 12, 13, 16, 17, 18, 19 y 23/10/2026, 24/09 y 02/11/2026 | válido en todas; sábados y domingos: 42 clases (omite las 3 de hoy, con aviso), días hábiles: 45 | 0 |
| 10 | `npx prisma db seed` dos veces seguidas sobre `noctium_dev` | ver 4 | 0 |
| 11 | `HU-C-27.sql` con `psql -v ON_ERROR_STOP=1` (transacción `READ ONLY`) | ver 5 | 0 |

## 2. Migración

`prisma migrate dev` generó, además de los tres `CREATE INDEX`, un `DROP`/`ADD` de `reservas_turno_turnoId_fkey` con `ON UPDATE CASCADE`. Es una diferencia previa entre `schema.prisma` y la migración del Sprint 1 que creó esa FK (`20260924150000`, solo `ON DELETE CASCADE`), no de esta HU. Como pide la task (sección 6):

- se revirtió lo aplicado en `noctium_dev` (FK restaurada a su definición original, índices y registro en `_prisma_migrations` borrados);
- se dejó en el archivo generado solo los tres `CREATE INDEX`, con un comentario que explica lo quitado;
- se volvió a aplicar con `npx prisma migrate deploy`.

La consulta 7 de `HU-C-27.sql` confirma la FK original: `FOREIGN KEY ("turnoId") REFERENCES turnos("idTurno") ON DELETE CASCADE`. El diff futuro de `migrate dev` va a seguir proponiendo ese cambio de la FK hasta que alguien lo resuelva aparte.

`prisma generate`, que corre al final de `migrate dev`, falló con `EPERM` al renombrar el motor de consultas (archivo en uso, probablemente un `next dev` abierto). Los índices no cambian los tipos del cliente.

## 3. Fallos que no son de esta HU

- `src/lib/claves-textos.test.ts › todas las referencias reales tienen texto…` vence su timeout de 60 s en la suite completa (con la máquina cargada). Aislado pasa (comando 7: el caso tarda ~16 s y el archivo ~66 s) y el script equivalente pasa (comando 5). Es el mismo fallo que documenta `docs/testing/Modulo C/hu-c-26/HU-C-26-evidencia.md` §2, verificado allí en `develop` limpio.
- En la última corrida completa de `npm run test:pg` vencieron por tiempo `alumno.estado.permisos.pg.test.ts` y `seed-asistencia.pg.test.ts` (el seed como subproceso superó 180 s y 120 s: `spawnSync … ETIMEDOUT`) y el hook de `cancelaciones.service.pg.test.ts` (120 s). No son fallos de aserción: reintentados, pasan los tres (comando 8 b), y la corrida completa anterior con el mismo seed terminó en verde.
- Fallo real encontrado y corregido durante la HU: la primera versión de las clases nuevas del seed usaba profesor1 y las aulas 1 y 2, y chocaba con el fixture HU-E-11 (fechas fijas, profesor1 a las 11:00) al sembrar con `SEED_FECHA_HOY` 10/10 u 11/10 (`PROFESOR_NO_DISPONIBLE`). Se pasaron a los profesores de índice 1 y 3 de `PROFESORES` y a Laboratorio y Aula 10, que ningún fixture usa en fechas fijas.

## 4. Seed: dos corridas seguidas

| Momento | turnos | inscripciones | pagos | reservas | materias | alumnos |
|---|---|---|---|---|---|---|
| Antes | 151 | 904 | 37 | 639 | 7 | 62 |
| Tras la corrida 1 (`0 creados`) | 151 | 904 | 37 | 639 | 7 | 62 |
| Tras la corrida 2 (`0 creados`) | 151 | 904 | 37 | 639 | 7 | 62 |

En la primera aplicación del seed nuevo sobre `noctium_dev` se crearon las 7 clases `seed-turno-c27-*` (144 → 151) y la corrida siguiente creó 0. Las 3 filas que usaban profesor1 en la primera versión del seed (chocaban con el fixture HU-E-11 al sembrar con `SEED_FECHA_HOY` 10/10 u 11/10) se borraron de `noctium_dev` (sin inscripciones ni pagos) y se volvieron a crear con la versión final.

## 5. SQL de nivel 3 (`HU-C-27.sql`)

- **Índices:** `turnos_fechaTurno_horaInicioTurno_idx`, `turnos_profesorId_fechaTurno_idx`, `turnos_materiaId_fechaTurno_idx`.
- **Planes** (con `enable_seqscan = off` solo en la transacción, porque la tabla es chica):
  - «Todas» paginada: `Limit → Incremental Sort (Presorted Key: fechaTurno, horaInicioTurno) → Index Scan using turnos_fechaTurno_horaInicioTurno_idx`.
  - «Anteriores»: `Limit → Index Scan Backward using turnos_fechaTurno_horaInicioTurno_idx`, `Index Cond: fechaTurno < '2026-10-13'`.
  - Por profesor: `Index Scan using turnos_profesorId_fechaTurno_idx`.
  - Por materia: `Index Scan using turnos_materiaId_fechaTurno_idx`.
- **Clases del seed:**

| id | fecha | hora | estado | materia (activa) |
|---|---|---|---|---|
| seed-turno-c27-inactiva | 2026-10-06 | 10:00 | PENDIENTE | Historia de la Ciencia (no) |
| seed-turno-c27-ant-3 | 2026-10-07 | 14:00 | PENDIENTE | Química |
| seed-turno-c27-ant-1 | 2026-10-08 | 10:00 | DISPONIBLE | Programación I |
| seed-turno-c27-ant-2 | 2026-10-08 | 12:00 | CANCELADO | Bases de Datos |
| seed-turno-c27-hoy-1 | 2026-10-13 | 10:00 | DISPONIBLE | Programación I |
| seed-turno-c27-hoy-3 | 2026-10-13 | 14:00 | PENDIENTE | Química |
| seed-turno-c27-hoy-2 | 2026-10-13 | 16:00 | DISPONIBLE | Inglés Técnico |

## 6. Matriz de criterios

| CA | Qué se probó | Evidencia | Estado |
|---|---|---|---|
| 1 Todas las clases, cuatro estados | `periodo=todas` sin condición de fecha; seed con Pendiente, Disponible y Cancelada en días anteriores y de hoy | `turno.listado.test.ts`, `turno.listado-profesor.pg.test.ts`; SQL 5 | Ejecutado |
| 2 Período por día del centro, con `ahora()` | Cada período; corte 02:59Z/03:00Z; reloj del dominio en otro día que el del sistema | `turno.listado.test.ts`; PG (reloj fijo 15/05/2030) | Ejecutado |
| 3 Desde–Hasta | Inclusive, una o dos fechas, «Rango personalizado», elegir período vacía fechas, Desde > Hasta con aviso y sin consulta, 400 en la API | `turnos-listado.test.tsx`, `turno.schema.test.ts`, `listado.route.test.ts`, PG | Ejecutado |
| 4 Materia | «Todas», inactivas con «Inactiva»; Mesa/Gerente: activas + inactivas con clases; Profesor: solo las de sus clases (la asociada sin clases no aparece, la inactiva con clases sí) | `turno.listado.test.ts`; PG; `turnos-listado(-profesor).test.tsx` | Ejecutado |
| 5 Combinación, página 1, cantidad, «Limpiar filtros» | Un único `where`; URL; contador | tests de servicio y pantalla | Ejecutado |
| 6 Orden | Ascendente por defecto; descendente con «Anteriores» | servicio, PG, SQL 3 | Ejecutado |
| 7 Subtítulo | Hoy / Anteriores / Próximas / Todas / rango | `turnos-listado.test.tsx` | Ejecutado |
| 8 URL | `periodo`, `desde`, `hasta`, `materia_id`, `q`, `profesor_id`, `pagina`, sin `orden`; retorno de filas y paginador; enlace con filtros | `turno-listado.test.ts`, `turnos-listado.test.tsx` | Ejecutado |
| 9 Pendiente anterior | Sin «Continuar configuración», con «Descartar» | `turnos-listado.test.tsx`; seed `seed-turno-c27-ant-3` | Ejecutado |
| 10 Mensajes vacíos | «No hay clases para hoy» + «Ver próximas»; mensaje de filtros en los demás casos (incluido el Profesor) | `turnos-listado(-profesor).test.tsx` | Ejecutado |
| 11 Acceso y validación | Profesor solo lo suyo y 403 con `profesor_id` ajeno; 400 por período, fechas, rango invertido, período + rango, materia mal formada o inexistente | ruta, servicio, PG | Ejecutado |
| 12 Rendimiento | Tres índices y planes que los usan | SQL 1 a 4 | Ejecutado |
| 13 Textos y confirmación | `ui.clases.listado.*`; verificador de claves; ningún diálogo al filtrar | comando 5; `turnos-listado.test.tsx` | Ejecutado |
| 14 Pruebas | Actualizadas y ampliadas | este informe | Ejecutado |

## 7. No ejecutado

- **Colección Postman** (`HU-C-27.postman_collection.json`): está escrita, pero no se corrió (necesita la app levantada y sesiones reales de NextAuth). El mismo contrato lo cubren `listado.route.test.ts` y los tests de servicio y PostgreSQL.
- **Capturas de pantalla** en navegador: no se tomaron.
