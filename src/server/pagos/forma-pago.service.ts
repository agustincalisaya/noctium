import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { registrarCambioEstado } from "@/server/shared/historial-estados";
import type { ActorDominio } from "@/server/shared/historial";
import type { Tx } from "@/server/shared/transaccion";
import { contarAlumnosConFormaPagoPreferida } from "@/server/alumnos/alumno.publico";
import type { DesactivarFormaPagoInput } from "./forma-pago.schema";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { ListadoFormasPago } from "@/types/pago.types";
import type { CrearFormaPagoInput, ListarFormasPagoQuery } from "./forma-pago.schema";

const MENSAJES = {
  NOMBRE_DUPLICADO: "Ya existe una forma de pago con ese nombre.",
} as const;

/**
 * Violación de constraint único (P2002) sobre el nombre o el nombre
 * normalizado → mismo `ServiceError` que la validación aplicativa
 * (spec_modulo_I.md §2.1). `null` si no es un P2002, para que el llamador
 * relance el error original.
 */
function traducirViolacionUnicidad(error: unknown): ServiceError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  return new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);
}

/**
 * Alta de forma de pago (spec_modulo_I.md §2.1). Normaliza, verifica que no
 * exista otra (activa o inactiva) con el mismo nombre normalizado e inserta
 * activa. La verificación previa solo mejora el mensaje: no cierra la
 * carrera entre dos altas simultáneas. La garantía es el índice único de la
 * base y la traducción de `P2002` de abajo (Regla N.° 7).
 */
export async function crearFormaPago(input: CrearFormaPagoInput, usuarioId: string) {
  const nombreNormalizado = normalizarTexto(input.nombre);

  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.formaPago.findFirst({
        where: { nombreNormalizadaFormaPago: nombreNormalizado },
        select: { idFormaPago: true },
      });
      if (existente) throw new ServiceError("NOMBRE_DUPLICADO", MENSAJES.NOMBRE_DUPLICADO);

      return tx.formaPago.create({
        data: {
          nombreFormaPago: input.nombre,
          nombreNormalizadaFormaPago: nombreNormalizado,
          activaFormaPago: true,
          creadoPorUsuarioId: usuarioId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw traducirViolacionUnicidad(error) ?? error;
  }
}

/**
 * Listado de gestión (spec_modulo_I.md §2.2): activas e inactivas, orden
 * alfabético por nombre normalizado, con el mismo cálculo de página que
 * Materias (página fuera de rango se acota; sin filas, `total_paginas` es 0).
 */
export async function listarFormasPago(query: ListarFormasPagoQuery): Promise<ListadoFormasPago> {
  const { pagina, por_pagina: porPagina } = query;

  const total = await prisma.formaPago.count();
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));

  const formas = await prisma.formaPago.findMany({
    orderBy: { nombreNormalizadaFormaPago: "asc" },
    skip: (paginaActual - 1) * porPagina,
    take: porPagina,
    select: { idFormaPago: true, nombreFormaPago: true, activaFormaPago: true },
  });

  return {
    items: formas.map((forma) => ({
      id: forma.idFormaPago,
      nombre: forma.nombreFormaPago,
      is_active: forma.activaFormaPago,
    })),
    paginacion: {
      total,
      pagina_actual: paginaActual,
      total_paginas: Math.ceil(total / porPagina),
      por_pagina: porPagina,
    },
  };
}


/** Dominio I-07: el llamador abre transaccion() y el servicio toma sus bloqueos. */
const seleccionForma = { idFormaPago: true, nombreFormaPago: true, activaFormaPago: true } as const;
const presentarForma = (forma: { idFormaPago: string; nombreFormaPago: string; activaFormaPago: boolean }) =>
  ({ id: forma.idFormaPago, nombre: forma.nombreFormaPago, is_active: forma.activaFormaPago });

async function exigirForma(db: Tx, id: string) {
  const forma = await db.formaPago.findUnique({ where: { idFormaPago: id }, select: seleccionForma });
  if (!forma) throw new ErrorDeDominio("errores.formaPago.noEncontrada");
  return forma;
}

export async function modificarFormaPago(tx: Tx, id: string, input: CrearFormaPagoInput) {
  await bloquear(tx, { formasPago: { ids: [id] } });
  const forma = await exigirForma(tx, id);
  const nombreNormalizado = normalizarTexto(input.nombre);
  if (forma.nombreFormaPago === input.nombre) return presentarForma(forma);
  const duplicada = await tx.formaPago.findFirst({
    where: { nombreNormalizadaFormaPago: nombreNormalizado, idFormaPago: { not: id } }, select: { idFormaPago: true },
  });
  if (duplicada) throw new ErrorDeDominio("errores.formaPago.nombreDuplicado");
  try {
    return presentarForma(await tx.formaPago.update({ where: { idFormaPago: id }, data: {
      nombreFormaPago: input.nombre, nombreNormalizadaFormaPago: nombreNormalizado,
    }, select: seleccionForma }));
  } catch (error) {
    if (traducirViolacionUnicidad(error)) throw new ErrorDeDominio("errores.formaPago.nombreDuplicado");
    throw error;
  }
}

export async function obtenerImpactoFormaPago(id: string, db: Tx = prisma) {
  const forma = await exigirForma(db, id);
  const alumnos = await contarAlumnosConFormaPagoPreferida(id, db);
  const pagos = await db.pago.count({ where: { formaPagoId: id } });
  // Incluye operaciones corregidas hacia esta forma: también representan pagos registrados.
  const correcciones = await db.correccionOperacion.count({ where: { formaPagoNuevaId: id } });
  const activas = await db.formaPago.count({ where: { activaFormaPago: true } });
  return { alumnos_con_preferida: alumnos, tiene_pagos: pagos + correcciones > 0,
    es_ultima_activa: forma.activaFormaPago && activas === 1 };
}

export async function desactivarFormaPago(tx: Tx, id: string, input: DesactivarFormaPagoInput, actor: ActorDominio) {
  await bloquear(tx, { formasPago: { activas: true, ids: [id] } });
  const forma = await exigirForma(tx, id);
  if (!forma.activaFormaPago) throw new ErrorDeDominio("errores.formaPago.yaInactiva");
  if (await tx.formaPago.count({ where: { activaFormaPago: true } }) <= 1)
    throw new ErrorDeDominio("errores.formaPago.ultimaActiva");
  const tienePagos = await tx.pago.count({ where: { formaPagoId: id } }) > 0
    || await tx.correccionOperacion.count({ where: { formaPagoNuevaId: id } }) > 0;
  if (tienePagos && !input.motivo?.trim()) throw new ErrorDeDominio("errores.formaPago.motivoRequerido");
  const actualizada = await tx.formaPago.update({ where: { idFormaPago: id }, data: { activaFormaPago: false }, select: seleccionForma });
  registrarCambioEstado(tx, { entidad: "FORMA_PAGO", id, accion: "DESACTIVAR", motivo: input.motivo, actor });
  return presentarForma(actualizada);
}

export async function reactivarFormaPago(tx: Tx, id: string, actor: ActorDominio) {
  await bloquear(tx, { formasPago: { ids: [id] } });
  const forma = await exigirForma(tx, id);
  if (forma.activaFormaPago) throw new ErrorDeDominio("errores.formaPago.yaActiva");
  const actualizada = await tx.formaPago.update({ where: { idFormaPago: id }, data: { activaFormaPago: true }, select: seleccionForma });
  registrarCambioEstado(tx, { entidad: "FORMA_PAGO", id, accion: "REACTIVAR", actor });
  return presentarForma(actualizada);
}
