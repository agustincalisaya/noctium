# Noctium — Historias de Usuario, Sprint 1

Sesión, alumnos, materias, profesores, turnos iniciales y agenda básica.
Total: 24 HU · 45 puntos.

---

## HU-A-01 — Iniciar sesión
**Módulo:** Gestionar sesión · **Prioridad:** 1 · **SP:** 1
**Como** usuario registrado (personal de mesa de entrada, profesor, gerente o alumno) **necesito** acceder de forma segura a las funciones habilitadas para mi rol.
**Justificación de secuencia:** Base habilitante: sin autenticación no se puede acceder a ninguna función protegida ni distinguir roles. Alta prioridad. No depende de otras historias.

**Criterios de aceptación:**
1. La pantalla de acceso muestra Email y Contraseña (obligatorios) y el botón Iniciar sesión.
   - Etiquetas visibles, foco inicial en Email.
   - Email se normaliza (sin espacios al inicio/fin) y se compara sin distinguir mayúsculas/minúsculas.
   - Si un campo está vacío o solo espacios, se indica junto al campo y no se envía.
   - Ofrece el acceso "Crear cuenta" → autorregistro del alumno (HU-B-08).
2. La contraseña aparece oculta, se puede alternar visibilidad temporalmente.
   - No altera el valor ingresado. Nunca se muestra en mensajes, URL ni logs.
   - Se transmite solo por HTTPS TLS 1.2+, nunca en URL/query params (RNF-SEG-01).
   - Se verifica contra hash bcrypt con la función de comparación del algoritmo, sin descifrar (RNF-SEG-02).
3. Con credenciales válidas y cuenta activa, se identifica el rol y se dirige a la pantalla principal correspondiente.
   - Cada rol (mesa de entrada, profesor, gerente, alumno) tiene su propia pantalla principal.
   - El menú muestra solo las opciones autorizadas para ese rol.
   - Se emite un token de sesión nuevo (JWT HS256) en cookie HttpOnly, Secure, SameSite=Strict, inaccesible desde JS (RNF-SEG-03).
   - El token contiene solo id de usuario, rol, fechas de emisión/vencimiento — nunca contraseña ni datos personales.
4. Si el email no existe o la contraseña es incorrecta: no se inicia sesión y se muestra el mismo mensaje en ambos casos: "Usuario o contraseña incorrectos".
   - No revela cuál dato falló ni si la cuenta existe.
   - Se conserva el email ingresado, se vacía Contraseña.
   - Si el email no existe, igual se compara contra un hash de referencia (para no filtrar por timing).
   - Tras 5 intentos fallidos para el mismo email desde la misma IP en 15 minutos, se rechazan nuevos intentos durante 15 minutos: "Demasiados intentos. Esperá unos minutos e intentá nuevamente" (RNF-SEG-06). La cuenta no se bloquea.
   - El intento fallido se registra con fecha, hora, email e IP, sin guardar la contraseña ingresada (RNF-SEG-09).
5. Si las credenciales son correctas pero la cuenta está inactiva: no se inicia sesión, se muestra "La cuenta está inactiva. Comunicate con la administración". Si la contraseña es incorrecta, se aplica el mensaje del criterio anterior.
   - El estado de la cuenta se evalúa SOLO después de validar la contraseña (para no revelar existencia de cuentas inactivas a terceros).
   - No se crea sesión ni se habilita navegación protegida.
6. Mientras se procesa la solicitud, el botón permanece deshabilitado con indicador de carga.
   - Evita envíos duplicados (doble clic / Enter repetido).
   - Si no hay respuesta o hay error de comunicación: "No se pudo conectar. Intentá nuevamente", el botón se rehabilita.
   - No se muestran mensajes técnicos ni detalles internos.
7. Un usuario con sesión válida que abre la pantalla de acceso es dirigido directamente a su pantalla principal (no se solicita nuevo login).

---

## HU-A-02 — Mantener sesión
**Módulo:** Gestionar sesión · **Prioridad:** 2 · **SP:** 3
**Como** usuario autenticado **necesito** mantener mi sesión activa mientras utilizo el sistema, **para** navegar sin volver a identificarme en cada pantalla y sin exponer mi cuenta.
**Justificación de secuencia:** Depende de HU-A-01. Protege todas las pantallas verificando sesión y permisos de rol; debe existir antes de construir cualquier módulo. Alta prioridad.

**Criterios de aceptación:**
1. La autenticación se conserva al navegar o recargar mientras la sesión sea válida.
   - Recargar no pierde la sesión ni obliga a reingresar credenciales.
   - Abrir en otra pestaña del mismo navegador reutiliza la sesión vigente.
   - El token se conserva en cookie HttpOnly/Secure/SameSite=Strict (RNF-SEG-03); no en localStorage/sessionStorage (protección contra XSS).
2. Cada acceso a una función protegida comprueba en el servidor la vigencia de sesión y permisos del rol.
   - En cada solicitud el servidor verifica firma del token, vencimiento y que no esté en la lista de revocación (RNF-SEG-04); si falla, responde 401 sin procesar.
   - Ocultar una opción en la UI no alcanza: el servidor rechaza con 403 cualquier solicitud sin permiso, aunque se invoque directamente.
   - Intento no autorizado: "No tenés permisos para acceder a esta sección", no modifica datos.
   - Acciones no permitidas para el rol no se muestran en menú ni pantallas.
