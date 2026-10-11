# Corrección del seed de asistencia histórica

Base: develop `05311d4`, con PR #235 (HU-A-06) integrada. Rama `fix/seed-asistencia-vigente`.

## Problema y alcance

Una instalación nueva podía detenerse en HU-E-04: las clases de E-09 existían, pero tenían cero alumnos. `asignarParticipantesTurno` crea reservas con plazo; al registrar la asistencia después de la clase, esas reservas ya habían vencido. El helper compartido afectaba también E-08, E-11 y H-07. E-02 presentaba el mismo problema histórico, además de acciones de cancelación programadas después del vencimiento de sus reservas.

Se modifica únicamente la preparación de datos en `prisma/seed/fixtures/hu-e-09.ts` y `hu-e-02.ts`. Se añade `src/server/historial/seed-asistencia.pg.test.ts`. No se modifican los contratos de reservas, login, permisos, pagos o registro de asistencia.

## Solución

Antes del inicio de una clase histórica todavía no registrada, se reemplazan las reservas de muestra por inscripciones CENTRO/PAGO_SIN_REGISTRAR sin vencimiento, usando `finalizarInscripcion` y `crearInscripcion`. Se conserva el historial de la reserva reemplazada y el orden de bloqueos alumno → clases → inscripción. No se fabrican pagos ni se actualizan directamente tablas de negocio. Una clase ya registrada no se reescribe.

E-02 usa la misma preparación para sus tres ejemplos históricos y elige la inscripción vigente nueva. Sus escenarios de cancelación, baja y reinscripción crean la reserva poco antes de la acción que demuestran. El ejemplo de reserva vencida conserva su vencimiento explícito.

El cambio corrige instalaciones nuevas; no repara clases vacías que ya quedaron registradas en una carga fallida. Para probar localmente se usa una base nueva con las migraciones y el seed oficial, sin cuentas adicionales.

## Validación

- Seed oficial completo en PostgreSQL 17 nuevo, todas las migraciones aplicadas: aprobado, incluidos los fixtures E, H, I-07 y A-06.
- Regresión PostgreSQL: aprobada (1 prueba de integración). Ejecuta el seed completo dos veces en una base descartable; comprueba alumnos/estados en E-09, indicación de E-04, clases históricas E-02, ejemplo de reserva vencida, cuenta habitual de gerente y ausencia de duplicación de hechos.
- Registro de clase dictada: 10 pruebas PostgreSQL aprobadas, incluida exclusión y trazabilidad de reservas vencidas.
- ESLint de los tres archivos TypeScript y `next typegen` / `tsc --noEmit`: aprobados.
- `git diff --check`: sin errores.
- CI del SHA final: se exige aprobación antes de mergear.

Comandos: `npx prisma migrate deploy`, `npx prisma db seed`, `npm run test:pg -- src/server/historial/seed-asistencia.pg.test.ts`. Un proceso de validación por vez. No se ejecutan suites globales ni Postman: esta corrección no agrega API.
