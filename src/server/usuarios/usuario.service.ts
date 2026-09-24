import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";

/**
 * Resuelve el nombre a mostrar en el Navbar (HU-A-03 criterio 1). `Usuario`
 * no tiene campo de nombre propio (el JWT solo lleva `id`/`rol`, nunca
 * datos personales — HU-A-01 criterio 3). Para ALUMNO/PROFESOR el nombre
 * real vive en la ficha vinculada (`Alumno`/`Profesor`); GERENTE y
 * MESA_ENTRADA no tienen ninguna ficha asociada en el modelo de datos de
 * este sprint, así que caen al email como identificador.
 */
export async function obtenerNombreVisible(usuarioId: string, rol: RolUsuario): Promise<string> {
  if (rol === "ALUMNO") {
    const alumno = await prisma.alumno.findUnique({
      where: { usuarioId },
      select: { nombreAlumno: true, apellidoAlumno: true },
    });
    if (alumno) return `${alumno.nombreAlumno} ${alumno.apellidoAlumno}`;
  }

  if (rol === "PROFESOR") {
    const profesor = await prisma.profesor.findUnique({
      where: { usuarioId },
      select: { nombreProfesor: true, apellidoProfesor: true },
    });
    if (profesor) return `${profesor.nombreProfesor} ${profesor.apellidoProfesor}`;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: usuarioId },
    select: { emailUsuario: true },
  });
  return usuario?.emailUsuario ?? "";
}

/**
 * Crea una cuenta (`Usuario`) con credenciales ya hasheadas (HU-B-08,
 * Decisión Resuelta 2 de `docs/tasks/Sprint 1/HU-B-08.md` §0). Recibe
 * `passwordHash` ya calculado — el hasheo (`hashPassword()` de
 * `src/lib/password.ts`) lo hace el módulo llamante (Alumno, en
 * `autorregistro.service.ts`), nunca esta función.
 *
 * Mínima y enfocada, tal como autoriza la task: solo crea el `Usuario` y
 * devuelve su id. No toca `Alumno` — el `UPDATE` de `Alumno.usuarioId` lo
 * hace el service de Módulo B, en la misma transacción (Regla N.° 3 de
 * `docs/RULES.md`: Módulo A no toca tablas de otro módulo).
 *
 * `db` opcional (default `prisma`) para poder invocarla dentro de la
 * `$transaction` del caller — mismo patrón que `verificarAlumnoActivo()` de
 * `src/server/alumnos/alumno.service.ts`. `activoUsuario` no se setea:
 * `@default(true)` en el schema ya cubre el caso (una cuenta recién creada
 * nace activa).
 */
export async function crearCuentaConCredenciales(
  input: { email: string; passwordHash: string; rol: RolUsuario },
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string }> {
  const usuario = await db.usuario.create({
    data: {
      emailUsuario: input.email,
      passwordHashUsuario: input.passwordHash,
      rolUsuario: input.rol,
    },
    select: { idUsuario: true },
  });
  return { id: usuario.idUsuario };
}
