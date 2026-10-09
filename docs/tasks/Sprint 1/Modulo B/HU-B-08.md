# TASK: HU-B08 — Autorregistro del alumno

**Módulo:** B (Alumno)
**Sprint:** 1
**Contrato de referencia:** `docs/spec_modulo_B.md` §2.6 · reglas §3.6-3.8 · eventos §4
**RBAC:** Ninguno — superficie pública, sin sesión (accesible desde "Crear cuenta" del login, sin `withPermission`).
**Schema:** Migración requerida. Modelo nuevo `SolicitudAutorregistro` (no existe — ver DECISIÓN RESUELTA 1 abajo). `CodigoVerificacion`, `IntentoRegistro`, `ParametroSistema` (con los parámetros operativos) ya existen, migrados, sin uso en `src/`.

---

## 0. Relevamiento previo a implementación (Claude Code)

Ya se hizo un relevamiento extenso en dos rondas previas a esta task (confirmado en disco, no repetir desde cero):

- `crearCuentaConCredenciales()` no existe en ningún lugar del repo. No hay ninguna capa de escritura de `Usuario` en código de aplicación — solo `verificarCredenciales()` (lectura, login) en `src/server/sesion/autenticacion.service.ts`. El único `prisma.usuario.upsert()` real está en `prisma/seed.ts`, fuera de cualquier capa de servicio.
- `hashPassword()` / `comparePassword()` ya existen en `src/lib/password.ts` (bcrypt, costo 12). `hashPassword()` está sin usar todavía (comentario explícito "HU-B-08 c2" en el archivo).
- `IntentoLoginFallido` es el patrón de referencia real en uso para rate limiting síncrono (no `IntentoAccesoFallido`, como decía la spec vieja — desvío ya documentado).
- `IntentoRegistro` y `CodigoVerificacion` existen en el schema, migrados, sin ningún uso en `src/` todavía. `CodigoVerificacion` (`schema.prisma:239-251`): `idCodigo`, `alumnoId` (FK obligatoria), `codigoHash`, `expiraEn`, `intentos`, `invalidadoEn`, `creadoEn` — sin campo para un password hash pendiente.
- No existe un modelo `AceptacionTerminos` separado: lo que la spec describe así está aplanado en `Alumno.terminosAceptadosEn` / `Alumno.versionTerminosAceptada` (columnas escalares ya existentes).
- Ruta real confirmada: `src/app/(auth)/registro/page.tsx` — el botón "Crear cuenta" del login (`src/app/(auth)/login/login-form.tsx:151`) ya apunta ahí. Contenido actual: stub de un solo `<div>Registro - en construcción</div>`, sin form ni componente cliente. Es la carpeta real (no `app/(public)/autorregistro/` como decía la spec original — desvío ya documentado).
- No existe ningún mecanismo de envío de email en el repo (sin `nodemailer`, sin proveedor, sin cola). Los únicos hits de "notificación" son copy de UI sin funcionalidad (`home/page.tsx`, `Navbar.tsx`).
- `politicaPasswordSchema` no existe en absoluto. El único schema de password existente es el de login (`sesion.schema.ts:5`, `min(1)` — no es una política de fortaleza).
- `src/proxy.ts` (no hay `middleware.ts`) ya excluye `/login` y `/registro` de su matcher — no hace falta tocarlo para esta HU.
- `ParametroSistema` ya tiene sembrados (sin código que los lea todavía): `password_longitud_minima: "8"`, `registro_max_por_ip_hora: "5"`, `reenvio_codigo_max_por_hora: "3"`, `reenvio_codigo_espera_segundos: "60"`, `codigo_verificacion_expiracion_minutos: "10"`, `codigo_verificacion_max_intentos: "5"`, `terminos_version_vigente: "1.0"`.
- El seed (`prisma/seed.ts:16-19`) ya documenta que los alumnos 07-15 están preparados para probar la rama de vinculación por código, variando si tienen o no email verificable.

**DECISIONES RESUELTAS en esta ronda (no relevar de nuevo, documentar y aplicar):**

