import type { ContextoFixtures } from "./index";
import { normalizarTexto } from "../../../src/lib/normalizar-texto";
import { crearGerente, desactivarGerente } from "../../../src/server/gerentes/gerente.service";
import { cambiarPassword } from "../../../src/server/usuarios/cuenta.service";
import { actorUsuario } from "../../../src/server/shared/historial";
import { transaccion } from "../../../src/server/shared/transaccion";

/**
 * HU-G-05: gerentes para probar la baja y la reactivación, con los servicios
 * de dominio (`crearGerente`, `cambiarPassword`, `desactivarGerente`):
 * - 88066001: activo, con cuenta (nace con la marca de cambio obligatorio) y
 *   sin operaciones: la baja con motivo opcional.
 * - 88066002: activo, con cuenta, que «registró operaciones» (es quien da de
 *   baja a 88066004): el motivo es obligatorio. Su contraseña ya se cambió a
 *   `Password123!` (sin la marca), así que puede iniciar sesión y operar: es la
 *   sesión de las pruebas HTTP propias (autodesactivación).
 * - 88066003: activo y sin cuenta (`usuarioId` nulo, inserción directa como
 *   en HU-G-03): baja y reactivación sin cuenta.
 * - 88066004: con cuenta, dado de baja con motivo por 88066002: «Reactivar» y
 *   un historial de estados real.
 *
 * No toca los gerentes del seed base (24100001 y 24100002) ni las fichas de
 * HU-G-01 y HU-G-03. Cada paso se busca por su clave natural antes de hacerlo
 * (la ficha por DNI, el cambio de contraseña por «la cuenta todavía tiene la
 * marca», la baja por «la ficha tiene historial de estados»), así que correr
 * el seed dos veces no duplica ni cambia nada, y un gerente que se reactivó a
 * mano no se vuelve a dar de baja.
 */
const IP = "127.0.0.1";
const NACIMIENTO = new Date(Date.UTC(1979, 6, 14));
const PASSWORD_YA_CAMBIADA = "Password123!";

/** Sin operaciones: motivo opcional. */
export const GERENTE_SIN_OPERACIONES_G05 = { dni: "88066001", email: "g05.sinoperaciones@noctium.local" } as const;
/** Registró operaciones (dio de baja a 88066004) y ya cambió la contraseña: motivo obligatorio. */
export const GERENTE_CON_OPERACIONES_G05 = { dni: "88066002", email: "g05.operaciones@noctium.local" } as const;
/** Sin cuenta vinculada. */
export const GERENTE_SIN_CUENTA_G05 = { dni: "88066003", email: "g05.sincuenta@noctium.local" } as const;
/** Dado de baja con motivo: para reactivar. */
export const GERENTE_INACTIVO_G05 = { dni: "88066004", email: "g05.inactivo@noctium.local" } as const;
const MOTIVO_BAJA = "Licencia prolongada";

export async function fixtureHuG05({ prisma }: ContextoFixtures) {
  const registrante = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  const fichaPorDni = (dni: string) =>
    prisma.fichaGerente.findUnique({ where: { dniFichaGerente: dni }, select: { idFichaGerente: true, usuarioId: true, version: true } });

  /** La ficha del DNI, creándola con su cuenta si falta. */
  async function gerente(datos: { dni: string; email: string }, nombre: string, genero: "MASCULINO" | "FEMENINO") {
    const existente = await fichaPorDni(datos.dni);
    if (existente) return existente;
    await crearGerente(
      { nombre, apellido: "Prueba Baja", dni: datos.dni, fechaNacimiento: NACIMIENTO, genero, email: datos.email },
      registrante.idUsuario,
      IP,
    );
    return (await fichaPorDni(datos.dni))!;
  }

  // 1. Sin operaciones.
  await gerente(GERENTE_SIN_OPERACIONES_G05, "Lucas", "MASCULINO");

  // 2. Con operaciones; su contraseña ya cambiada (sin la marca).
  const operador = await gerente(GERENTE_CON_OPERACIONES_G05, "Renata", "FEMENINO");
  const cuentaOperador = await prisma.usuario.findUniqueOrThrow({
    where: { idUsuario: operador.usuarioId! },
    select: { debeCambiarPasswordUsuario: true },
  });
  if (cuentaOperador.debeCambiarPasswordUsuario) {
    await transaccion(
      (tx) => cambiarPassword(tx, { usuarioId: operador.usuarioId!, nueva: PASSWORD_YA_CAMBIADA, conservarSesionActual: false, ip: IP }),
      { db: prisma },
    );
  }

  // 3. Sin cuenta vinculada.
  if (!(await fichaPorDni(GERENTE_SIN_CUENTA_G05.dni))) {
    await prisma.fichaGerente.create({
      data: {
        usuarioId: null,
        activoFichaGerente: true,
        nombreFichaGerente: "Bruno",
        apellidoFichaGerente: "Prueba Baja",
        nombreNormalizadoFichaGerente: normalizarTexto("Bruno"),
        apellidoNormalizadoFichaGerente: normalizarTexto("Prueba Baja"),
        dniFichaGerente: GERENTE_SIN_CUENTA_G05.dni,
        fechaNacimientoFichaGerente: NACIMIENTO,
        generoFichaGerente: "MASCULINO",
        emailFichaGerente: GERENTE_SIN_CUENTA_G05.email,
        creadoPorUsuarioId: registrante.idUsuario,
      },
    });
  }

  // 4. Dado de baja con motivo por 88066002 (así 88066002 «registró operaciones»).
  const inactivo = await gerente(GERENTE_INACTIVO_G05, "Camila", "FEMENINO");
  const historial = await prisma.historialEstado.count({
    where: { entidad: "FICHA_GERENTE", entidadId: inactivo.idFichaGerente },
  });
  if (historial === 0) {
    await desactivarGerente(
      inactivo.idFichaGerente,
      { version: inactivo.version, motivo: MOTIVO_BAJA },
      actorUsuario(operador.usuarioId!),
    );
  }
}