3. La sesión expira al alcanzar el tiempo de inactividad configurado por el centro.
   - Se considera actividad cualquier navegación/interacción que genere solicitud al servidor.
   - Vencimiento por inactividad con renovación deslizante: cada solicitud válida emite token con nuevo vencimiento de 30 minutos.
   - La renovación nunca supera la duración máxima de 8 horas desde el inicio de sesión (registrado en el propio token).
   - Ambos valores son parámetros del sistema (ver Parámetros configurables).
4. Cuando la sesión está próxima a vencer por inactividad, se avisa al usuario y permite renovarla sin perder el trabajo en curso.
   - Aviso con anticipación configurada, indica tiempo restante.
   - "Continuar sesión" renueva el vencimiento sin recargar ni perder datos de formulario abierto.
   - Si no responde, la sesión vence según el criterio siguiente.
5. Si la sesión vence o el servidor la rechaza por inválida: se elimina la autenticación local, redirige al login, informa "Tu sesión expiró. Iniciá sesión nuevamente".
   - Solicitudes en curso se cancelan sin guardar cambios parciales.
   - Al volver a loguearse, se dirige a su pantalla principal.
6. Volver atrás o abrir directamente una URL protegida tras el vencimiento no muestra información privada.
   - Las pantallas protegidas no se muestran desde caché del navegador.
   - Cualquier URL protegida sin sesión válida redirige al login.

---

## HU-A-03 — Cerrar sesión
**Módulo:** Gestionar sesión · **Prioridad:** 3 · **SP:** 1
**Como** usuario autenticado **necesito** cerrar mi sesión al terminar, **para** evitar accesos posteriores desde el mismo dispositivo.
**Justificación de secuencia:** Depende de HU-A-01 y HU-A-02. Completa el ciclo de sesión, evita accesos desde equipos compartidos. Alta prioridad.

**Criterios de aceptación:**
1. "Cerrar sesión" disponible desde el menú de usuario en todas las pantallas autenticadas, siempre en el mismo lugar, junto al nombre y rol. Disponible para todos los roles.
2. Si hay un formulario con cambios sin guardar, se solicita confirmación antes de cerrar sesión: "Tenés cambios sin guardar. ¿Querés cerrar sesión igualmente?". Si cancela, permanece con los datos intactos.
3. Al ejecutarla, invalida la sesión y elimina la información local de autenticación.
   - El servidor agrega el jti a la lista de revocación hasta su vencimiento original (RNF-SEG-04).
   - La respuesta elimina la cookie de sesión (Max-Age=0); la app descarta el estado del usuario en memoria y datos temporales de pantallas protegidas.
   - El cierre de sesión se registra con fecha, hora, usuario e IP (RNF-SEG-09).
4. Se redirige al login con "Sesión cerrada correctamente".
5. Tras el cierre, recargar, volver atrás o abrir una URL protegida solicita nueva autenticación. No se muestra información privada, ni momentáneamente.
6. Si ocurre un error de comunicación al cerrar sesión, la app descarta igualmente el estado en memoria y redirige al login.
   - Como la cookie HttpOnly no puede borrarse desde JS, la app reintenta la invalidación en segundo plano; si no lo logra, el token deja de ser válido al vencer.
   - El usuario no queda en estado intermedio con acceso a pantallas protegidas. No se muestran mensajes técnicos.

---

## HU-L-01 — Registrar materia
**Módulo:** Gestionar materias · **Prioridad:** 4 · **SP:** 1
**Como** gerente **necesito** registrar una materia, **para** asociarla con profesores y utilizarla al configurar turnos.
**Justificación de secuencia:** Base habilitante: sin materias no se pueden asociar profesores (HU-D-03) ni configurar turnos (HU-C-03). Depende de HU-A-01.

**Criterios de aceptación:**
1. "Nueva materia" solicita Nombre (obligatorio) y Código (opcional). Solo el gerente puede registrar materias. Etiquetas visibles y ayudas de formato.
2. El nombre se normaliza (sin espacios extra) y no puede quedar vacío; entre 2 y 80 caracteres. El código, si se informa, admite letras/números sin espacios, hasta 10 caracteres, se guarda en mayúsculas.
3. No se permite repetir nombre ni código ya asignado, considerando materias activas e inactivas.
   - Comparación no distingue mayúsculas/acentos (Matemática = matematica).
   - Verificación se repite en el servidor al confirmar.
   - Aviso indica cuál dato está repetido y si la materia existente está inactiva.
4. Con datos válidos se crea la materia en estado Activa: "Materia registrada correctamente".
   - Se genera identificador interno, se registran fecha de alta y usuario.
   - Disponible de inmediato para asociar profesores (HU-D-03) y configurar turnos (HU-C-03).
5. En este Sprint no se configura duración por materia; los turnos usan la duración estándar del centro.
6. "Cancelar" vuelve al listado sin guardar; si hay datos ingresados, solicita confirmación.

---

## HU-B-01 — Registrar datos de identidad del alumno
**Módulo:** Gestionar alumnos · **Prioridad:** 5 · **SP:** 1
**Como** personal de mesa de entrada **necesito** registrar los datos de identidad de un alumno, **para** disponer de una ficha confiable al gestionar turnos y su futura atención académica.
**Justificación de secuencia:** Base habilitante: el alumno es participante obligatorio del turno (HU-C-04). Depende de HU-A-01.

