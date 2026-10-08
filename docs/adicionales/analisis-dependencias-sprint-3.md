# Análisis de dependencias y reparto del Sprint 3

Fuente: Backlog definitivo (40 HU, 107 SP), PR 0 v20 y las convenciones 1, 7, 8 y 9 del backlog. Autor: Scrum Master (borrador para confirmar con el equipo). **Actualizado con el PR 0 v20:** los pedidos de la sección 5 ya están incorporados a la v20 (con un ajuste en R7-PR0-4) y las specs A a N están escritas.

El reparto no cambia ninguna HU, ningún criterio ni ningún SP: solo decide **quién hace qué y en qué orden** para que nadie espere el código de otro.

---

## 1. Respuesta corta

- **¿Hacía falta antes de las specs?** No para escribirlas: una spec describe el contrato de un módulo (rutas, servicios, reglas), y eso no depende de quién lo programe. **Sí servía hacerlo ahora**, porque salieron cuatro pedidos al PR 0 (sección 5) que conviene incluir en la v20 de una vez.
- **¿Cambia las specs?** El contrato no. Solo cambia una línea de texto en B, F y G (y en D cuando se escriba): `listarHistorialEstados` pasa de «la agrega HU-D-08» a «la publica el PR 0» (sección 6).
- **¿Cómo se evita que alguien espere a otro?** Con tres cosas: (1) cada carril sigue el orden de prioridad del backlog, (2) todo lo que cruza carriles se apoya en un contrato del PR 0 (servicios y datos), no en el código terminado de otra HU, y (3) las verificaciones diferidas (convención 1) no bloquean: las hace quien mergea después.
- **El schema ya está preparado:** el PR 0 define todas las tablas, acciones de permiso y parámetros en una sola migración; ninguna HU agrega migraciones. Por eso dos carriles nunca se pisan en `schema.prisma`.

---

## 2. Cómo se leyeron las dependencias

| Tipo | Qué es | ¿Bloquea? |
|---|---|---|
| **Dura** | La HU necesita el código o la pantalla terminada de otra HU | Sí, salvo que estén en el mismo carril y en orden |
| **Contrato PR 0** | Usa un servicio, tabla o dato que publica el PR 0 | No, mientras el PR 0 publique las firmas (etapa 2) |
| **Verificación diferida** | Un criterio solo se puede probar cuando existe otra HU (convención 1) | No: lo verifica quien mergea la segunda, en su mismo PR |
| **Archivo compartido** | Dos HU tocan el mismo archivo | Solo riesgo de conflicto de merge (sección 4, E10) |

Resultado: de las ~40 HU solo dos grupos tienen dependencia dura real, y quedan **dentro de un mismo carril** o se resuelven con contrato del PR 0:

1. **Habilitadoras del día 1:** HU-C-23 (archivo central de textos) y HU-C-25 (componente de confirmación). Las usan todas las pantallas nuevas.
2. **Unidad de entrega HU-C-22 + HU-I-10 + HU-C-24 + HU-I-11:** se desarrollan en paralelo contra los contratos del PR 0 y se integran juntas (ya lo dice el backlog).

---

## 3. Reparto en cuatro carriles

Cada carril respeta el orden de prioridad del backlog (con los desvíos que se marcan). El acumulado es en SP.

| Carril | Tema | HU | SP | Módulos de spec |
|---|---|---|---|---|
| **1** | Reserva, pago y caja | 10 | **27** | I, C, N |
| **2** | Clases, inscripción, tarifas y bajas | 10 | **27** | C, L, B, D |
| **3** | Asistencia, historial e indicadores | 11 | **26** | E, H |
| **4** | Cuentas, personal de mesa, gerentes y formas de pago | 9 | **27** | A, F, G, I |
| | **Total** | **40** | **107** | |

**Propuesta de personas:** el carril 4 para **Adriel**: es el más autocontenido (cero esperas hacia otros carriles), ninguna de sus HU está en el checkpoint (Adriel arranca con el PR 0, que desbloquea a los otros tres) y su cola (bloque de gerentes) es el segundo recorte más grande, así que absorbe un atraso del PR 0 sin comprometer el piso. Los carriles 1, 2 y 3 son independientes entre sí: conviene que los tomen quienes más tocaron pagos, turnos/inscripciones e historial/clase dictada en los Sprints 1 y 2 (y se pueden intercambiar carriles completos sin romper nada).

### Carril 1 — Reserva, pago y caja (27 SP)

