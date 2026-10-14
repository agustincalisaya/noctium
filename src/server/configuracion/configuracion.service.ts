import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { CATALOGO, CLAVES_CONFIGURABLES, type ClaveConfigurable } from "@/server/configuracion/parametros-configurables";
import type { GuardarConfiguracionInput } from "@/server/configuracion/configuracion.schema";
import type { HistorialConfiguracion, ParametroConfiguracion } from "@/types/configuracion.types";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ahora } from "@/server/shared/reloj";
import { transaccion, type OpcionesTransaccion } from "@/server/shared/transaccion";

type DbLectura = Prisma.TransactionClient;

function valorEstricto(clave: ClaveConfigurable, valor: string | undefined): number {
  const numero = valor !== undefined && /^\d+$/.test(valor) ? Number(valor) : NaN;
  const meta = CATALOGO[clave];
  if (!Number.isSafeInteger(numero) || numero < meta.min || numero > meta.max) {
    console.error("[configuracion] parámetro ausente o inválido", { clave });
    throw new Error("Configuración persistida inválida");
  }
  return numero;
}

export async function obtenerConfiguracion(db: DbLectura = prisma): Promise<{ parametros: ParametroConfiguracion[] }> {
  const filas = await db.parametroSistema.findMany({ where: { clave: { in: CLAVES_CONFIGURABLES } } });
  const porClave = new Map(filas.map((fila) => [fila.clave, fila.valor]));
  return {
    parametros: CLAVES_CONFIGURABLES.map((clave) => ({
      clave,
      ...CATALOGO[clave],
      valor: valorEstricto(clave, porClave.get(clave)),
    })),
  };
}

type CambioHistorial = {
  idHistorialParametro: string;
  clave: ClaveConfigurable;
  valorAnterior: string;
  valorNuevo: string;
  usuarioId: string;
  fecha: Date;
};

/** La cola de `transaccion` ejecuta este escritor únicamente después del commit. */
export async function registrarCambioConfiguracion(
  cambio: CambioHistorial,
  db: Pick<Prisma.TransactionClient, "historialParametro"> = prisma,
  esperaMs = 100,
): Promise<boolean> {
  for (let intento = 0; intento <= 3; intento++) {
    try {
      await db.historialParametro.create({ data: cambio });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // El mismo id, preasignado antes del commit, ya fue escrito por un intento anterior.
        return true;
      }
      if (intento === 3) {
        console.error("[configuracion] no se pudo registrar historial", { id: cambio.idHistorialParametro, clave: cambio.clave, intentos: 4, error });
        return false;
      }
      await new Promise((resolver) => setTimeout(resolver, esperaMs * 2 ** intento));
    }
  }
  return false;
}

export async function guardarConfiguracion(
  input: GuardarConfiguracionInput,
  actor: { usuarioId: string },
  opciones: OpcionesTransaccion = {},
): Promise<{ cambios: ClaveConfigurable[] }> {
  const cambios = CLAVES_CONFIGURABLES.filter((clave) => {
    const campo = CATALOGO[clave].campo;
    return input.valores[campo] !== input.esperados[campo];
  }).sort();
  if (cambios.length === 0) return { cambios: [] };

  return transaccion(async (tx, ctx) => {
    const fecha = ahora();
    for (const clave of cambios) {
      const campo = CATALOGO[clave].campo;
      const valorAnterior = String(input.esperados[campo]);
      const valorNuevo = String(input.valores[campo]);
      const actualizado = await tx.parametroSistema.updateMany({
        where: { clave, valor: valorAnterior },
        data: { valor: valorNuevo },
      });
      if (actualizado.count !== 1) throw new ErrorDeDominio("errores.configuracion.conflicto");
      const registro: CambioHistorial = {
        idHistorialParametro: randomUUID(), clave, valorAnterior, valorNuevo,
        usuarioId: actor.usuarioId, fecha,
      };
      ctx.despuesDelCommit(() => registrarCambioConfiguracion(registro, opciones.db ?? prisma));
    }
    return { cambios };
  }, opciones);
}

export async function listarHistorialConfiguracion(
  { pagina }: { pagina: number },
  db: DbLectura = prisma,
): Promise<HistorialConfiguracion> {
  const where = { clave: { in: CLAVES_CONFIGURABLES } };
  const [total, filas] = await Promise.all([
    db.historialParametro.count({ where }),
    db.historialParametro.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { idHistorialParametro: "desc" }],
      skip: (pagina - 1) * 10,
      take: 10,
    }),
  ]);
  const nombres = new Map((await obtenerNombresPersonal(filas.map((fila) => fila.usuarioId), db))
    .map((fila) => [fila.usuario_id, fila.nombre_completo]));
  return {
    items: filas.map((fila) => ({
      id: fila.idHistorialParametro,
      clave: fila.clave as ClaveConfigurable,
      valorAnterior: Number(fila.valorAnterior),
      valorNuevo: Number(fila.valorNuevo),
      usuario: { id: fila.usuarioId, nombre: nombres.get(fila.usuarioId) ?? fila.usuarioId },
      fecha: fila.fecha.toISOString(),
    })),
    pagina, por_pagina: 10, total, total_paginas: Math.ceil(total / 10),
  };
}