1. **Modelo para el password_hash pendiente (rama b):** se crea un modelo **nuevo**, `SolicitudAutorregistro`. NO se extiende `CodigoVerificacion` — queda genérico y reusable a futuro para otros flujos de OTP (ej. recuperación de contraseña). Debe tener como mínimo: `alumnoId` (FK a `Alumno`), `passwordHash`, relación 1:1 con su `CodigoVerificacion` correspondiente, y un campo de estado (evaluar si alcanza con `invalidadoEn` de `CodigoVerificacion` + `confirmadaEn` propio, o si conviene un enum explícito). **Usar `cuid()` para su id, no `uuid()`** — mismo criterio que el resto del schema real (desvío de la spec ya documentado en HU-B-03/HU-B-06, aplicar el mismo patrón a `solicitud_id` en `VerificarCodigoAutorregistroSchema`).
2. **Firma de `crearCuentaConCredenciales()`:** recibe `passwordHash` ya calculado, no `password` en texto plano. El hasheo (`hashPassword()` de `src/lib/password.ts`) lo hace Módulo B, antes de llamar a esta función — tanto en la rama (a) directa como al construir el `SolicitudAutorregistro` en la rama (b). Firma: `crearCuentaConCredenciales(input: { email: string; passwordHash: string; rol: RolUsuario }, db: Prisma.TransactionClient = prisma): Promise<{ id: string }>`. Ubicación: **`src/server/usuarios/usuario.service.ts`** (no `lib/services/sesion/cuenta.service.ts` como decía la spec — desvío a documentar, mismo criterio de Regla N.° 4 corregida en `RULES.md`). Solo crea el `Usuario` y devuelve su `id` — el `UPDATE` de `Alumno.usuarioId` lo hace el service de Módulo B, en la misma transacción (Regla N.° 3: Módulo A no toca tablas de `Alumno`).
3. **Envío del código OTP:** se crea una interfaz simple (`EmailSender` / `enviarEmail()`) en `src/lib/email.ts`, con una implementación de desarrollo que loguea el código por consola en vez de mandar un email real. No es la solución final de infraestructura — solo destraba la HU. No se encontró ningún patrón de abstracción similar preexistente en el repo.
4. **`politicaPasswordSchema`** se implementa como factory function, mismo patrón que `crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax)`, parametrizada por `password_longitud_minima` (`ParametroSistema`, sembrado en `"8"`): mínimo N caracteres, 1 mayúscula, 1 minúscula, 1 número. Ubicación: `src/server/shared/password.schema.ts` (mismo nivel que otras reglas transversales tipo `contacto.schema.ts`/`fecha.schema.ts` — a confirmar/corregir si el repo real tiene otra carpeta ya establecida para schemas compartidos).

**Puntos que SÍ debe relevar Claude Code antes de tocar código (reportar y esperar confirmación explícita):**

- **Archivos nuevos a crear** (ruta exacta, uno por uno) y **archivos existentes a modificar** (ruta exacta + qué cambia), incluyendo la migración de Prisma para `SolicitudAutorregistro`.
- **Ubicación de la lógica de negocio de autorregistro:** la spec nombra `lib/services/alumnos/autorregistro.service.ts` como archivo separado, pero la Regla N.° 11 real del repo indica un único archivo `<modulo>.service.ts` por módulo (`src/server/alumnos/alumno.service.ts`, ya en uso por HU-B-01/02/03/06). Confirmar si esta HU agrega sus funciones (`iniciarAutorregistro`, `confirmarCodigoAutorregistro`, reenvío) a `alumno.service.ts` existente, o si se justifica un archivo separado dentro de la misma carpeta `src/server/alumnos/` — no asumir ninguna de las dos, preguntar.
- **Mecanismo de eventos de dominio real:** la spec pide emitir `alumno:autorregistro_completado`, `alumno:codigo_verificacion_generado`, `alumno:autorregistro_derivado_mesa_entrada`. `RULES.md` documenta que la versión con event bus asíncrono fue reemplazada por columnas de auditoría + escritura directa. Confirmar cuál es el mecanismo real ya usado por HU-B-01/03/06 para "emitir eventos" en este repo (¿tabla de auditoría propia? ¿ninguno, y el criterio de aceptación 5/9 de la spec se satisface de otra forma?) antes de implementar la sección 4.5 de esta task — no inventar un event bus si no existe precedente.
- Confirmar el campo de estado exacto de `SolicitudAutorregistro` (punto abierto en la Decisión Resuelta 1) contra lo que sea más consistente con el resto del schema.
- Confirmar carpeta real para schemas compartidos (Decisión Resuelta 4) si `src/server/shared/` no es la convención ya usada.
- Cualquier otra ambigüedad real encontrada en el código, no resuelta acá — reportar, no asumir.