| # | HU | SP | Acum. | Spec | Depende de / espera |
|---|---|---|---|---|---|
| 1 | HU-C-25 Confirmar cada operación | 1 | 1 | transversal | Nada. **Habilitadora:** primera en mergear |
| 2 | HU-I-10 Registrar pago | 3 | 4 | I | Contrato PR 0 (`registrarOperacion`, `crearInscripcion`). Se integra con C-22 y C-24 (carril 2) |
| 3 | HU-I-11 Emitir comprobante | 2 | 6 | I | I-10 (mismo carril) |
| 4 | HU-C-21 Cambiar el aula de fechas ocupadas | 2 | 8 | C | Solo código existente (C-16, C-17). Cola cortable: «Resolver todas» |
| 5 | HU-I-12 Abrir y cerrar mi caja (arqueo ciego) | 8 | 16 | I | I-10 y C-25 (mismo carril) |
| 6 | HU-C-26 Ver y gestionar reservas pendientes | 3 | 19 | C | C-22 y C-24 (carril 2, terminadas hacia el SP 8 del carril 2); I-10, I-12 y C-25 (mismo carril) |
| 7 | HU-I-02 Historial de pagos del alumno | 2 | 21 | I | L-06 (carril 2, terminada hacia el SP 14 del carril 2); I-10, I-11 (mismo carril) |
| 8 | HU-I-06 Corregir o anular un pago | 3 | 24 | I | I-02, I-10, I-11 (mismo carril) |
| 9 | HU-I-05 Mi historial de pagos | 1 | 25 | I | I-02 (mismo carril) |
| 10 | HU-N-01 Configuración del centro | 2 | 27 | N | Nada. **Primer recorte** (−2) |

### Carril 2 — Clases, inscripción, tarifas y bajas (27 SP)

| # | HU | SP | Acum. | Spec | Depende de / espera |
|---|---|---|---|---|---|
| 1 | HU-C-23 Centralizar los textos | 2 | 2 | transversal | Nada. **Habilitadora:** primera en mergear |
| 2 | HU-C-20 Confirmar inscripción con un resumen | 1 | 3 | C | Nada (parte del camino de la reserva) |
| 3 | HU-C-22 Reservar y pagar en el centro | 3 | 6 | C | Contrato PR 0. Se integra con I-10 (carril 1) |
| 4 | HU-C-24 Vencer las reservas sin pago | 2 | 8 | C | C-22 (mismo carril). **Dueño del proceso programado** |
| 5 | HU-C-19 «Clase» en lugar de «Turno» | 1 | 9 | transversal | C-23 (mismo carril). Dueño de la verificación del criterio 8 (viernes y cierre) |
| 6 | HU-L-06 Tarifa por hora de cada materia | 3 | 12 | L | Nada |
| 7 | HU-L-07 Cambiar la tarifa de varias materias | 2 | 14 | L | L-06 (mismo carril) |
| 8 | HU-C-14 Cancelar mi inscripción | 3 | 17 | C | C-20, C-22 (mismo carril) |
| 9 | HU-B-07 Desactivar y reactivar alumno | 5 | 22 | B | Contrato PR 0 (cuentas, `listarHistorialEstados`, C-22). No usa código de D-08 |
| 10 | HU-D-08 Desactivar y reactivar profesor | 5 | 27 | D | Nada. **HU de rescate** (nadie depende de ella) |

### Carril 3 — Asistencia, historial e indicadores (26 SP)

| # | HU | SP | Acum. | Spec | Depende de / espera |
|---|---|---|---|---|---|
| 1 | HU-E-09 Asistencia individual | 2 | 2 | E | Contrato PR 0 (`registrarClaseDictada` adaptado) |
| 2 | HU-H-06 Panel de indicadores | 2 | 4 | H | Datos de presentación con servicios del PR 0 |
| 3 | HU-H-07 Inscriptos vs. presentes | 3 | 7 | H | H-06 y E-09 (mismo carril). Cola cortable: tabla de presentismo bajo |
| 4 | HU-E-07 Observaciones | 1 | 8 | E | Nada (E-01 ya está) |
| 5 | HU-E-04 Indicaciones | 1 | 9 | E | Nada (E-01 y E-05 ya están) |
| 6 | HU-E-10 Corregir o anular resultado de examen | 1 | 10 | E | Nada (E-05 y E-06 ya están) |
| 7 | HU-E-11 Corregir o anular clase dictada | 2 | 12 | E | E-09 (mismo carril) |
| 8 | HU-E-08 Mi historial académico | 3 | 15 | E | E-04, E-07, E-09, E-10, E-11 (mismo carril) |
| 9 | HU-E-02 Historial de clases del alumno | 3 | 18 | E | E-09 (mismo carril). Inscripciones de C-14 / C-24 / B-07 vía datos del PR 0 (E4) |
| 10 | HU-H-03 Clases por materia y por profesor | 3 | 21 | H | H-06 (mismo carril) |
| 11 | HU-H-10 Cancelaciones | 5 | 26 | H | H-06 (mismo carril); C-14, C-24, B-07 (carril 2, ver E5). **Segundo recorte** (−5) |