**Criterios de aceptación:**
1. "Nuevo alumno" abre formulario vacío: Nombre, Apellido, DNI, Fecha de nacimiento, Género. Etiquetas, ayudas de formato, marca de obligatorios. Solo disponible para roles autorizados; el servidor rechaza otros roles.
2. Nombre, Apellido, DNI y Fecha de nacimiento obligatorios; Género opcional, de lista configurada.
   - Campos obligatorios no aceptan vacío ni solo espacios.
   - Señala cada dato faltante, impide confirmar.
   - Género ofrece solo valores del catálogo, incluida "Prefiero no indicarlo"; sin texto libre.
3. Nombre/Apellido admiten letras, espacios, acentos, apóstrofes, guiones; DNI solo números sin separadores.
   - Nombre/Apellido: 2-50 caracteres, sin números/símbolos, espacios normalizados.
   - Si el DNI tiene puntos/espacios/guiones: "Ingresá el DNI solo con números".
4. Fecha de nacimiento no admite fechas futuras ni inexistentes (calendario o dd/mm/aaaa). 31/02 o fechas futuras se rechazan con mensaje específico.
5. DNI respeta longitud configurada y no puede pertenecer a otra ficha (activa o inactiva).
   - Verificación al salir del campo y repetida en servidor al confirmar.
   - Si ya existe: "Ya existe un alumno registrado con ese DNI", indicando si está inactiva; no se crea el registro.
6. Antes de confirmar, se vuelve a comprobar unicidad del DNI (evita duplicados simultáneos): solo se crea la primera ficha.
7. Con datos válidos se crea ficha activa, id interno, "Alumno registrado correctamente".
   - Transacción única; registra fecha de alta y usuario.
   - Ofrece continuar con contacto (HU-B-02) y forma de pago (HU-B-03).
   - Aparece inmediatamente en el listado.
8. "Cancelar" vuelve al listado sin guardar (confirmación si hay datos ingresados). No se crean registros incompletos. Al volver, conserva página/orden.
9. Errores específicos junto a cada campo; no se crea registro parcial. Datos válidos permanecen cargados, foco al primer campo inválido. Sin mensajes técnicos.

---

## HU-D-01 — Registrar datos de identidad del profesor
**Módulo:** Gestionar profesores · **Prioridad:** 6 · **SP:** 1
**Como** gerente **necesito** registrar los datos de identidad de un profesor, **para** disponer de una ficha que pueda asociarse con materias, horarios y turnos.
**Justificación de secuencia:** Base habilitante: sin ficha de profesor no se pueden asociar materias, registrar horarios ni asignarlo a turnos. Depende de HU-A-01.

**Criterios de aceptación:**
1. "Nuevo profesor" solicita Nombre, Apellido, DNI, Fecha de nacimiento (obligatorios), Género (opcional, de lista configurada, sin texto libre).
2. Nombre/Apellido: letras, espacios, acentos, apóstrofes, guiones, 2-50 caracteres, espacios normalizados. DNI solo números. Fecha de nacimiento sin futuras ni inexistentes.
3. DNI respeta longitud configurada, no puede pertenecer a otro profesor activo o inactivo.
   - Verificación al salir del campo y repetida en servidor.
   - Si existe: "Ya existe un profesor registrado con ese DNI", no se crea.
4. Con datos válidos: ficha activa, id interno, "Profesor registrado correctamente".
   - Transacción única, registra fecha de alta y usuario.
   - Ofrece continuar con contacto (HU-D-02), materias (HU-D-03), horarios (HU-D-04).
5. Registrar la ficha NO crea una cuenta de acceso; las cuentas se administran de manera independiente.
6. "Cancelar" vuelve al listado sin guardar (confirmación si hay datos). Errores junto a cada campo, sin alta parcial.

---

## HU-D-03 — Asociar profesor a materias o especialidades
**Módulo:** Gestionar profesores · **Prioridad:** 7 · **SP:** 2
**Como** gerente **necesito** asociar un profesor con una o más materias, **para** ofrecerle turnos únicamente de las materias que puede dictar.
**Justificación de secuencia:** Depende de HU-D-01 y HU-L-01. Requisito de HU-C-04: solo se ofrecen profesores asociados a la materia del turno.

**Criterios de aceptación:**
1. La ficha del profesor muestra las materias activas, permite seleccionar una o varias.
   - Selector filtra por nombre/código, sin distinguir mayúsculas/acentos.
   - Cada opción muestra nombre y código (si existe).
   - Solo pueden asociarse materias a profesores activos.
2. Materias ya asociadas se identifican claramente, no pueden duplicarse (marcadas, no reseleccionables; servidor rechaza duplicado).
3. Para confirmar debe seleccionarse al menos una materia nueva.
4. Si una materia deja de estar activa antes de confirmar, no se crea la asociación; se informa el cambio (no se guarda ninguna de esa confirmación, se indica cuál materia dejó de estar activa; se puede quitar y reconfirmar).
5. Todas las asociaciones seleccionadas se guardan en una única operación: "Materias del profesor actualizadas".
6. Las materias asociadas quedan disponibles al asignar el profesor a un turno (HU-C-04 solo ofrece profesores asociados a la materia del turno).

---

## HU-D-04 — Registrar horario de atención del profesor
**Módulo:** Gestionar profesores · **Prioridad:** 8 · **SP:** 1
**Como** gerente **necesito** registrar los días y horarios de atención de un profesor, **para** validar su disponibilidad al asignar turnos.
**Justificación de secuencia:** Depende de HU-D-01. Requisito de HU-C-04: la disponibilidad se valida contra este horario.

