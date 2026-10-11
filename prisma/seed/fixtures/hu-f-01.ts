import type { ContextoFixtures } from "./index";
import { crearIntegrante } from "../../../src/server/personal/personal.service";
import { desactivarCuenta } from "../../../src/server/usuarios/cuenta.service";
import { transaccion } from "../../../src/server/shared/transaccion";

/**
 * HU-F-01: integrantes de mesa de entrada de prueba, además de los dos del seed
 * base (DNI 25100001 y 25100002, que `seed.ts` crea con `upsert` directo y
 * cuyas cuentas no tienen la marca: la excepción de la regla 3.1). Los dos de
 * acá pasan por `crearIntegrante`, así que su cuenta la crea
 * `crearCuentaParaFicha` (hash del DNI, la marca y CUENTA_CREADA); nunca una
 * contraseña en claro.
 *
 * DNI 8806100x: se ordenan después de los del seed y no chocan con los de las
 * pruebas con PostgreSQL (empiezan con 9). Cada caso se busca por su DNI antes
 * de crearlo, así que correr el seed dos veces no duplica ni cambia nada.
 */
const IP = "127.0.0.1";
const NACIMIENTO = new Date(Date.UTC(1992, 6, 14));

/** DNI y email conocidos: para probar los duplicados y el primer ingreso (nace con la marca). */
export const INTEGRANTE_ACTIVO_F01 = { dni: "88061001", email: "f01.activo@noctium.local" } as const;
/** Ficha y cuenta inactivas: su DNI y su email siguen reservados. */
export const INTEGRANTE_INACTIVO_F01 = { dni: "88061002", email: "f01.inactivo@noctium.local" } as const;

export async function fixtureHuF01({ prisma }: ContextoFixtures) {
  const gerente = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  const existe = async (dni: string) => (await prisma.fichaMesaEntrada.count({ where: { dniFichaMesaEntrada: dni } })) > 0;

  // 1. Integrante activo, con la marca de cambio obligatorio.
  if (!(await existe(INTEGRANTE_ACTIVO_F01.dni))) {
    await crearIntegrante(
      {
        nombre: "Julián",
        apellido: "Prueba Mesa",
        dni: INTEGRANTE_ACTIVO_F01.dni,
        fechaNacimiento: NACIMIENTO,
        genero: "MASCULINO",
        email: INTEGRANTE_ACTIVO_F01.email,
        telefono: "1155500010",
      },
      gerente.idUsuario,
      IP,
    );
  }

  // 2. Integrante inactivo. La baja (HU-F-05) todavía no existe: se deja la
  // ficha y la cuenta en el estado que dejará esa HU (las dos inactivas), con
  // `version + 1`, sin historial de estados (lo escribe HU-F-05).
  if (!(await existe(INTEGRANTE_INACTIVO_F01.dni))) {
    const { id } = await crearIntegrante(
      {
        nombre: "Inés",
        apellido: "Prueba Mesa",
        dni: INTEGRANTE_INACTIVO_F01.dni,
        fechaNacimiento: NACIMIENTO,
        genero: "FEMENINO",
        email: INTEGRANTE_INACTIVO_F01.email,
      },
      gerente.idUsuario,
      IP,
    );
    await transaccion(
      async (tx) => {
        const ficha = await tx.fichaMesaEntrada.findUniqueOrThrow({ where: { idFichaMesaEntrada: id }, select: { usuarioId: true } });
        await tx.fichaMesaEntrada.updateMany({
          where: { idFichaMesaEntrada: id, activoFichaMesaEntrada: true },
          data: { activoFichaMesaEntrada: false, version: { increment: 1 }, modificadoPorUsuarioId: gerente.idUsuario },
        });
        await desactivarCuenta(tx, ficha.usuarioId!);
      },
      { db: prisma },
    );
  }
}
