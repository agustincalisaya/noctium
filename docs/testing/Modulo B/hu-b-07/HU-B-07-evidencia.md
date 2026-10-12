# Evidencia HU-B-07

## Resultado

Implementación en el commit e99a2a7 de feature/hu-restantes; las correcciones de auditoría (P1-01, P2-01, P2-02, P3-04, P3-06) están en el árbol de trabajo, pendientes de commit.

## Matriz de criterios

| CA | Evidencia |
|---|---|
| 1 | PG: impacto lista solo futuras Disponibles o Completas y coincide con lo que quita la baja; `MOTIVO_REQUERIDO` con registros en C, en I y en E, opcional sin registros; corte en la hora local del centro (clase a +2 h no es registro, empezada hace 1 h sí). Unitario: schema y límite de 300 |
| 2 | PG: `BAJA_ALUMNO` con fecha y actor, sin borrar; Completa → Disponible; en curso, pasada, Pendiente y Cancelada intactas; reserva vencida (borde `venceEl = ahora`) marcada y no dada de baja; pagos y dictadas intactos; historial después del commit; rollback ante fallo posterior a la cuenta; concurrencia con inscripción (mesa y autoservicio), con otra baja y con `registrarOperacion` |
| 3 | PG: cuenta inactiva, `sesionesValidasDesde` fijado y `verificarPermiso` responde 401 `SESION_INVALIDA` a la sesión abierta |
| 4 | Código: toast de éxito; `buscarAlumnosActivos`/`verificarAlumnoActivo` rechazan al inactivo (PG: inscripción rechazada después de la baja) |
| 5 | PG: autorregistro con ficha inactiva con y sin cuenta → `CUENTA_YA_EXISTE` sin solicitud ni cuenta; código pedido antes de la baja y confirmado después → `CUENTA_YA_EXISTE`, sin cuenta ni vínculo. Unitario: relectura bajo bloqueo y vinculación condicionada |
| 6 | PG: pago idéntico antes y después |
| 7 | PG: reactivación con cuenta activa, sesiones y marca conservadas, inscripciones no restauradas, vuelve a inscribirse, historial con ambas acciones. UI: aviso de no restauración al terminar |
| 8 | PG: `alumnos:cambiar_estado` concedido a Mesa de Entrada y 403 para Gerente, Profesor y Alumno (permisos de la migración). Unitario: las tres rutas usan el permiso |

## Verificaciones

Corridas del 11/10/2026 sobre el árbol con las correcciones:

- `npm run test:pg -- src/server/alumnos/alumno.estado.pg.test.ts src/server/turnos/turno.cancelacion-propia.pg.test.ts`: 21/21 (14/14 de B-07), base `noctium_pruebas_<hex>` creada, migrada y descartada por el runner, exit 0.
- Prueba de detección: con `autorregistro.service.ts` e `inscripcion.lecturas.ts` revertidos a e99a2a7, fallan exactamente los casos de P1-01 y P2-01 (2/14); con las correcciones, pasan.
- Regresión PG focal (`src/server/alumnos`, `turno.cancelacion-propia`, `turno.propios`, `turno.resumen-inscripcion.service`, `historial/clases-alumno`): 6 archivos, 43/43, exit 0.
- `autorregistro.service.test.ts`: 38/38 aprobadas (las de Sprint 1 más 3 casos nuevos de confirmación).
- Vitest completo: 3201 aprobadas, 374 omitidas (las PG sin base) y 0 fallidas, exit 0.
- `tsc --noEmit`, ESLint de los archivos modificados, `verificar-claves-textos` y `git diff --check f7ff819`: aprobados, exit 0.
- `npm run build`: aprobado, exit 0.
- Postman (`HU-B-07.postman_collection.json`, 25 requests con assertions), recorrido de navegador y CI: no ejecutados.

## Límites

La sesión 401 se verifica con `verificarPermiso` y la cuenta real en PostgreSQL, simulando el token; no reemplaza un recorrido con cookie real. La matriz de permisos usa los permisos de la migración, no la corrida del seed que pide §3.17.6. Una comprobación pendiente no se considera aprobada.