**Criterios de aceptación:**
1. Formulario solicita Profesor, Día de la semana, Hora de inicio, Hora de fin. Solo profesores activos. Horas en formato 24h, respetan la granularidad configurada.
2. El horario se registra para el profesor, independiente de la materia; se aplica todas las semanas (recurrente).
3. Hora de inicio anterior a la de fin; el intervalo debe estar dentro del horario operativo del centro.
   - Un intervalo fuera del horario operativo se rechaza indicando la franja permitida.
   - Solo días en que el centro atiende.
4. Pueden registrarse varios intervalos por día si no se superponen (los contiguos, ej. 10-12 y 12-14, NO se consideran superpuestos).
5. Ante superposición, se identifica día e intervalo en conflicto, no se guarda el nuevo horario (ej. "El intervalo se superpone con Lunes 10:00–12:00").
6. Con datos válidos, el intervalo queda disponible para validar turnos: "Horario registrado correctamente".
   - La ficha muestra un resumen semanal de todos los intervalos. Operación transaccional, registra fecha y usuario.

---

## HU-K-01 — Registrar aula
**Módulo:** Gestionar aulas · **Prioridad:** 9 · **SP:** 1
**Como** gerente **necesito** registrar un aula con su identificación y capacidad, **para** asignar un espacio físico a los turnos.
**Justificación de secuencia:** Base habilitante: sin aulas un turno no puede pasar de Pendiente a Agendado (HU-C-15). Depende de HU-A-01.

**Criterios de aceptación:**
1. "Nueva aula" solicita Nombre o número y Capacidad (obligatorios). Solo el gerente puede registrar aulas.
2. Nombre/número se normaliza, no puede repetirse en otra aula activa o inactiva (1-30 caracteres, comparación sin distinguir mayúsculas: "Aula 1" = "aula 1"; verificación repetida en servidor).
3. Capacidad acepta solo enteros mayores que cero (sin decimales, negativos, cero ni texto).
4. Con datos válidos: aula en estado Activa, "Aula registrada correctamente". Se genera id, fecha de alta, usuario. Disponible de inmediato para asignar a turnos (HU-C-15).
5. Registrar el aula NO la asigna automáticamente a ningún turno.
6. Si hay duplicado o valor inválido: error junto al campo, no se crea el registro. "Cancelar" vuelve al listado sin guardar.

---

## HU-C-03 — Configurar turno
**Módulo:** Gestionar turnos · **Prioridad:** 10 · **SP:** 5
**Como** personal de mesa de entrada **necesito** configurar la fecha, hora y materia de un turno, **para** iniciar una reserva antes de asignar sus participantes y aula.
**Justificación de secuencia:** Núcleo del flujo de atención; primer paso para registrar un turno. Depende de HU-L-01. HU de mayor complejidad del Sprint (5 SP).

**Criterios de aceptación:**
1. Formulario solicita Fecha, Hora y Materia (obligatorios), solo materias activas. Cada materia con nombre y código si existe. Si no hay materias activas: "No hay materias activas para configurar turnos".
2. Fecha y hora deben ser un momento futuro, dentro del horario operativo del centro.
   - No fechas pasadas; si es hoy, hora posterior a la actual.
   - No días en que el centro no atiende.
   - El turno completo (incluida hora de finalización) debe quedar dentro del horario operativo.
   - La fecha no puede superar la anticipación máxima configurada.
3. La hora de finalización se calcula con la duración estándar configurada por el centro.
   - Hora de inicio según la granularidad configurada. Hora de fin se muestra, no editable.
4. En este Sprint la fecha/hora se seleccionan manualmente; el sistema no propone franjas disponibles automáticamente.
5. Con datos válidos: turno en estado Pendiente, "Turno configurado". Se registran id, fecha de creación, usuario. Ofrece continuar con HU-C-04.
6. El turno pendiente no aparece en calendarios hasta completar alumno, profesor y aula. No reserva recursos (no bloquea profesor, alumno ni aula).
7. Cambiar materia u horario de un turno pendiente obliga a revalidar las asignaciones dependientes antes de agendarlo.
   - Si una asignación deja de ser válida (ej. el profesor no dicta la nueva materia), se quita y se informa cuál debe reasignarse.
   - Si al continuar un turno pendiente su fecha/hora ya pasaron, exige modificarlas antes de avanzar.
8. Errores junto al campo afectado, conservan los demás valores. "Cancelar" descarta sin crear registros.

---

## HU-C-04 — Asignar alumno y profesor al turno
**Módulo:** Gestionar turnos · **Prioridad:** 11 · **SP:** 2
**Como** personal de mesa de entrada **necesito** asignar un alumno y un profesor a un turno configurado, **para** identificar quién recibirá y quién brindará la clase.
**Justificación de secuencia:** Depende de HU-C-03, HU-B-01, HU-D-03 y HU-D-04.

**Criterios de aceptación:**
1. Se puede localizar y seleccionar un alumno activo por Nombre, Apellido o DNI.
   - Búsqueda activa desde 2 caracteres, coincidencias parciales, sin distinguir mayúsculas/acentos.
   - Cada resultado muestra Apellido, Nombre y DNI. Cada turno tiene EXACTAMENTE un alumno y un profesor.
2. Solo profesores activos asociados con la materia del turno. Si no hay ninguno: "No hay profesores activos asociados a esta materia".
3. Al seleccionar un profesor, se comprueba que el turno completo esté dentro de su horario de atención y no se superponga con otro turno agendado.
   - Se considera el intervalo completo, no solo la hora de inicio. Contiguos no se consideran superpuestos.
   - Solo los turnos agendados generan conflicto; los pendientes no reservan recursos.