No se procede a la sección 4 en adelante hasta recibir el OK explícito sobre este relevamiento.

---

## 1. Nota de alcance

El contrato técnico real difiere de la prosa original de la spec en varios puntos ya identificados y documentados arriba como desvíos (rutas, nombre de tabla de rate limiting, ubicación de `crearCuentaConCredenciales()`, tipo de id). Se implementa contra la convención real del repo, no contra la spec literal donde difieran — cualquier nuevo desvío encontrado durante la implementación se documenta en `spec_modulo_B.md` como nota de sincronización, no se corrige en silencio (`docs/sdd-metodologia.md`, paso 6).

Esta HU depende de que Módulo A exponga `crearCuentaConCredenciales()` — función que no existía y que esta misma HU introduce en Módulo A con autorización explícita del dueño de ese módulo (su módulo está cerrado; la función se implementa lo más mínima y enfocada posible, sin tocar ni refactorizar nada más de Módulo A).

**Fuera de alcance de esta task (explícito):**
- Recuperación de contraseña del autorregistro (cubierto por `spec_modulo_A.md`, fuera de alcance del Sprint).
- Implementación de un proveedor real de envío de email/SMS — solo la interfaz + stub de consola (Decisión Resuelta 3).
- Verificación de email en la ficha creada por Mesa de Entrada fuera del flujo de autorregistro (HU-B-02 ya lo excluye explícitamente).

---

## 2. Historia de Usuario

**Como** alumno
**Necesito** crear mi cuenta desde un formulario público
**Para** acceder al sistema sin depender del personal de mesa de entrada

**SP estimado:** 3

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_B.md` §2.6. Incluye:
- Migración Prisma: modelo `SolicitudAutorregistro`.
- Capa de servicios (`src/server/alumnos/...` — ubicación exacta a confirmar en relevamiento).
- Función nueva de Módulo A: `crearCuentaConCredenciales()` en `src/server/usuarios/usuario.service.ts`.
- Route Handlers: `POST /api/auth/autorregistro`, `POST /api/auth/autorregistro/verificar-codigo`, `POST /api/auth/autorregistro/reenviar-codigo`.
- Server Actions equivalentes en `src/app/(auth)/registro/actions.ts`.
- Schemas Zod: `AutorregistroAlumnoSchema`, `VerificarCodigoAutorregistroSchema`, `politicaPasswordSchema`.
- Interfaz `EmailSender` + implementación dev de consola.
- UI: formulario completo de `/registro` (reemplaza el stub actual), incluyendo indicador en vivo de requisitos de contraseña cumplidos, checkbox de términos, y pantalla/paso de verificación de código para la rama (b).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Cualquier cambio en `src/server/sesion/` más allá de lo estrictamente necesario para exponer `crearCuentaConCredenciales()`.
- Proveedor real de email.
- Panel o vista de Mesa de Entrada para atender las derivaciones de la rama (d) — esta HU solo genera el mensaje al alumno, no gestiona el caso del lado de Mesa de Entrada.

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/shared/password.schema.ts` (o la carpeta real de schemas compartidos, a confirmar en relevamiento)

```typescript
export function politicaPasswordSchema(passwordLongitudMinima: number) {
  return z
    .string()
    .min(passwordLongitudMinima, `La contraseña debe tener al menos ${passwordLongitudMinima} caracteres`)
    .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
    .regex(/[a-z]/, "La contraseña debe tener al menos una minúscula")
    .regex(/[0-9]/, "La contraseña debe tener al menos un número");
}
```

**Archivo:** `src/server/alumnos/alumno.schema.ts` (archivo ya existente)

