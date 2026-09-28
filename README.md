# Noctium

Sistema de gestión de un centro de atención académica (turnos de apoyo escolar). Proyecto de la materia Ingeniería de Software.

**Stack:** Next.js 16 (App Router) · TypeScript · PostgreSQL · Prisma · NextAuth v5 (Credentials, sesión JWT) · Tailwind CSS v4 · Docker.

## Puesta en marcha

### Requisitos

- Node.js 20.9 o superior y npm.
- Docker (con Docker Compose) para la base de datos.

### Pasos

1. **Clonar el repositorio**

   ```bash
   git clone <url-del-repo>
   cd noctium
   ```

2. **Configurar las variables de entorno**

   ```bash
   cp .env.example .env
   ```

   Completar los valores en `.env`:

   - `DATABASE_URL`: si usás el `docker-compose.yml` del repo, es
     `postgresql://noctium:noctium@localhost:5433/noctium_dev`
     (usuario `noctium`, contraseña `noctium`, base `noctium_dev`, puerto `5433` del host).
   - `AUTH_SECRET`: generarlo con `npx auth secret` (o cualquier string aleatorio largo).
   - `AUTH_URL`: opcional, solo si se corre con `next start` en vez de `next dev`.

3. **Levantar PostgreSQL con Docker**

   ```bash
   docker compose up -d
   ```

   Levanta el servicio `db` (contenedor `noctium_db`, Postgres 16) con los datos persistidos en el volumen `postgres_data`.

4. **Instalar dependencias**

   ```bash
   npm install
   ```

5. **Aplicar las migraciones**

   ```bash
   npx prisma migrate dev
   ```

   Crea las tablas en la base y genera el cliente de Prisma.

6. **Generar el cliente de Prisma** (solo si hace falta, por ejemplo si `@prisma/client` no encuentra los tipos)

   ```bash
   npx prisma generate
   ```

7. **Cargar la BDD con la seed**
   ```bash
   npx prisma db seed
   ```

8. **Levantar el servidor de desarrollo**

   ```bash
   npx next dev --webpack
   ```

   La app queda en [http://localhost:3000](http://localhost:3000) (redirige a `/login`).

   > **Limitación conocida (Turbopack en desarrollo):** con `npm run dev` / `next dev` a secas
   > (Turbopack), la ruta `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (baja individual de un
   > alumno, HU-C-04) responde 404 porque el servidor de desarrollo no la registra. Con webpack y en
   > el build de producción funciona correctamente. Mientras esta limitación esté vigente, usar
   > `npx next dev --webpack` para desarrollo local.

## Seguridad — HTTPS en despliegue

Toda la superficie de autenticación (`/login`, `/api/auth/*` y cualquier endpoint
que reciba la contraseña) debe servirse exclusivamente sobre HTTPS con TLS 1.2
o superior (RNF-SEG-01). La contraseña nunca viaja en URL/query params.

- **Local (`next dev` con Docker):** no se exige HTTPS — `localhost` está
  exceptuado, y los navegadores modernos tratan `http://localhost` como origen
  seguro a los efectos de cookies `Secure`.
- **Cualquier entorno desplegado:** el servidor/proxy (reverse proxy, load
  balancer, etc.) debe rechazar o redirigir a HTTPS todo tráfico HTTP plano
  hacia estas rutas. Esto es responsabilidad de la configuración de
  infraestructura del entorno de despliegue, no del código de la aplicación.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npx next dev --webpack` | Servidor de desarrollo (recomendado, ver limitación de Turbopack en "Puesta en marcha") |
| `npm run dev` | Servidor de desarrollo con Turbopack (la baja individual de alumnos de un turno da 404) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción (requiere `AUTH_URL`, ver `.env.example`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Chequeo de tipos |

## Interfaz de los listados

Los listados de **Aulas, Materias, Profesores y Alumnos** abren la ficha y el formulario de alta en ventanas modales, sin abandonar el listado. La página y la paginación del listado permanecen en la URL. Las rutas directas de ficha, alta y edición siguen disponibles para enlaces existentes.

- **Aulas y Materias:** al seleccionar una fila se abre su detalle; los botones «Nueva aula» y «Nueva materia» abren el formulario de alta.
- **Profesores:** la ficha muestra identidad, contacto, materias y horarios. Desde ella se puede editar el contacto, asociar materias y registrar horarios en el mismo modal. El alta conserva sus tres pasos.
- **Alumnos:** la ficha muestra contacto, fecha de alta y forma de pago preferida. «Modificar datos», «Editar contacto» y «Editar forma de pago» se abren dentro del modal. «Nuevo alumno» abre el formulario de alta.
- **Calendario:** al seleccionar un evento se abre un resumen del turno con fecha, horario, aula, capacidad y alumnos inscriptos. Desde allí se puede abrir el detalle completo del turno. La grilla permite desplazamiento horizontal y vertical y mantiene visibles los encabezados al desplazarse.

Los modales muestran estados de carga y error. Si un formulario tiene cambios sin guardar, cerrar con la X, Escape, un clic fuera o Cancelar pide confirmar el descarte. Las operaciones mantienen las validaciones y permisos del servidor; el modal solo cambia la interacción de la interfaz. La página directa de **Turnos** conserva su comportamiento.

Antes de abrir un PR contra `develop`, ejecutar las verificaciones locales. El workflow de CI usa Node.js 20 y corre `npm ci`, `npm run lint`, `npx prisma generate` y `npm run build`; las pruebas y el chequeo de tipos se ejecutan localmente con `npm test` y `npx tsc --noEmit`.