4. El alumno tampoco puede tener otro turno agendado que se superponga con el mismo intervalo.
5. La disponibilidad de alumno y profesor se vuelve a validar al confirmar (ambas en una única operación, para evitar asignaciones simultáneas).
6. Si hay conflicto, el turno conserva su estado anterior y se identifica el recurso no disponible (ej. "El profesor ya tiene un turno agendado de 10:00 a 11:00", "El turno está fuera del horario de atención del profesor", "El alumno ya tiene un turno agendado en ese horario").
7. Una asignación válida guarda ambos participantes; el turno sigue Pendiente hasta tener aula. "Alumno y profesor asignados correctamente", ofrece continuar con HU-C-15.
   - Mientras esté Pendiente, alumno y profesor pueden reemplazarse con las mismas validaciones.
8. "Cancelar" mantiene el turno sin cambios.

---

## HU-C-15 — Asignar aula al turno
**Módulo:** Gestionar turnos · **Prioridad:** 12 · **SP:** 2
**Como** personal de mesa de entrada **necesito** asignar un aula disponible a un turno, **para** completar su configuración y reservar el espacio físico al confirmarlo.
**Justificación de secuencia:** Depende de HU-C-04 y HU-K-01. Al confirmar, el turno pasa de Pendiente a Disponible o Completo según la cantidad de alumnos inscriptos y su cupo máximo.

**Criterios de aceptación:**
1. Muestra aulas activas con Nombre/número y Capacidad; solo ofrece las que tienen capacidad mayor o igual al cupo máximo del turno. Si no hay aulas activas: "No hay aulas activas registradas" y el turno sigue Pendiente. Si el aula seleccionada no alcanza el cupo: "La capacidad del aula es menor que el cupo máximo del turno".
2. El aula no debe tener otro turno Disponible o Completo superpuesto en el mismo horario; los turnos contiguos están permitidos.
3. Mientras el turno siga Pendiente, se puede guardar o reemplazar el aula sin reservarla ni alterar profesor, alumnos u otros datos. Si todavía falta profesor o no hay alumnos, permanece Pendiente; al guardar se informa "Aula asignada correctamente".
4. Cuando el turno tiene materia, fecha y hora futuras, profesor válido y al menos un alumno válido sin exceder el cupo máximo, asignar el aula lo confirma. En una única operación atómica se revalidan aula activa, capacidad y disponibilidad de aula, profesor y **todos** los alumnos; al confirmar quedan reservados esos recursos. Los turnos Pendiente no reservan recursos.
5. Si el aula o cualquier otro recurso deja de estar disponible, o la fecha/hora ya pasó, se informa la causa y la operación se revierte por completo: el turno conserva sus datos y estado, sin reservas parciales. Se puede elegir otra aula sin perder la selección ni los demás datos del formulario.
6. Al confirmar, el turno pasa a Disponible si quedan lugares o a Completo si los alumnos inscriptos alcanzan el cupo máximo. Se muestra exactamente "Turno confirmado correctamente".
7. El turno confirmado aparece actualizado en HU-C-01 y en los calendarios correspondientes.

---

## HU-C-01 — Listar turnos
**Módulo:** Gestionar turnos · **Prioridad:** 13 · **SP:** 3
**Como** personal de mesa de entrada **necesito** consultar los turnos registrados, **para** organizar la atención y acceder a la información de cada turno.
**Justificación de secuencia:** Depende de HU-C-03.

**Criterios de aceptación:**
1. Muestra Fecha, Hora, Alumno, Profesor, Materia, Aula y Estado; si un turno pendiente no tiene un dato, se indica "Sin asignar".
   - Hora como intervalo (ej. 10:00–11:00). Alumno/profesor como "Apellido, Nombre". Estado como texto (Pendiente/Agendado), no solo color.
2. Por defecto, turnos agendados próximos ordenados por Fecha y Hora ascendente, desde la fecha actual en adelante. Igual fecha/hora: profesor como segundo criterio.
3. Turnos pendientes se distinguen (etiqueta "Pendiente") y permiten continuar su configuración ("Continuar configuración" → siguiente paso: HU-C-04 o HU-C-15).
4. Cada registro permite abrir el detalle (modo consulta: todos los datos, estado, fecha de creación, usuario que lo registró). Al regresar se conserva página y orden.
5. Paginación cuando supera el límite configurado. "Cargando turnos" / "No hay turnos registrados" / error con Reintentar.
6. Tras configurar/completar un turno, el listado refleja inmediatamente su nuevo estado.
7. Esta historia NO incluye búsqueda inteligente, filtros combinados, cancelación ni modificación de fecha/hora.

---

## HU-D-05 — Listar profesores
**Módulo:** Gestionar profesores · **Prioridad:** 14 · **SP:** 2
**Como** gerente **necesito** consultar los profesores registrados, **para** revisar sus datos, materias y horarios.
**Justificación de secuencia:** Depende de HU-D-01. Requisito de HU-J-01 para seleccionar al profesor.