```typescript
export const AutorregistroAlumnoSchema = IdentidadAlumnoSchema
  .merge(ContactoAlumnoSchema.pick({ telefono: true }))
  .extend({
    email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254),
    password: politicaPasswordSchema(passwordLongitudMinima), // valor leído de ParametroSistema
    confirmacion_password: z.string(),
    acepta_terminos: z.literal(true, { errorMap: () => ({ message: "Debés aceptar los términos de uso y tratamiento de datos" }) }),
  })
  .refine((d) => d.password === d.confirmacion_password, {
    message: "Las contraseñas no coinciden", path: ["confirmacion_password"],
  })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0].toLowerCase()), {
    message: "La contraseña no puede contener tu email", path: ["password"],
  })
  .refine((d) => !d.password.includes(d.dni), {
    message: "La contraseña no puede contener tu DNI", path: ["password"],
  });
export type AutorregistroAlumnoInput = z.infer<typeof AutorregistroAlumnoSchema>;

export const VerificarCodigoAutorregistroSchema = z.object({
  solicitud_id: z.string().cuid(), // no .uuid() — desvío de spec ya documentado
  codigo: z.string().length(6).regex(/^\d{6}$/),
});
```

### 4.2. Servicio — `iniciarAutorregistro`

**Archivo:** ubicación a confirmar en relevamiento (sección 0).
**Función:** `iniciarAutorregistro(input: AutorregistroAlumnoInput, ip: string): Promise<ResultadoAutorregistro>`

Comportamiento exigido, dentro de una única `prisma.$transaction` donde corresponda (Regla N.° 4/7):
1. Rate limit por IP vía `IntentoRegistro`: máximo `registro_max_por_ip_hora` (5) por hora. Si excede: `429` (o el código que ya use el patrón de `IntentoLoginFallido`), mensaje claro sin detalles técnicos.
2. Si ya existe `Usuario` con ese `email` → `409 CUENTA_YA_EXISTE`, mensaje genérico: "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada."
3. Buscar `Alumno` por `dni`:
   - **(a) No existe ninguna ficha:** hashear password (`hashPassword()`), crear `Alumno` + `Usuario` (rol `ALUMNO`, vía `crearCuentaConCredenciales()` de Módulo A) en una única `prisma.$transaction`. Responde éxito directo, sin paso de verificación de código.
   - **(b) Existe ficha con `usuarioId: null`:** no se duplica. Se inicia verificación por código contra `Alumno.email` **ya registrado** (dato de contacto cargado por Mesa de Entrada) — nunca contra el email recién tipeado en el formulario. Se hashea el password y se persiste un `SolicitudAutorregistro` con ese `passwordHash`, pendiente de confirmación, junto con su `CodigoVerificacion` asociado (6 dígitos, `crypto.randomInt()`, solo se guarda `HMAC-SHA256(codigo, CODIGO_OTP_SECRET)`).
   - **(c) Existe ficha con `usuarioId` ya asignado:** mismo `409 CUENTA_YA_EXISTE` que el paso 2, no distinguible desde el cliente.
   - **(d) Existe ficha sin cuenta pero sin email verificable, o el email no coincide con el de contacto:** deriva a mesa de entrada, `200 OK`: "No pudimos completar el registro en línea. Acercate a mesa de entrada para vincular tu cuenta." (no es un error).
4. Registrar aceptación de términos (`Alumno.terminosAceptadosEn` / `Alumno.versionTerminosAceptada`) — al crear la cuenta (rama a) o al confirmar el código (rama b), nunca antes.
5. Emitir el evento correspondiente — mecanismo real a confirmar en relevamiento (ver sección 0).

**Errores de servicio a definir:** `CUENTA_YA_EXISTE` (409), `RATE_LIMIT_EXCEDIDO` (429), `VALIDATION_ERROR` (400).

### 4.3. Servicio — `confirmarCodigoAutorregistro`

**Función:** `confirmarCodigoAutorregistro(solicitudId: string, codigo: string): Promise<ResultadoConfirmacion>`

