import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { bloquear } from "@/server/shared/bloquear";
import { ahora } from "@/server/shared/reloj";
import { ServiceError } from "@/server/shared/service-error";
import type { Tx } from "@/server/shared/transaccion";
import type { RegistrarObservacionClaseInput } from "./observacion-clase.schema";

const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para registrar o consultar esta clase",
  CLASE_NO_REGISTRADA: "El turno todavía no tiene una clase dictada registrada",
} as const;

type UsuarioHistorial = { id: string; rol: RolUsuario };

/** Registra la única observación de una clase vigente dentro de la transacción del llamador. */
export async function registrarObservacionClase(
  tx: Tx,
  turnoId: string,
  input: RegistrarObservacionClaseInput,
  usuario: UsuarioHistorial,
) {
  await bloquear(tx, { clases: [turnoId] });
  const clase = await tx.claseDictada.findFirst({
    where: { turnoId, anuladaEl: null },
    select: { idClaseDictada: true, profesorId: true },
  });
  if (!clase) throw new ServiceError("CLASE_NO_REGISTRADA", MENSAJES.CLASE_NO_REGISTRADA);

  if (usuario.rol !== "MESA_ENTRADA" && usuario.rol !== "PROFESOR") {
    throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
  }
  if (usuario.rol === "PROFESOR") {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, tx);
    if (!profesor || profesor.id !== clase.profesorId) {
      throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
    }
  }

  const id = randomUUID();
  const registradaEn = ahora();
  let observacion: { createdAtObservacion: Date };
  try {
    observacion = await tx.observacionClase.create({
      data: {
        idObservacionClase: id,
        claseDictadaId: clase.idClaseDictada,
        temasVistos: input.temas_vistos,
        observacionesInternas: input.observaciones_internas?.trim() || null,
        createdAtObservacion: registradaEn,
        creadoPorUsuarioId: usuario.id,
      },
      select: { createdAtObservacion: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorDeDominio("errores.observaciones.yaRegistradas");
    }
    throw error;
  }

  const registradaPor = await obtenerEmailDeUsuario(usuario.id);
  return {
    id,
    clase_dictada_id: clase.idClaseDictada,
    temas_vistos: input.temas_vistos,
    observaciones_internas: input.observaciones_internas?.trim() || null,
    registrada_en: observacion.createdAtObservacion.toISOString(),
    registrada_por: registradaPor,
  };
}

/** Datos de observación que deben persistir desde un registro de clase dictada. */
export type ObservacionClaseEnHistorial = {
  id: string;
  clase_dictada_id: string;
  temas_vistos: string;
  observaciones_internas?: string | null;
  registrada_en: string;
  registrada_por: string | null;
};

/** Lee la observación vigente con la misma regla de propiedad usada por E-01. */
export async function leerObservacionDeClase(
  idClaseDictada: string,
  usuario: UsuarioHistorial,
  db: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<ObservacionClaseEnHistorial | null> {
  const observacion = await db.observacionClase.findUnique({
    where: { claseDictadaId: idClaseDictada },
    select: {
      idObservacionClase: true,
      temasVistos: true,
      observacionesInternas: true,
      createdAtObservacion: true,
      creadoPorUsuarioId: true,
      clase: { select: { profesorId: true, anuladaEl: true } },
    },
  });
  if (!observacion || observacion.clase.anuladaEl) return null;

  const lecturaInterna = usuario.rol === "MESA_ENTRADA" || usuario.rol === "GERENTE"
    || (usuario.rol === "PROFESOR" && (await obtenerOpcionProfesorDeUsuario(usuario.id, db))?.id === observacion.clase.profesorId);
  const registradaPor = observacion.creadoPorUsuarioId
    ? await obtenerEmailDeUsuario(observacion.creadoPorUsuarioId)
    : null;
  return {
    id: observacion.idObservacionClase,
    clase_dictada_id: idClaseDictada,
    temas_vistos: observacion.temasVistos,
    ...(lecturaInterna ? { observaciones_internas: observacion.observacionesInternas } : {}),
    registrada_en: observacion.createdAtObservacion.toISOString(),
    registrada_por: registradaPor,
  };
}