**Criterios de aceptación:**
1. Muestra Apellido y nombre, DNI, contacto, materias asociadas y estado. Contacto: teléfono/email si existen, ausente = "—". Estado como texto (Activo/Inactivo).
2. Orden inicial por Apellido y Nombre ascendente; DNI como segundo criterio.
3. Cada registro abre un detalle con datos, materias y horarios (agrupados por día de semana).
4. Materias múltiples se presentan resumidas sin impedir el detalle completo (ej. "Matemática, Física +2").
5. Paginación cuando supera el límite. Indicador de carga / "No hay profesores registrados" / Reintentar ante error.
6. Esta historia NO incluye modificación ni desactivación del profesor.

---

## HU-J-01 — Visualizar calendario de turnos por profesor
**Módulo:** Visualizar calendario · **Prioridad:** 15 · **SP:** 3
**Como** usuario autorizado **necesito** visualizar el calendario de turnos de un profesor, **para** conocer su agenda de clases.
**Justificación de secuencia:** Depende de HU-C-15 y HU-D-05 (solo muestra turnos agendados). Cierra el flujo básico de atención.

**Criterios de aceptación:**
1. Mesa de entrada y gerencia pueden seleccionar un profesor activo y consultar sus turnos agendados en vista semanal básica.
   - Abre en la semana actual, columnas de días operativos, filas del horario operativo. Encabezado indica el rango de fechas.
2. Un profesor que accede visualiza directamente su propia agenda, no puede consultar agendas no autorizadas (no ve el selector de profesores; el servidor rechaza solicitudes de otra agenda).
3. Cada evento muestra Hora, Alumno, Materia, Aula y Estado según permisos del rol. Ocupa el espacio del intervalo completo. Estado con texto/ícono además de color.
4. Los turnos pendientes NO aparecen en el calendario.
5. Se puede navegar a la semana anterior/siguiente y volver a la actual con "Hoy".
6. Al seleccionar un evento se abre el detalle; al regresar se conservan profesor y semana consultados.
7. Si el profesor no tiene turnos en el período: "Agenda sin turnos". Indicador de carga / error con Reintentar.
8. Vistas por día/mes intercambiables corresponden a un incremento posterior.

---

## HU-B-02 — Registrar datos de contacto del alumno
**Módulo:** Gestionar alumnos · **Prioridad:** 16 · **SP:** 1
**Como** personal de mesa de entrada **necesito** registrar los datos de contacto de un alumno, **para** comunicarle turnos y novedades del centro.
**Justificación de secuencia:** Depende de HU-B-01.

**Criterios de aceptación:**
1. Desde la ficha se pueden registrar Teléfono y Email; al menos uno es obligatorio.
   - Si ambos vacíos: "Ingresá al menos un teléfono o un email de contacto".
   - Vinculados al alumno previamente identificado (no se pueden registrar sin ficha existente). Pueden cargarse al alta o después.
2. Teléfono acepta formatos habituales, se normaliza al guardar, entre 8 y 15 dígitos.
   - Acepta dígitos y +, espacios, guiones, paréntesis. Se normaliza eliminando espacios/guiones/paréntesis, conservando el + inicial.
   - Longitud se calcula solo sobre dígitos (ej. "(0387) 15-412-3456" → "0387154123456").
3. Email elimina espacios al inicio/fin, formato válido (usuario@dominio), se guarda en minúsculas, máximo 254 caracteres.
   - Formato incorrecto: "Ingresá un email válido", no se guarda.
4. Si el email se usará para crear una cuenta, no puede estar asociado a otra cuenta existente (verificación en servidor; aviso no revela a quién pertenece la otra cuenta).
5. Con datos válidos: información vinculada al alumno, "Datos de contacto del alumno guardados correctamente". Transacción única, actualiza fecha de última modificación. Se refleja de inmediato en ficha y listado.
6. Dato inválido: mensaje específico junto al campo, no se guardan cambios parciales; el resto permanece cargado.

---

## HU-B-04 — Listar alumnos
**Módulo:** Gestionar alumnos · **Prioridad:** 17 · **SP:** 2
**Como** personal de mesa de entrada **necesito** consultar los alumnos registrados, **para** acceder a sus fichas y realizar las acciones disponibles en este Sprint.
**Justificación de secuencia:** Depende de HU-B-01. Punto de entrada para modificar fichas (HU-B-06).

**Criterios de aceptación:**
1. Muestra Apellido y nombre, DNI, teléfono, email y estado. Dato no registrado = "—". Valores largos se recortan (ver completos en detalle). Solo para roles autorizados.
2. Orden inicial por Apellido y Nombre ascendente, sin distinguir mayúsculas/acentos; DNI como segundo criterio (orden estable).
3. Cada registro abre el detalle y (por incluirse HU-B-06) accede a "Modificar datos". Detalle en modo consulta: identidad, contacto, forma de pago preferida, estado, fecha de alta.
4. Paginación cuando supera el límite configurado. Informa página actual y total. Cambiar de página no duplica/omite registros, conserva orden. Al regresar desde detalle/edición vuelve a la misma página.
5. Estado como texto (Activo/Inactivo), no solo color.
6. "Cargando alumnos" / "No hay alumnos registrados" con acceso a "Nuevo alumno" / error con Reintentar.
7. Tras registrar o modificar un alumno, el listado refleja de inmediato la información actualizada.
8. Esta historia NO incluye búsqueda inteligente, filtros combinados ni desactivación.

---

## HU-B-03 — Asociar alumno a forma de pago preferida
**Módulo:** Gestionar alumnos · **Prioridad:** 18 · **SP:** 2
**Como** personal de mesa de entrada **necesito** indicar la forma de pago preferida de un alumno, **para** agilizar la configuración de futuros turnos y cobros.
**Justificación de secuencia:** Depende de HU-B-01 y del catálogo precargado de formas de pago. Media prioridad (prepara Sprint 2 pagos); debe estar antes de HU-B-06.