1. Recalcular `HMAC-SHA256` del código recibido, comparar con `crypto.timingSafeEqual` (nunca `===`) contra el hash almacenado.
2. Precondiciones: código no vencido (`expiraEn > now`), intentos restantes `> 0` (decrementar en cada fallo). Si falla cualquiera: error específico, sin revelar cuál parte falló.
3. Éxito, dentro de `prisma.$transaction`: crear `Usuario` (vía `crearCuentaConCredenciales()`, usando el `passwordHash` ya guardado en `SolicitudAutorregistro`), vincular `Alumno.usuarioId`, marcar `SolicitudAutorregistro` como consumida, registrar aceptación de términos.
4. Emitir `alumno:autorregistro_completado` (`via: "VINCULACION_OTP"`) — mecanismo real a confirmar.

**Errores de servicio a definir:** `CODIGO_INVALIDO` (422), `CODIGO_VENCIDO` (422), `INTENTOS_AGOTADOS` (422), `SOLICITUD_NO_ENCONTRADA` (404).

### 4.4. Servicio — reenvío de código

- Invalida el código anterior (nuevo hash sobrescribe, el viejo deja de ser válido de inmediato).
- Rate limit: máximo `reenvio_codigo_max_por_hora` (3) por hora, mínimo `reenvio_codigo_espera_segundos` (60) entre reenvíos.
- Respuesta con email de destino siempre enmascarado (`j***@gmail.com`), nunca completo.

### 4.5. Route Handlers

**Archivos:**
- `src/app/api/auth/autorregistro/route.ts` — `POST`, sin `withPermission` (superficie pública).
- `src/app/api/auth/autorregistro/verificar-codigo/route.ts` — `POST`, sin `withPermission`.
- `src/app/api/auth/autorregistro/reenviar-codigo/route.ts` — `POST`, sin `withPermission`.

### 4.6. Server Actions

**Archivo:** `src/app/(auth)/registro/actions.ts`
**Funciones:** `iniciarAutorregistro()`, `confirmarCodigoAutorregistro()`, `reenviarCodigoAutorregistro()` — wrappers delgados sobre los servicios.

### 4.7. Función nueva de Módulo A

**Archivo:** `src/server/usuarios/usuario.service.ts`
**Función:** `crearCuentaConCredenciales(input: { email: string; passwordHash: string; rol: RolUsuario }, db: Prisma.TransactionClient = prisma): Promise<{ id: string }>` — ver Decisión Resuelta 2. Mínima y enfocada, sin tocar ni refactorizar nada más de Módulo A.

### 4.8. Eventos de dominio

Mecanismo real a confirmar en relevamiento antes de implementar esta sección (ver sección 0). Si el repo ya tiene un precedente distinto a un event bus (ej. columnas de auditoría directas), seguir ese mismo patrón para:

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `alumno:autorregistro_completado` | Rama (a) directa o confirmación de código (b) | `alumno_id, usuario_id, via: "DIRECTO" \| "VINCULACION_OTP"` |
| `alumno:codigo_verificacion_generado` | Envío/reenvío de código | `alumno_id, solicitud_id, ip` — nunca el código |
| `alumno:autorregistro_derivado_mesa_entrada` | Rama (d) | `dni, ip` — nunca detalle de qué no coincidió |

**Ningún dato sensible en logs, eventos ni auditoría:** `password`, `passwordHash`, el código OTP en claro y su HMAC no se incluyen jamás.

---

## 5. Frontend

- `src/app/(auth)/registro/page.tsx` (reemplaza el stub actual) — formulario completo: Nombre, Apellido, DNI, Fecha de nacimiento, Email, Teléfono (opcional), Contraseña, Confirmación de contraseña, checkbox de términos (no marcado por defecto, con enlace a términos).
- Indicador en vivo de qué requisitos de la política de contraseña ya se cumplen mientras se escribe.
- Botón deshabilitado mientras se procesa; conserva los datos ingresados excepto contraseñas ante error de comunicación.
- Paso/pantalla de verificación de código (rama b): input de 6 dígitos, email de destino enmascarado, botón de reenvío respetando el intervalo de espera.
- Mensaje de éxito ("Tu cuenta fue creada correctamente") → redirige a `/login` con el email precompletado.
- Seguir `docs/DESIGN.md` (tokens de shadcn/ui + Tailwind).

**Fuera de alcance de frontend:** cualquier vista del lado de Mesa de Entrada para atender la rama (d).