Desvío respecto de la prioridad: E-02 (prioridad 20) va después de E-08 (25) porque E-08 y sus previas son todas del mismo carril, y E-02 es la única del bloque que mira inscripciones de otro carril; así llega lo más tarde posible.

### Carril 4 — Cuentas, personal de mesa, gerentes y formas de pago (27 SP)

| # | HU | SP | Acum. | Spec | Depende de / espera |
|---|---|---|---|---|---|
| 1 | HU-A-06 Crear la cuenta al registrar a una persona | 5 | 5 | A | Servicios de cuentas del PR 0 (propios del SM) |
| 2 | HU-A-05 Recuperar contraseña | 5 | 10 | A | A-06 (mismo carril). Sin dependencia externa: el envío lo hace el simulador (decisión del PO) |
| 3 | HU-F-01 Registrar y modificar mesa de entrada | 3 | 13 | F | A-06 (mismo carril) |
| 4 | HU-F-03 Listar personal de mesa | 1 | 14 | F | F-01 |
| 5 | HU-F-05 Desactivar y reactivar personal | 3 | 17 | F | F-01, F-03; regla de caja abierta con el servicio de cajas del PR 0 (E7) |
| 6 | HU-I-07 Modificar, desactivar y reactivar forma de pago | 3 | 20 | I | Nada (I-03 ya está). Verifica los diferidos de I-10 e I-06 |
| 7 | HU-G-01 Registrar y modificar gerente | 3 | 23 | G | A-06 |
| 8 | HU-G-03 Listar gerentes | 1 | 24 | G | G-01 |
| 9 | HU-G-05 Desactivar y reactivar gerente | 3 | 27 | G | G-01, G-03, patrón de F-05. **Tercer recorte** (−7 con G-01 y G-03) |

Desvío respecto de la prioridad: I-07 (prioridad 29) va entre F y G para no tener que mezclar el bloque de gerentes, que se corta junto.

---

## 4. Esperas entre carriles y cómo se resuelven

| ID | Espera | Cuándo cae (SP del carril) | Resolución |
|---|---|---|---|
| **E1** | C-23 (texto central) y C-25 (confirmación) las usan todas las pantallas | Día 1 | Son lo primero de los carriles 2 y 1. Los demás empiezan por servicios, rutas y esquemas Zod; las pantallas y textos van cuando el primer merge está en `develop`. Hasta entonces, las claves siguen la convención del archivo. Espera máxima: el primer día |
| **E2** | Unidad C-22 + I-10 + C-24 + I-11 (carriles 2 y 1) | Carril 2: SP 6 y 8. Carril 1: SP 4 y 6 | Cada quien programa contra los contratos del PR 0. Se mergean juntas el mismo día, en el orden del backlog (PR 0 → C-22 → I-10 → C-24 → I-11). Los dos devs prueban el flujo completo juntos. Como cada una cae entre el SP 4 y el 8 de su carril, ninguna queda esperando mucho tiempo a la otra |
| **E3** | C-26 (carril 1) necesita C-22 y C-24 (carril 2) | C-26 arranca en el SP 16 del carril 1; C-22 y C-24 terminan en el SP 8 del carril 2 | Margen de ~8 SP |
| **E4** | E-02 (carril 3) lee inscripciones canceladas por el alumno, dadas de baja y vencidas, que producen C-14, B-07 y C-24 (carril 2) | E-02 arranca en el SP 15 del carril 3; C-24 está hecha (SP 8), C-14 termina en el 17 y B-07 en el 22 | E-02 se programa contra el modelo de inscripción y los estados del PR 0, con el seed de escenarios (pedido R7-PR0-2). El renglón «Baja del alumno» se verifica cuando B-07 esté mergeada (convención 1) |
| **E5** | H-10 (carril 3) cuenta bajas de B-07 | H-10 arranca en el SP 21 del carril 3; B-07 termina en el SP 22 del carril 2 | H-10 hace primero las series de cancelaciones y reservas vencidas y deja «Bajas» al final; el solape es de menos de un día |
| **E6** | I-02 (carril 1) necesita la tarifa de L-06 (carril 2) | I-02 en el SP 19–21 del carril 1; L-06 termina en el SP 12–14 del carril 2 | Margen de ~7 SP |
| **E7** | F-05 (carril 4) usa la regla de caja abierta; I-12 (carril 1) | F-05 en el SP 14–17 del carril 4; I-12 termina en el SP 16 del carril 1 | F-05 usa el servicio de cajas del PR 0 (no la pantalla de I-12). El criterio 10 de I-12 es una verificación diferida de F-05 |
| **E8** | H-06 y H-07 (carril 3) muestran montos de pagos | SP 2–7 del carril 3 | Datos con los servicios del PR 0 en la carpeta de fixtures (ya prevista en v19). «Ingresos cobrados vigente» se verifica cuando I-06 esté mergeada |
| **E9** | C-24 introduce el único proceso programado | SP 6–8 del carril 2 | Dueño: quien tome C-24 (carril 2). Se anota en el documento de developers antes de arrancar (convención 8) |
| **E10** | Archivos compartidos: archivo central de textos, menú lateral, módulo C (C-21 en carril 1; C-14, C-22, C-24 en carril 2) | Todo el sprint | Textos con un espacio de nombres por módulo (cada carril escribe solo en el suyo); PR chicos y rebase antes de pedir revisión. La matriz de permisos y el schema están cerrados en el PR 0, así que no hay conflicto ahí |
| **E11** | Resend (cuenta y dominio remitente) para A-05 | Ninguna | **Cerrada:** el PO aceptó el simulador del criterio 7 para la demostración; la cuenta de Resend ya no hace falta |

