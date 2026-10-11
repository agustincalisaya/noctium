import type { ContextoFixtures } from "./index";
import { crearIntegrante, desactivarIntegrante } from "../../../src/server/personal/personal.service";
import { abrirCaja, cerrarCaja, declararEfectivo } from "../../../src/server/pagos/caja.service";
import { actorUsuario } from "../../../src/server/shared/historial";
import { transaccion } from "../../../src/server/shared/transaccion";

/**
 * HU-F-05: integrantes de mesa de entrada para probar la baja y la
 * reactivación, todos con los servicios de dominio (`crearIntegrante`,
 * `abrirCaja`, `declararEfectivo`, `cerrarCaja`, `desactivarIntegrante`):
 * - 88063001: activo, con cuenta (nace con la marca de cambio obligatorio) y
 *   sin operaciones: la baja con motivo opcional.
 * - 88063002: activo, con cuenta, que abrió y cerró su caja: «registró
 *   operaciones», así que el motivo es obligatorio, y no tiene la caja abierta.
 * - 88063003: dado de baja con motivo por el gerente del seed: «Reactivar» y
 *   un historial de estados real.
 *
 * No toca las dos cuentas de mesa de entrada del seed base (25100001 y
 * 25100002), que tienen la caja abierta: son el caso «caja abierta». Cada
 * paso se busca por su clave natural antes de hacerlo (la ficha por DNI, la
 * caja por «el integrante tiene alguna caja», la baja por «la ficha tiene
 * historial de estados»), así que correr el seed dos veces no duplica ni
 * cambia nada, y un integrante que se reactivó a mano no se vuelve a dar de
 * baja.
 */
const IP = "127.0.0.1";
const NACIMIENTO = new Date(Date.UTC(1991, 2, 8));

/** Sin operaciones: motivo opcional. */
export const INTEGRANTE_SIN_OPERACIONES_F05 = { dni: "88063001", email: "f05.sinoperaciones@noctium.local" } as const;
/** Con su caja abierta y cerrada: motivo obligatorio, sin caja abierta. */
export const INTEGRANTE_CAJA_CERRADA_F05 = { dni: "88063002", email: "f05.cajacerrada@noctium.local" } as const;
/** Dado de baja con motivo: para reactivar. */
export const INTEGRANTE_INACTIVO_F05 = { dni: "88063003", email: "f05.inactivo@noctium.local" } as const;
const MOTIVO_BAJA = "Licencia prolongada";

export async function fixtureHuF05({ prisma }: ContextoFixtures) {
  const gerente = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  const fichaPorDni = (dni: string) =>
    prisma.fichaMesaEntrada.findUnique({ where: { dniFichaMesaEntrada: dni }, select: { idFichaMesaEntrada: true, usuarioId: true, version: true } });

  /** La ficha del DNI, creándola con su cuenta si falta. */
  async function integrante(datos: { dni: string; email: string }, nombre: string, genero: "MASCULINO" | "FEMENINO") {
    const existente = await fichaPorDni(datos.dni);
    if (existente) return existente;
    await crearIntegrante(
      { nombre, apellido: "Prueba Baja", dni: datos.dni, fechaNacimiento: NACIMIENTO, genero, email: datos.email },
      gerente.idUsuario,
      IP,
    );
    return (await fichaPorDni(datos.dni))!;
  }

  // 1. Sin operaciones.
  await integrante(INTEGRANTE_SIN_OPERACIONES_F05, "Sofía", "FEMENINO");

  // 2. Abrió y cerró su caja (sin cobros: el arqueo cuadra con 0,00).
  const conCaja = await integrante(INTEGRANTE_CAJA_CERRADA_F05, "Tomás", "MASCULINO");
  const usuarioId = conCaja.usuarioId!;
  if ((await prisma.caja.count({ where: { usuarioId } })) === 0) {
    const caja = await transaccion((tx) => abrirCaja(tx, { usuarioId, fondoInicial: "0.00" }), { db: prisma });
    const { huella } = await transaccion(
      (tx) => declararEfectivo(tx, { cajaId: caja.id, usuarioId, efectivoDeclarado: "0.00" }),
      { db: prisma },
    );
    await transaccion((tx) => cerrarCaja(tx, { cajaId: caja.id, usuarioId, huella }), { db: prisma });
  }

  // 3. Dado de baja con motivo por el gerente del seed.
  const inactivo = await integrante(INTEGRANTE_INACTIVO_F05, "Valeria", "FEMENINO");
  const historial = await prisma.historialEstado.count({
    where: { entidad: "FICHA_MESA_ENTRADA", entidadId: inactivo.idFichaMesaEntrada },
  });
  if (historial === 0) {
    await desactivarIntegrante(
      inactivo.idFichaMesaEntrada,
      { version: inactivo.version, motivo: MOTIVO_BAJA },
      actorUsuario(gerente.idUsuario),
    );
  }
}
