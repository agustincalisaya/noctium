import type { ContextoFixtures } from "./index";
import { crearGerente } from "../../../src/server/gerentes/gerente.service";
import { desactivarCuenta } from "../../../src/server/usuarios/cuenta.service";
import { transaccion } from "../../../src/server/shared/transaccion";

/**
 * HU-G-01: gerentes de prueba, además de los dos del seed base (DNI 24100001
 * y 24100002, que `seed.ts` crea con `upsert` directo: la excepción de la
 * regla 3.1). Esos dos no se tocan: el equipo entra con esas cuentas. Los dos
 * de acá pasan por `crearGerente`, así que su cuenta la crea
 * `crearCuentaParaFicha` (hash del DNI, la marca y CUENTA_CREADA); nunca una
 * contraseña en claro.
 *
 * DNI 8806400x: se ordenan después de los del seed y no chocan con los de las
 * pruebas con PostgreSQL. Apellido sin dígitos, para que la ficha se pueda
 * editar. Cada caso se busca por su DNI antes de crearlo, así que correr el
 * seed dos veces no duplica ni cambia nada.
 */
const IP = "127.0.0.1";
const NACIMIENTO = new Date(Date.UTC(1984, 8, 21));

/** DNI y email conocidos: para probar los duplicados, el primer ingreso (nace con la marca) y DEC-44. */
export const GERENTE_ACTIVO_G01 = { dni: "88064001", email: "g01.activo@noctium.local" } as const;
/** Ficha y cuenta inactivas: su DNI y su email siguen reservados. */
export const GERENTE_INACTIVO_G01 = { dni: "88064002", email: "g01.inactivo@noctium.local" } as const;

export async function fixtureHuG01({ prisma }: ContextoFixtures) {
  const gerente = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  const existe = async (dni: string) => (await prisma.fichaGerente.count({ where: { dniFichaGerente: dni } })) > 0;

  // 1. Gerente activo, con la marca de cambio obligatorio.
  if (!(await existe(GERENTE_ACTIVO_G01.dni))) {
    await crearGerente(
      {
        nombre: "Tomás",
        apellido: "Prueba Gerente",
        dni: GERENTE_ACTIVO_G01.dni,
        fechaNacimiento: NACIMIENTO,
        genero: "MASCULINO",
        email: GERENTE_ACTIVO_G01.email,
        telefono: "1155500040",
      },
      gerente.idUsuario,
      IP,
    );
  }

  // 2. Gerente inactivo. La baja (HU-G-05) todavía no existe: se deja la
  // ficha y la cuenta en el estado que dejará esa HU (las dos inactivas), con
  // `version + 1`, sin historial de estados (lo escribe HU-G-05).
  if (!(await existe(GERENTE_INACTIVO_G01.dni))) {
    const { id } = await crearGerente(
      {
        nombre: "Valeria",
        apellido: "Prueba Gerente",
        dni: GERENTE_INACTIVO_G01.dni,
        fechaNacimiento: NACIMIENTO,
        genero: "FEMENINO",
        email: GERENTE_INACTIVO_G01.email,
      },
      gerente.idUsuario,
      IP,
    );
    await transaccion(
      async (tx) => {
        const ficha = await tx.fichaGerente.findUniqueOrThrow({ where: { idFichaGerente: id }, select: { usuarioId: true } });
        await tx.fichaGerente.updateMany({
          where: { idFichaGerente: id, activoFichaGerente: true },
          data: { activoFichaGerente: false, version: { increment: 1 }, modificadoPorUsuarioId: gerente.idUsuario },
        });
        await desactivarCuenta(tx, ficha.usuarioId!);
      },
      { db: prisma },
    );
  }
}