### Verificaciones diferidas que cruzan carriles (no bloquean)

Quien mergea la HU de la derecha verifica, en el mismo PR, el criterio de la izquierda.

| Criterio pendiente | Se verifica cuando se mergea | Carril de quien verifica |
|---|---|---|
| C-20 (plazo configurable) | N-01 | 1 |
| C-22 (pago, vencimiento, cancelación, baja del alumno, plazo) | I-10, C-24, C-14, B-07, N-01 | 1, 2, 2, 2, 1 |
| I-10 (comprobante, enlaces, forma de pago inactiva) | I-11, I-02, I-06, I-07 | 1, 1, 1, 4 |
| C-24 (reserva vencida) | I-06, H-10, E-02, C-14 | 1, 3, 3, 2 |
| I-12 (ajustes, baja con caja abierta) | I-06, F-05 | 1, 4 |
| H-06 (monto cobrado, pestañas) | I-06, H-07, H-03, H-10 | 1, 3, 3, 3 |
| H-07 (clases anuladas, historial, umbral) | E-11, E-02, N-01 | 3, 3, 1 |
| E-09 (Mi historial, clases anuladas, canceladas, bajas) | E-08, E-11, C-14, B-07 | 3, 3, 2, 2 |
| C-14, B-07, D-08, E-02 (reintegro, pagos) | I-06 (y E-02 para el historial) | 1, 3 |
| A-06 (alta de personal y gerentes, desactivar cuenta) | F-01, G-01, F-05, G-05 | 4 |
| I-06 (forma de pago inactiva) | I-07 | 4 |

---

## 5. Pedidos al PR 0 (incorporados en la v20)

Todos quedaron incorporados en el PR 0 v20 (secciones 0, 2.13, 2.16 y 2.18). Todos son aditivos: no cambian ningún comportamiento de los Sprints 1 y 2.