---

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios
- `iniciarAutorregistro` rama (a): crea Alumno + Usuario en una sola transacción, responde éxito directo.
- `iniciarAutorregistro` rama (b): no duplica ficha, crea `SolicitudAutorregistro` con `passwordHash`, dispara verificación contra el email de contacto ya registrado (nunca el tipeado en el form).
- `iniciarAutorregistro` rama (c): `409 CUENTA_YA_EXISTE`, no distinguible de rama email-ya-existe.
- `iniciarAutorregistro` rama (d): deriva a mesa de entrada sin revelar qué dato no coincidió.
- `confirmarCodigoAutorregistro`: éxito, código vencido, intentos agotados, comparación en tiempo constante (spy sobre `timingSafeEqual`).
- Rate limiting: 6to registro desde la misma IP en la hora rechazado; reenvío antes de los 60 segundos rechazado.
- `politicaPasswordSchema`: casos límite (sin mayúscula, sin número, contiene el email, contiene el DNI, no coincide con confirmación).
- Emisión de evento después del `COMMIT`, no dentro de la transacción (mock/spy).

### Nivel 2 — Postman
- Registro exitoso rama (a) → `200/201`, cuerpo conforme spec.
- Registro rama (b) → inicia verificación, respuesta sin revelar el email completo.
- Verificación de código exitosa → cuenta creada y vinculada.
- Cada error esperado (`CUENTA_YA_EXISTE`, `CODIGO_INVALIDO`, `CODIGO_VENCIDO`, `INTENTOS_AGOTADOS`, rate limit) → código correcto.

### Nivel 3 — BD / TablePlus
- Verificar que `SolicitudAutorregistro` se marca consumida tras confirmación exitosa.
- Verificar que el código OTP nunca queda en texto plano en ninguna tabla.
- Verificar `Alumno.usuarioId`, `terminosAceptadosEn`, `versionTerminosAceptada` tras cada rama.
- Verificar mecanismo de auditoría/evento real (el que confirme el relevamiento) para los 3 eventos de esta HU.

**Evidencia esperada:** Postman + SQL + capturas de UI (formulario, indicador de requisitos de contraseña, paso de verificación de código).

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar.
- [x] Migración de `SolicitudAutorregistro` aplicada.
- [x] Service, Route Handlers y Server Actions implementados, sin lógica de negocio fuera de la capa de servicios.
- [x] `crearCuentaConCredenciales()` implementada en Módulo A, mínima y enfocada, sin tocar nada más de ese módulo.
- [x] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [x] Contraseña nunca en texto plano ni en logs/eventos/auditoría — verificado (sección 8).
- [x] Comparación de código OTP en tiempo constante — `crypto.timingSafeEqual`, probado real (no mockeado) en Nivel 1.
- [x] Rate limiting de registro y de reenvío de código funcionando — verificado real en Nivel 2.
- [x] Frontend funcional: formulario, indicador de requisitos, paso de verificación de código.
- [x] Ningún `DELETE` físico en ningún punto del código.
- [x] Tests de los 3 niveles documentados con evidencia — ver sección 8.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Evidencia de testing (2026-09-24)

### 8.1. Correcciones encontradas durante el testing (no antes)

1. **`confirmarCodigoAutorregistro()` trataba un código invalidado como `CODIGO_INVALIDO`** en vez de `SOLICITUD_NO_ENCONTRADA` — inconsistente con `reenviarCodigoAutorregistro()` y con el criterio de test pedido explícitamente ("tratada como no encontrada"). Corregido: ambas funciones ahora comparten el mismo criterio.
2. **`construirAutorregistroAlumnoSchema` nunca tuvo `.strict()`** — aceptaba y descartaba en silencio claves desconocidas. Corregido, agregando `.strict()` (mismo criterio que `construirModificarAlumnoSchema` de HU-B-06).

### 8.2. Nivel 1 — Unitarios (vitest, instalado y corrido de verdad)