**Criterios de aceptación:**
1. La ficha muestra únicamente las formas de pago ACTIVAS precargadas para este Sprint. Cada opción muestra solo su nombre (Efectivo, Transferencia). No se solicitan ni almacenan números de tarjeta, CBU ni otros datos financieros sensibles.
2. La preferencia es opcional; máximo una por alumno. Selección de opción única, incluye "Sin preferencia". El servidor impide más de una preferencia por alumno.
3. Al guardar una nueva opción, reemplaza a la anterior; se usa como valor inicial en operaciones futuras (que pueden cambiarse puntualmente sin modificar la preferencia guardada).
4. Cambiar o quitar la preferencia no altera pagos ni turnos históricos (conservan la forma de pago con la que fueron creados).
5. Si no existen opciones activas: "No hay formas de pago disponibles. Podés continuar sin preferencia" (no impide guardar el resto de la ficha).
6. Si la forma de pago seleccionada se desactiva entre la apertura del formulario y la confirmación, no se guarda la preferencia, se informa el cambio (se revalida en servidor al confirmar).
7. Al guardar correctamente: "Forma de pago preferida actualizada".

---

## HU-B-06 — Modificar datos del alumno
**Módulo:** Gestionar alumnos · **Prioridad:** 19 · **SP:** 1
**Como** personal de mesa de entrada **necesito** modificar la información de un alumno registrado, **para** mantener actualizados sus datos de identidad, contacto y preferencia de pago.
**Justificación de secuencia:** Depende de HU-B-01, HU-B-02, HU-B-03 y HU-B-04 (modifica todos esos datos desde el listado).

**Criterios de aceptación:**
1. Desde el detalle o listado se abre un formulario precargado con los datos actuales. Mismas etiquetas y ayudas que en el alta.
2. Se pueden modificar Nombre, Apellido, DNI, Fecha de nacimiento, Género, Teléfono, Email y forma de pago preferida. Id interno, fecha de alta y estado se muestran sin edición.
3. Los datos modificados cumplen las mismas validaciones del alta (HU-B-01 identidad, HU-B-02 contacto, HU-B-03 forma de pago).
4. Si se cambia el DNI, se comprueba que no pertenezca a otro alumno (activo o inactivo), excluyendo la propia ficha. Si se cambia el email asociado a una cuenta, también se valida unicidad y se avisa antes de confirmar que el nuevo email pasará a ser su email de acceso.
5. Al guardar se actualizan solo los datos modificados: "Alumno actualizado correctamente". Transacción única, registra fecha y usuario de la modificación. Si no hubo cambios, "Guardar" permanece deshabilitado.
6. Si otro usuario modificó la ficha mientras el formulario estaba abierto, no se sobrescriben sus cambios: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales".
7. Los turnos del alumno siguen vinculados a la misma ficha y muestran datos actualizados.
8. "Cancelar" descarta modificaciones (confirmación si hay cambios).
9. Esta historia NO permite cambiar el estado activo/inactivo del alumno.

---

## HU-D-02 — Registrar datos de contacto del profesor
**Módulo:** Gestionar profesores · **Prioridad:** 20 · **SP:** 1
**Como** gerente **necesito** registrar los datos de contacto de un profesor, **para** coordinar su agenda y comunicar novedades.
**Justificación de secuencia:** Depende de HU-D-01. No bloquea la asignación de turnos.

**Criterios de aceptación:**
1. Desde la ficha se registran Teléfono y Email; al menos uno obligatorio. Si ambos vacíos: "Ingresá al menos un teléfono o un email de contacto".
2. Teléfono: formatos habituales, normalizado, 8-15 dígitos (dígitos + +, espacios, guiones, paréntesis; conserva + inicial). Longitud solo sobre dígitos.
3. Email: sin espacios al inicio/fin, formato válido, minúsculas, máximo 254 caracteres.
4. Si el email está vinculado a una cuenta interna, no puede pertenecer a otra cuenta (verificación en servidor, aviso no revela a quién pertenece).
5. Con datos válidos: "Datos de contacto del profesor guardados correctamente". Guardado transaccional, actualiza fecha de última modificación.
6. Errores junto al campo correspondiente, evitan guardar información parcial.

---

## HU-L-02 — Listar materias
**Módulo:** Gestionar materias · **Prioridad:** 21 · **SP:** 2
**Como** gerente **necesito** consultar las materias registradas, **para** conocer las opciones disponibles para profesores y turnos.
**Justificación de secuencia:** Depende de HU-L-01. Requisito de HU-J-02.

**Criterios de aceptación:**
1. Muestra Nombre, Código (si existe, sino "—"), cantidad de profesores asociados y Estado (texto: Activa/Inactiva).
2. Orden inicial por Nombre ascendente, sin distinguir mayúsculas/acentos.
3. Cada registro abre detalle en modo consulta: nombre, código, estado, fecha de alta, profesores asociados.
4. "No hay materias registradas" con acceso a "Nueva materia". Indicador de carga / Reintentar ante error.
5. Paginación cuando supera el límite configurado.
6. Esta historia NO incluye modificación, baja ni reactivación.

---