| ID | Pedido | Por qué lo pide este reparto |
|---|---|---|
| **R7-PR0-1** | Publicar `listarHistorialEstados(entidad, id, db?)` en la etapa 2 (§2.13), junto con `registrarCambioEstado`, con las entidades PROFESOR, ALUMNO, FICHA_MESA_ENTRADA y FICHA_GERENTE | B-07 (carril 2, puesto 9) y F-05 / G-05 (carril 4) lo usan antes de que se programe D-08 (último del carril 2). Con esto ninguna depende de D-08 |
| **R7-PR0-2** | Seed de escenarios con, además de lo que ya pide v19 §2.16, al menos una inscripción en cada vigencia (VIGENTE, CANCELADA_ALUMNO, RESERVA_VENCIDA, BAJA_ALUMNO, QUITADA_CENTRO), reservas pendientes y vencidas, un pago anulado, formas de pago activa e inactiva, un alumno con forma de pago preferida inactiva, dos gerentes activos y una cuenta con invitación vencida. Todo creado con los servicios de 2.13; si alguna transición no tiene función propia en 2.13, el PR 0 la publica ahí (la HU dueña le agrega encima reglas, permisos y pantallas) | Permite que E-02, H-10, H-06 e I-06 se programen y prueben sin esperar a C-14, B-07 ni I-06 de otros carriles (E4, E5, E8) |
| **R7-PR0-3** | Orden de publicación de las firmas en la etapa 2 y de las adaptaciones de la etapa 3: **(a)** contratos de la unidad (`crearInscripcion`, `registrarOperacion`, `marcarVencidas`); **(b)** `registrarClaseDictada` adaptado (lo necesita E-09, primera del carril 3); **(c)** cuentas y `listarHistorialEstados` (A-06, B-07, F, G); **(d)** el resto | Los tres carriles que arrancan primero no esperan por orden de publicación |
| **R7-PR0-4** | Etapa 1 (schema, migración, seed base y tabla de permisos) disponible **primero**, antes de terminar las etapas 2 a 4. **Ajuste del SM en la v20:** se entrega al equipo apenas esté, en una rama compartida, pero **no se mergea sola a `develop`**: sin las etapas 2 y 3 el código existente no compila y el principio de compatibilidad exige que `develop` funcione siempre. El merge único del PR 0 no tiene fecha fija: lo define el equipo | Es lo que destraba a los carriles 1, 2 y 3 desde el primer día |

Sin pedido, solo coordinación: C-23 y C-25 siguen siendo HU del backlog (no se mueven al PR 0), así que sus SP y criterios no cambian.

---

## 6. Efecto sobre las specs

- **Contratos:** ninguno cambia.
- **Texto:** en `spec_modulo_B.md` (2.13.2), `spec_modulo_F.md` y `spec_modulo_G.md`, la fila de `listarHistorialEstados` pasa de «a agregar; la agrega HU-D-08» a «publicada por el PR 0 (R7-PR0-1)». La spec D (ya escrita, Revisión 3) nace con ese texto. Esta pasada de parches ya se hizo. Se hace en la pasada final de parches, junto con la matriz de permisos de A.
- **Specs por carril:** cada developer lee las specs de la columna «Módulos de spec» de su carril (más A §2.8 y §2.9 si toca cuentas).

---

## 7. Plan de recorte y rescate

Cada carril termina con algo cortable o redistribuible, para que un atraso en un carril no obligue a recortar en otro.

| Paso | Recorte (convención 7) | SP | Carril | Total que queda |
|---|---|---|---|---|
| 1 | HU-N-01 | −2 | 1 | 105 |
| 2 | HU-H-10 | −5 | 3 | 100 |
| 3 | HU-G-01, G-03, G-05 | −7 | 4 | 93 (piso) |
| 4 | Extras: «Resolver todas» (C-21), tabla de presentismo bajo (H-07) | — | 1 y 3 | — |

**Regla de rescate:** el carril 2 es el único sin recorte propio. Si alguien termina su carril antes (o queda liberado por un recorte), toma D-08 (última del carril 2, nadie depende de ella); después, la HU sin empezar de mayor prioridad del carril con más SP pendientes. Nunca se toma una HU ya empezada.

**Checkpoint:** las prioridades 1 a 12 son 24 SP y se reparten así: carril 1, C-25, I-10, I-11 y C-21 (8 SP); carril 2, C-23, C-20, C-22, C-24 y C-19 (9 SP); carril 3, E-09, H-06 y H-07 (7 SP). El carril 4 no tiene HU en el checkpoint a propósito: Adriel arranca con el PR 0, que es lo que destraba a los demás. Si la etapa 1 del PR 0 no se entrega a tiempo, el checkpoint se mide por el criterio alternativo de la convención 7 y no por las prioridades 1 a 12.

---

## 8. Decisiones tomadas por el SM

1. **Equidad:** carriles de 27 / 27 / 26 / 27 SP (máximo 1 SP de diferencia). Los SP son aproximados; por eso existe la regla de rescate.
2. **C-21 en el carril 1 y N-01 también:** C-21 no depende de nadie y N-01 es el primer recorte; ponerlas ahí iguala los SP sin romper la cohesión de los otros carriles.
3. **I-07 en el carril 4:** no depende de nadie; su patrón (listado con baja y reactivación) es el mismo que F-05 y G-05.
4. **B-07 antes que D-08 en el carril 2:** H-10 y E-02 (carril 3) necesitan B-07 antes; D-08 no la necesita nadie. B-07 no usa código de D-08 (usa los servicios de cuentas del PR 0).
5. **Las personas se asignan al carril completo**, no HU por HU: así no se reintroducen dependencias entre developers.