`vitest`/`vite`/`jsdom` no estaban instalados pese a que ya existía `vitest.config.mjs` y 13 archivos `.test.ts` — confirmado con el propio comentario de `profesor.service.test.ts:5`: *"Código escrito, no ejecutado — sin test runner instalado"*. Se instalaron de verdad (`devDependencies` + `"test": "vitest run"` en `package.json`) y se corrieron **los 13 tests preexistentes por primera vez**: **136 tests, 0 fallos** — el código que se asumía correcto sin haber corrido nunca resultó serlo.

4 archivos nuevos para HU-B-08 (`autorregistro.service.test.ts`, `alumno.schema.autorregistro.test.ts`, `password.schema.test.ts`, `usuario.service.test.ts`), cubriendo las 4 ramas de `iniciarAutorregistro()` (incluido P2002 real distinguiendo DNI/email por `meta.target`), rate limit de `IntentoRegistro`, `confirmarCodigoAutorregistro()` con **HMAC-SHA256 y `timingSafeEqual` reales** (no mockeados, incluido el caso de buffers de distinta longitud), `reenviarCodigoAutorregistro()` completo, y verificación de que ningún evento/email contiene datos sensibles.

**Resultado final:**
```
 Test Files  17 passed (17)
      Tests  194 passed (194)
```

### 8.3. Nivel 2 — curl real contra `npm run dev` + Postgres real (2026-09-24)

Los 3 endpoints, todos los casos de la sección 6, con status HTTP real:

| Endpoint | Caso | Status real |
|---|---|---|
| `POST /autorregistro` | Rama (a) exitosa | `200 DIRECTO` |
| | Rama (b) inicia verificación | `200`, email enmascarado |
| | Rama (c) cuenta ya vinculada | `409 CUENTA_YA_EXISTE` |
| | Rama (d) email no coincide | `200 DERIVADO_MESA_ENTRADA` |
| | Email ya usado por otra cuenta | `409 CUENTA_YA_EXISTE` (mismo mensaje que rama c) |
| | Términos no aceptados | `400 VALIDACION` |
| | 6to intento en la hora, misma IP | `429 RATE_LIMIT_EXCEDIDO` |
| `POST /verificar-codigo` | Código incorrecto | `422 CODIGO_INVALIDO` |
| | Body inválido | `400 VALIDACION` |
| | Éxito (código real leído del log de consola) | `200`, cuenta vinculada |
| | Solicitud confirmada / inexistente | `404 SOLICITUD_NO_ENCONTRADA` |
| | Código vencido (forzado con `UPDATE` real) | `422 CODIGO_VENCIDO` |
| | 6to intento tras agotar los 5 | `422 INTENTOS_AGOTADOS` |
| `POST /reenviar-codigo` | Antes de los 60s | `429 REENVIO_MUY_PRONTO` |
| | 3 reenvíos válidos | `200` los 3 |
| | 4to reenvío en la hora | `429 RATE_LIMIT_EXCEDIDO` |
| | Solicitud confirmada / inexistente | `404 SOLICITUD_NO_ENCONTRADA` |

Verificado en vivo (no después): `CodigoVerificacion` queda en una sola fila por reenvío (se sobrescribe), `ReenvioCodigo` acumula exactamente 3 filas (`COUNT` real). Base reseedeada y alumnos sintéticos de prueba eliminados al terminar.

### 8.4. Nivel 3 — BD (corrido real)

Sin precedente en el repo de versionar scripts de evidencia por separado (confirmado: ninguna task anterior de Módulo B dejó un `.sql`/colección/captura fuera de su propio `.md`) — mismo criterio acá, el script queda documentado inline, no como archivo aparte.

