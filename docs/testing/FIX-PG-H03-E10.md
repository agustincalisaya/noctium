# Evidencia — corrección PG H-03 / E-10

Base inicial: develop ca143a5, PR #237 integrada. Base final: develop 81b90a4, D-08 (#238) integrada. Ambos fallos se habían reproducido también sin D-08.

## Condiciones documentadas

- Spec E §§2.5.3, 3.8, 3.10 y task Sprint 3/HU-E-10.md: materia_id obligatorio para Profesor, 403 si falta; anulados visibles solo para Mesa/Gerencia, conservados en BD.
- Spec H §§2.5, 3.17.3 y task Modulo H/HU-H-03.md: cuentan Disponible/Completo/Cancelado, no Pendiente; horas excluyen Cancelado. PR-0 permite fábricas propias de prueba coherentes con invariantes.

## Ejecución real

`nice -n 15 npm run test:pg -- src/server/indicadores/clases.service.pg.test.ts src/server/historial/resultado-examen.service.pg.test.ts`

El runner creó una base descartable, aplicó migraciones y ejecutó sin paralelismo entre archivos. Resultado final: 2 archivos aprobados, 7 tests pasan, ninguno omitido; Vitest 9,45 s en la base inicial; repetición dirigida después de integrar D-08: 7 pasan, 2 archivos aprobados, Vitest 5,03 s. El runner eliminó la base al terminar. No se modificó la base del usuario ni se ejecutó seed completo.

`nice -n 15 npx eslint src/server/indicadores/clases.service.pg.test.ts src/server/historial/resultado-examen.service.pg.test.ts`: salida 0, sin avisos. `git diff --check`: aprobado.

La primera iteración detectó dos errores nuevos de preparación (helper no exportado y tipo CLASE en vez de CLASE_DICTADA); ambos se corrigieron y se repitieron únicamente los dos archivos. No se eliminaron asserts para obtener verde.

## Cobertura conservada y ampliada

H contrasta cantidades y minutos con SQL read-only. Crea estados explícitos con ids propios, fechas fijas, Completa con cupo lleno e inscripción sin vencimiento, y activos sin clases. Aserciones exactas: 3 clases contables y 3 horas, excluyendo las 3 h de Cancelada y las 3 h de Pendiente. Consulta persistida comprueba Completo y cupo 1; conserva asserts de existencia de estados.

E comprueba original inmutable y una única anulación persistida; Mesa/Gerencia ven motivo y marca; Profesor sin materia recibe 403, con materia ve la clase dictada y no el examen anulado; Alumno tampoco ve el anulado. Se mantienen pruebas de correcciones, plazo y concurrencia existentes.

## Límites

Cambian solo tests y documentación. No cambian endpoints, permisos ni presentación: no se repitió Postman/Playwright. Las lecturas de servicio y contraste SQL se ejecutaron contra PostgreSQL real. No se corrieron suites completas, build local ni se afirma ausencia de otros fallos del proyecto. CI de la PR se verifica en GitHub.
