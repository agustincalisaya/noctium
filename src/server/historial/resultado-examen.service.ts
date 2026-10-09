import { Prisma, type RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarAlumnoActivo } from "@/server/alumnos/alumno.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import { obtenerOpcionProfesorDeUsuario } from "@/server/profesores/profesor.publico";
import { obtenerEmailDeUsuario } from "@/server/usuarios/usuario.service";
import { getParametroNumerico } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { ahora } from "@/server/shared/reloj";
import { profesorAtendioAlumno } from "./historial.publico";
import { dentroDePlazoDeCorreccion } from "./valor-vigente";
import type {
  AnularResultadoExamenInput,
  CorregirResultadoExamenInput,
  RegistrarResultadoExamenInput,
} from "./resultado-examen.schema";

const ZONA = "America/Argentina/Buenos_Aires";
const MENSAJES = {
  SIN_PERMISO: "No tenés permisos para registrar exámenes de este alumno",
  MATERIA_NO_CURSADA: "El alumno todavía no cursó esta materia",
  FECHA_EXAMEN_FUTURA: "La fecha del examen no puede ser futura",
  ALUMNO_NO_ENCONTRADO: "No se encontró el alumno",
  ALUMNO_INACTIVO: "El alumno está inactivo",
} as const;

type UsuarioHistorial = { id: string; rol: RolUsuario };