```sql
-- HU-B-08 — Nivel 3 (BD). Verificado en vivo el 2026-09-24 durante el
-- Nivel 2 (ver sección 8.3 para la evidencia puntual). Reusar este script
-- para re-verificar en cualquier momento — no depende de filas específicas
-- que ya no existan (usa las más recientes de cada tipo).

-- 1. SolicitudAutorregistro.confirmadaEn se marca tras confirmación exitosa.
SELECT "idSolicitud", "confirmadaEn" IS NOT NULL AS confirmada, "creadaEn"
FROM solicitudes_autorregistro
ORDER BY "creadaEn" DESC
LIMIT 5;

-- 2. El código OTP nunca queda en texto plano — codigoHash siempre debe ser
--    un hex de 64 caracteres (SHA-256), nunca 6 dígitos.
SELECT "idCodigo", "codigoHash", length("codigoHash") AS largo_hash,
       ("codigoHash" ~ '^[0-9]{6}$') AS ES_TEXTO_PLANO_si_true_HAY_UN_PROBLEMA
FROM codigos_verificacion
ORDER BY "creadoEn" DESC
LIMIT 5;

-- 3. Alumno.usuarioId / terminosAceptadosEn / versionTerminosAceptada
--    quedan seteados tras autorregistro (rama a o b confirmada).
SELECT a."idAlumno", a."dniAlumno", a."usuarioId" IS NOT NULL AS vinculado,
       a."terminosAceptadosEn" IS NOT NULL AS terminos_aceptados,
       a."versionTerminosAceptada", u."emailUsuario", u."rolUsuario"
FROM alumnos a
LEFT JOIN usuarios u ON u."idUsuario" = a."usuarioId"
WHERE a."usuarioId" IS NOT NULL
ORDER BY a."createdAtAlumno" DESC
LIMIT 10;

-- 4. EventoSeguridad tiene las filas esperadas para los 3 tipos nuevos,
--    con el payload correcto (usuarioId/emailEvento/ipEvento — nunca
--    alumno_id/solicitud_id/dni/via, esas columnas no existen).
SELECT "tipoEvento", "usuarioId" IS NOT NULL AS tiene_usuario,
       "emailEvento", "ipEvento", "creadoEnEvento"
FROM eventos_seguridad
WHERE "tipoEvento" IN ('REGISTRO_CUENTA', 'CODIGO_VERIFICACION_GENERADO', 'AUTORREGISTRO_DERIVADO_MESA_ENTRADA')
ORDER BY "creadoEnEvento" DESC
LIMIT 15;

-- 5. ReenvioCodigo acumula una fila por reenvío real, sin sobrescribir
--    (a diferencia de CodigoVerificacion, que sí se sobrescribe en el
--    mismo idCodigo). Si count > 1 fila por codigoId, confirma el diseño.
SELECT "codigoId", COUNT(*) AS reenvios_acumulados
FROM reenvios_codigo
GROUP BY "codigoId"
ORDER BY reenvios_acumulados DESC
LIMIT 10;

-- 6. Ningún dato sensible: confirma que ninguna fila de eventos_seguridad
--    contiene algo que luzca como un código de 6 dígitos o un hash bcrypt.
SELECT COUNT(*) AS filas_sospechosas
FROM eventos_seguridad
WHERE "emailEvento" ~ '^\d{6}$' OR "emailEvento" LIKE '$2%';
```

**Resultado de la corrida real:**
- `SolicitudAutorregistro.confirmadaEn`: `t` en la solicitud confirmada, `f` en las demás — correcto.
- `codigoHash`: 64 caracteres hex en el 100% de las filas, cero coincidencias con el patrón de un código de 6 dígitos en claro.
- `EventoSeguridad`: confirmado el mapeo exacto — `REGISTRO_CUENTA` con `usuarioId` seteado, `CODIGO_VERIFICACION_GENERADO` con `usuarioId` nulo y el email de contacto, `AUTORREGISTRO_DERIVADO_MESA_ENTRADA` con ambos nulos.
- `ReenvioCodigo`: 3 filas acumuladas para el mismo `codigoId`, sin sobrescribir.
- Consulta de datos sensibles en `EventoSeguridad.emailEvento` (patrón de 6 dígitos o de hash bcrypt): 0 filas.

**Nota de la propia corrida**: la consulta genérica de "últimos 10 alumnos vinculados por fecha de creación" trajo cuentas sembradas por el seed (creadas antes que las de esta HU, con `terminos_aceptados = false` porque no pasaron por autorregistro) — es el comportamiento esperado del seed, no un hallazgo. La verificación puntual de `Alumno.terminosAceptadosEn`/`versionTerminosAceptada` para las fichas que sí pasaron por autorregistro (Tomás, Valentina) se hizo con consultas filtradas por DNI durante el Nivel 2, con resultado correcto en ambos casos.

Ningún criterio quedó bloqueado — los 3 niveles se verificaron con evidencia real.
