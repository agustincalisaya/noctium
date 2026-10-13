import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { obtenerClaseOrigenHistorial } from "@/server/turnos/turno.publico";
import { profesorPuedeRegistrarIndicacion } from "@/server/historial/historial.publico";
import { ServiceError } from "@/server/shared/service-error";
import { ahora } from "@/server/shared/reloj";

const Contexto = z.object({ sub: z.string(), alumno: z.string(), materia: z.string(), turno: z.string() });
function secreto() {
  if (!process.env.AUTH_SECRET) throw new Error("Falta AUTH_SECRET para el contexto de historial");
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}
function denegar(): never { throw new ServiceError("SIN_PERMISO", "Volvé a abrir el historial desde tu clase para registrar la indicación"); }

async function validarOrigen(usuarioId: string, alumnoId: string, materiaId: string, turnoId: string, db: Prisma.TransactionClient) {
  const profesor = await obtenerOpcionProfesorDeUsuario(usuarioId, db);
  const origen = await obtenerClaseOrigenHistorial(turnoId, alumnoId, db);
  if (!profesor || !origen || origen.profesor_id !== profesor.id || origen.materia_id !== materiaId) denegar();
  // Una inscripción histórica en esa clase también admite navegación. Si no
  // existe, el alumno debe figurar en su registro dictado vigente.
  if (!origen.alumno_inscripto) {
    const registro = await db.claseDictada.findFirst({ where: {
      turnoId, profesorId: profesor.id, materiaId, anuladaEl: null, anulacion: { is: null },
      alumnos: { some: { alumnoId } },
    }, select: { idClaseDictada: true } });
    if (!registro) denegar();
  }
  return profesor.id;
}

/** Solo la navegación del servidor emite este contexto; vence en dos horas. */
export async function emitirContextoIndicacion(usuarioId: string, alumnoId: string, materiaId: string, turnoId: string, db: Prisma.TransactionClient = prisma) {
  await validarOrigen(usuarioId, alumnoId, materiaId, turnoId, db);
  const instante = Math.floor(ahora().getTime() / 1000);
  return new SignJWT({ alumno: alumnoId, materia: materiaId, turno: turnoId })
    .setProtectedHeader({ alg: "HS256" }).setSubject(usuarioId).setAudience("historial:indicacion")
    .setIssuedAt(instante).setExpirationTime(instante + 7200).sign(secreto());
}

export async function validarContextoIndicacion(token: string | undefined, usuarioId: string, alumnoId: string, materiaId: string, db: Prisma.TransactionClient) {
  if (!token) denegar();
  let contexto: z.infer<typeof Contexto>;
  try {
    const { payload } = await jwtVerify(token, secreto(), { algorithms: ["HS256"], audience: "historial:indicacion", currentDate: ahora() });
    contexto = Contexto.parse(payload);
  } catch { denegar(); }
  if (contexto.sub !== usuarioId || contexto.alumno !== alumnoId || contexto.materia !== materiaId) denegar();
  const profesorId = await validarOrigen(usuarioId, alumnoId, materiaId, contexto.turno, db);
  if (!(await profesorPuedeRegistrarIndicacion(profesorId, alumnoId, materiaId, db))) denegar();
}