function fechaLocal(ahora: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

async function autorizarYVerificarAlumno(
  alumnoId: string,
  usuario: UsuarioHistorial,
  tx: Prisma.TransactionClient,
) {
  if (usuario.rol === "PROFESOR") {
    const profesor = await obtenerOpcionProfesorDeUsuario(usuario.id, tx);
    if (!profesor || !(await profesorAtendioAlumno(profesor.id, alumnoId, tx))) {
      throw new ServiceError("SIN_PERMISO", MENSAJES.SIN_PERMISO);
    }
  }
  await verificarAlumnoActivo(alumnoId, tx);
}

async function materiasCursadas(alumnoId: string, tx: Prisma.TransactionClient) {
  const filas = await tx.claseDictadaAlumno.findMany({
    where: { alumnoId },
    select: { clase: { select: { materiaId: true } } },
  });
  return [...new Set(filas.map(({ clase }) => clase.materiaId))];
}

/** Materias cursadas y escala disponibles para el formulario E-06. */
export async function listarOpcionesExamen(alumnoId: string, usuario: UsuarioHistorial) {
  const [datos, min, max] = await Promise.all([
    prisma.$transaction(async (tx) => {
      await autorizarYVerificarAlumno(alumnoId, usuario, tx);
      const ids = await materiasCursadas(alumnoId, tx);
      return obtenerMateriasPorIds(ids, tx);
    }),
    getParametroNumerico("nota_minima", 1),
    getParametroNumerico("nota_maxima", 10),
  ]);
  return {
    materias: datos
      .map(({ id, nombre }) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
    escala: { min, max },
  };
}

/** Alta inmutable de una nota, autorizada según la ficha y el historial del alumno. */
export async function registrarResultadoExamen(
  alumnoId: string,
  input: RegistrarResultadoExamenInput,
  usuario: UsuarioHistorial,
) {
  const [min, max] = await Promise.all([
    getParametroNumerico("nota_minima", 1),
    getParametroNumerico("nota_maxima", 10),
  ]);
  return prisma.$transaction(async (tx) => {
    await autorizarYVerificarAlumno(alumnoId, usuario, tx);

    const cursada = await tx.claseDictadaAlumno.findFirst({
      where: { alumnoId, clase: { is: { materiaId: input.materia_id } } },
      select: { alumnoId: true },
    });
    if (!cursada) throw new ServiceError("MATERIA_NO_CURSADA", MENSAJES.MATERIA_NO_CURSADA);

    const fecha = input.fecha_examen.toISOString().slice(0, 10);
    if (fecha > fechaLocal(ahora())) {
      throw new ServiceError("FECHA_EXAMEN_FUTURA", MENSAJES.FECHA_EXAMEN_FUTURA);
    }

    const nota = Number(input.nota);
    if (nota < min || nota > max) {
      throw new ServiceError("NOTA_FUERA_DE_RANGO", `La nota debe estar entre ${min} y ${max}`);
    }

    const resultado = await tx.resultadoExamen.create({
      data: {
        alumnoId,
        materiaId: input.materia_id,
        fechaExamen: input.fecha_examen,
        notaExamen: input.nota,
        observaciones: input.observaciones?.trim() || null,
        creadoPorUsuarioId: usuario.id,
      },
      select: { idResultadoExamen: true, alumnoId: true, materiaId: true, fechaExamen: true, notaExamen: true, observaciones: true },
    });
    return {
      id: resultado.idResultadoExamen,
      alumno_id: resultado.alumnoId,
      materia_id: resultado.materiaId,
      fecha_examen: resultado.fechaExamen.toISOString().slice(0, 10),
      nota: resultado.notaExamen.toFixed(1),
      observaciones: resultado.observaciones,
    };
  });
}

type ResultadoBloqueado = {
  idResultadoExamen: string;
  alumnoId: string;
  materiaId: string;
  fechaExamen: Date;
  notaExamen: Prisma.Decimal;
  createdAtResultadoExamen: Date;
  creadoPorUsuarioId: string | null;
};

/** Selecciona el resultado y serializa corrección/anulación sobre la fila original. */
async function bloquearResultado(tx: Tx, alumnoId: string, examenId: string): Promise<ResultadoBloqueado | null> {
  const filas = await tx.$queryRaw<ResultadoBloqueado[]>`
    SELECT "idResultadoExamen", "alumnoId", "materiaId", "fechaExamen", "notaExamen",
      "createdAtResultadoExamen", "creadoPorUsuarioId"
    FROM "resultados_examen"
    WHERE "idResultadoExamen" = ${examenId} AND "alumnoId" = ${alumnoId}
    FOR UPDATE
  `;
  return filas[0] ?? null;
}

async function autorizarCorreccion(
  resultado: ResultadoBloqueado | null,
  usuario: UsuarioHistorial,
  tx: Tx,
  hoy: Date,
) {
  if (usuario.rol === "MESA_ENTRADA") {
    if (!resultado) throw new ErrorDeDominio("errores.examen.resultadoNoEncontrado");
    return resultado;
  }

  const profesor = usuario.rol === "PROFESOR"
    ? await obtenerOpcionProfesorDeUsuario(usuario.id, tx)
    : null;
  if (!profesor || !resultado || resultado.creadoPorUsuarioId !== usuario.id) {
    throw new ServiceError("SIN_PERMISO", "No tenés permisos para corregir este resultado de examen");
  }
  if (!dentroDePlazoDeCorreccion(resultado.createdAtResultadoExamen, hoy)) {
    throw new ErrorDeDominio("errores.correccion.plazoVencido");
  }
  return resultado;
}

async function valorExamenActual(tx: Tx, resultado: ResultadoBloqueado) {
  const correccion = await tx.correccionResultadoExamen.findFirst({
    where: { resultadoExamenId: resultado.idResultadoExamen },
    orderBy: [{ createdAtCorreccion: "desc" }, { idCorreccionResultado: "desc" }],
    select: { fechaNueva: true, notaNueva: true },
  });
  return correccion
    ? { fecha: correccion.fechaNueva, nota: correccion.notaNueva }
    : { fecha: resultado.fechaExamen, nota: resultado.notaExamen };
}

async function validarEstadoActivo(tx: Tx, resultado: ResultadoBloqueado) {
  const anulacion = await tx.anulacionResultadoExamen.findUnique({
    where: { resultadoExamenId: resultado.idResultadoExamen },
    select: { idAnulacionResultado: true },
  });
  if (anulacion) throw new ErrorDeDominio("errores.examen.resultadoAnulado");
}

async function correoActor(usuarioId: string): Promise<string | null> {
  return obtenerEmailDeUsuario(usuarioId);
}

async function corregirResultadoEnTransaccion(
  tx: Tx,
  alumnoId: string,
  examenId: string,
  input: CorregirResultadoExamenInput,
  usuario: UsuarioHistorial,
  escala: { min: number; max: number },
) {
  const momento = ahora();
  const hoy = momento;
  const bloqueado = await bloquearResultado(tx, alumnoId, examenId);
  const resultado = await autorizarCorreccion(bloqueado, usuario, tx, hoy);
  await validarEstadoActivo(tx, resultado);

  const anterior = await valorExamenActual(tx, resultado);
  const fechaNueva = input.fecha_examen ?? anterior.fecha;
  const notaNueva = input.nota === undefined ? anterior.nota : new Prisma.Decimal(input.nota);
  if (fechaNueva.toISOString().slice(0, 10) > fechaLocal(hoy)) {
    throw new ServiceError("FECHA_EXAMEN_FUTURA", MENSAJES.FECHA_EXAMEN_FUTURA);
  }

  const notaNumero = Number(notaNueva.toFixed(1));
  if (notaNumero < escala.min || notaNumero > escala.max) {
    throw new ServiceError("NOTA_FUERA_DE_RANGO", `La nota debe estar entre ${escala.min} y ${escala.max}`);
  }
  if (
    fechaNueva.toISOString().slice(0, 10) === anterior.fecha.toISOString().slice(0, 10)
    && notaNumero === Number(anterior.nota.toFixed(1))
  ) {
    throw new ErrorDeDominio("errores.examen.correccionSinCambios");
  }

  const id = await prismaIdCorreccion(tx, resultado, anterior, fechaNueva, notaNueva, input.motivo, usuario.id, momento);
  return {
    id,
    resultado_id: resultado.idResultadoExamen,
    alumno_id: resultado.alumnoId,
    materia_id: resultado.materiaId,
    fecha_examen: fechaNueva.toISOString().slice(0, 10),
    nota: notaNueva.toFixed(1),
    fecha_anterior: anterior.fecha.toISOString().slice(0, 10),
    nota_anterior: anterior.nota.toFixed(1),
    motivo: input.motivo,
    registrada_en: momento.toISOString(),
    registrada_por: await correoActor(usuario.id),
  };
}

async function prismaIdCorreccion(
  tx: Tx,
  resultado: ResultadoBloqueado,
  anterior: { fecha: Date; nota: Prisma.Decimal },
  fechaNueva: Date,
  notaNueva: Prisma.Decimal,
  motivo: string,
  usuarioId: string,
  momento: Date,
) {
  const correccion = await tx.correccionResultadoExamen.create({
    data: {
      resultadoExamenId: resultado.idResultadoExamen,
      fechaAnterior: anterior.fecha,
      notaAnterior: anterior.nota,
      fechaNueva,
      notaNueva,
      motivo,
      creadoPorUsuarioId: usuarioId,
      createdAtCorreccion: momento,
    },
    select: { idCorreccionResultado: true },
  });
  return correccion.idCorreccionResultado;
}

/** Agrega una corrección compensatoria sin modificar el ResultadoExamen original. */
export async function corregirResultadoExamen(
  alumnoId: string,
  examenId: string,
  input: CorregirResultadoExamenInput,
  usuario: UsuarioHistorial,
) {
  const [min, max] = await Promise.all([
    getParametroNumerico("nota_minima", 1),
    getParametroNumerico("nota_maxima", 10),
  ]);
  return transaccion((tx) => corregirResultadoEnTransaccion(tx, alumnoId, examenId, input, usuario, { min, max }));
}

async function anularResultadoEnTransaccion(
  tx: Tx,
  alumnoId: string,
  examenId: string,
  input: AnularResultadoExamenInput,
  usuario: UsuarioHistorial,
) {
  const momento = ahora();
  const hoy = momento;
  const bloqueado = await bloquearResultado(tx, alumnoId, examenId);
  const resultado = await autorizarCorreccion(bloqueado, usuario, tx, hoy);
  await validarEstadoActivo(tx, resultado);

  const anulacion = await tx.anulacionResultadoExamen.create({
    data: {
      resultadoExamenId: resultado.idResultadoExamen,
      motivo: input.motivo,
      creadoPorUsuarioId: usuario.id,
      createdAtAnulacion: momento,
    },
    select: { idAnulacionResultado: true },
  });
  return {
    id: anulacion.idAnulacionResultado,
    resultado_id: resultado.idResultadoExamen,
    motivo: input.motivo,
    registrada_en: momento.toISOString(),
    registrada_por: await correoActor(usuario.id),
  };
}

/** Agrega la anulación única, conservando el resultado y sus correcciones. */
export async function anularResultadoExamen(
  alumnoId: string,
  examenId: string,
  input: AnularResultadoExamenInput,
  usuario: UsuarioHistorial,
) {
  return transaccion((tx) => anularResultadoEnTransaccion(tx, alumnoId, examenId, input, usuario));
}