## HU-J-02 — Visualizar calendario por materia
**Módulo:** Visualizar calendario · **Prioridad:** 22 · **SP:** 2
**Como** usuario autorizado **necesito** visualizar los turnos correspondientes a una materia, **para** conocer la distribución de sus clases.
**Justificación de secuencia:** Depende de HU-C-15 y HU-L-02.

**Criterios de aceptación:**
1. Permite seleccionar una materia activa, muestra sus turnos agendados en vista semanal básica. Abre en la semana actual, indica el rango. Mesa de entrada/gerencia ven todos los turnos de la materia; un profesor ve solo los suyos.
2. Cada evento muestra Hora, Profesor, Alumno, Aula y Estado según permisos. Si hay varios turnos en el mismo horario con distintos profesores, se muestran uno junto al otro sin ocultarse. Estado con texto/ícono además de color.
3. Los turnos pendientes NO aparecen.
4. La materia seleccionada se conserva al navegar entre semanas y al regresar del detalle. "Hoy" regresa a la semana actual.
5. Si no hay turnos para la materia en el período: "No hay turnos para la materia seleccionada". Indicador de carga / Reintentar ante error.
6. Esta historia NO incluye filtros combinados ni vistas por día/mes.

---

## HU-K-02 — Listar aulas
**Módulo:** Gestionar aulas · **Prioridad:** 23 · **SP:** 2
**Como** gerente **necesito** consultar las aulas registradas, **para** conocer los espacios que pueden asignarse a turnos.
**Justificación de secuencia:** Depende de HU-K-01. No bloquea el flujo (HU-C-15 muestra aulas activas al asignar).

**Criterios de aceptación:**
1. Muestra Nombre/número, Capacidad y Estado (texto: Activa/Inactiva).
2. Orden inicial por Nombre/número ascendente; considera números de forma natural (Aula 2 antes que Aula 10).
3. Cada registro abre detalle en modo consulta: nombre/número, capacidad, estado, fecha de alta.
4. "No hay aulas registradas" con acceso a "Nueva aula". Indicador de carga / Reintentar ante error.
5. Paginación cuando supera el límite configurado.
6. Esta historia NO incluye modificación, baja ni consulta automática de disponibilidad por horario.

---

## HU-B-08 — Autorregistro del alumno
**Módulo:** Gestionar alumnos · **Prioridad:** 24 · **SP:** 3
**Como** alumno **necesito** crear mi cuenta desde un formulario público, **para** acceder al sistema sin depender del personal de mesa de entrada.
**Justificación de secuencia:** Depende de HU-A-01. Habilita el acceso del alumno; sus funciones propias llegan en Sprint 2. Se ubica al final del Sprint.

**Criterios de aceptación:**
1. Formulario solicita Nombre, Apellido, DNI, Fecha de nacimiento, Email, Teléfono (opcional), Contraseña y Confirmación. Accesible sin sesión desde "Crear cuenta" del login. Email obligatorio (será el dato de acceso).
2. DNI, email y datos de contacto cumplen las mismas validaciones que la ficha del alumno; la contraseña cumple la política de seguridad configurada.
   - Validaciones en interfaz, repetidas en servidor. Mientras se escribe la contraseña se indica qué requisitos ya se cumplen.
   - Confirmación debe coincidir exactamente. Contraseña no puede coincidir con email ni DNI.
   - Se almacena solo como hash bcrypt, factor de costo 12, salt único automático (RNF-SEG-02); nunca en texto plano ni cifrado reversible.
3. Si no existe ficha con ese DNI: se crea la ficha de alumno junto con una cuenta activa con rol Alumno, en una única operación (si una parte falla, no se crea ninguna).
4. Si existe una ficha sin cuenta: no se duplica; se envía un código al email registrado y, tras verificarlo, se vincula la nueva cuenta con esa ficha.
   - Código de 6 dígitos generado con RNG criptográficamente seguro (RNF-SEG-05).
   - En la base se guarda solo su HMAC-SHA256 con clave del servidor; comparación en tiempo constante.
   - Solicitar un nuevo código invalida el anterior.
   - El email de destino se muestra enmascarado (ej. j***@gmail.com).
   - Código de un solo uso, vence según tiempo configurado, admite cantidad máxima de intentos.
   - Se puede solicitar reenvío tras un intervalo de espera.
5. Si la ficha existente no tiene email verificable o los datos no coinciden: se deriva a mesa de entrada sin revelar información privada.
   - "No pudimos completar el registro en línea. Acercate a mesa de entrada para vincular tu cuenta." No indica qué dato no coincidió ni la info de la ficha.
6. Si ya existe una cuenta asociada al DNI o email: no se crea otra. "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada."
7. Antes de completar el registro, debe aceptar términos de uso y tratamiento de datos.
   - Casilla no marcada por defecto, con enlace a los términos.
   - Se registran fecha, hora y versión de los términos aceptados.
   - Los términos informan la finalidad del tratamiento de datos personales (Ley 25.326).
8. Al completar: "Tu cuenta fue creada correctamente", dirige al login con su email precompletado.
9. Mientras se procesa, el botón permanece deshabilitado; se limitan intentos repetidos desde un mismo origen.
   - Máximo 5 registros por IP por hora y 3 reenvíos de código por hora, con 60 segundos entre reenvíos (RNF-SEG-06).
   - Errores de comunicación: mensaje claro sin detalles técnicos, conservan datos ingresados excepto contraseñas.
   - El registro de cuenta y cada verificación de código se registran como eventos de seguridad (RNF-SEG-09).
