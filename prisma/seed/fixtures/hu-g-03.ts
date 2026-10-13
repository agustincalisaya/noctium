import type { ContextoFixtures } from "./index";
import { normalizarTexto } from "../../../src/lib/normalizar-texto";

/**
 * HU-G-03: fichas de gerente de prueba para el listado, la búsqueda y la
 * paginación. Con los 2 gerentes del seed base y los 2 de HU-G-01 suman 16:
 * dos páginas de 10.
 *
 * - **Sin cuenta vinculada** (`usuarioId` nulo): esta HU solo lista, así que no
 *   crea usuarios (task HU-G-03, decisión 13; crear cuentas con `crearGerente`
 *   suma un hash por ficha al seed). El schema lo admite: `usuarioId` es
 *   opcional y el email de la ficha no es único. Es la excepción de la regla
 *   3.1 para fichas de prueba, como en HU-F-03; la ficha muestra «Sin cuenta».
 * - Apellidos con tilde y con ñ, dos que coinciden en parte («Ferreyra» y
 *   «Ferrero», el ejemplo del placeholder), activas e inactivas, y DNIs con el
 *   prefijo común 880650 para probar la búsqueda parcial por DNI. Apellidos sin
 *   dígitos, para que la ficha se pueda editar.
 * - Los gerentes del seed base no se tocan.
 * - Idempotente: cada ficha se busca por su DNI antes de crearla; correr el
 *   seed dos veces no duplica ni cambia nada.
 */
const GERENTES: { dni: string; nombre: string; apellido: string; activo: boolean; telefono: string | null }[] = [
  { dni: "88065001", nombre: "Silvina", apellido: "Arce", activo: true, telefono: null },
  { dni: "88065002", nombre: "Andrés", apellido: "Molina", activo: true, telefono: "1155565002" },
  { dni: "88065003", nombre: "Julieta", apellido: "Ferreyra", activo: true, telefono: "1155565003" },
  { dni: "88065004", nombre: "Hernán", apellido: "Ferrero", activo: false, telefono: null },
  { dni: "88065005", nombre: "Mariana", apellido: "Álvarez", activo: true, telefono: "1155565005" },
  { dni: "88065006", nombre: "Gonzalo", apellido: "Núñez", activo: true, telefono: null },
  { dni: "88065007", nombre: "Paula", apellido: "Ordóñez", activo: false, telefono: "1155565007" },
  { dni: "88065008", nombre: "Ramiro", apellido: "Gutiérrez", activo: true, telefono: null },
  { dni: "88065009", nombre: "Florencia", apellido: "Acuña", activo: true, telefono: "1155565009" },
  { dni: "88065010", nombre: "Esteban", apellido: "Rodríguez", activo: true, telefono: null },
  { dni: "88065011", nombre: "Lorena", apellido: "Báez", activo: false, telefono: "1155565011" },
  { dni: "88065012", nombre: "Facundo", apellido: "Toledo", activo: true, telefono: null },
];

export async function fixtureHuG03({ prisma }: ContextoFixtures) {
  const gerente = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  for (const ficha of GERENTES) {
    if ((await prisma.fichaGerente.count({ where: { dniFichaGerente: ficha.dni } })) > 0) continue;
    await prisma.fichaGerente.create({
      data: {
        usuarioId: null,
        activoFichaGerente: ficha.activo,
        nombreFichaGerente: ficha.nombre,
        apellidoFichaGerente: ficha.apellido,
        nombreNormalizadoFichaGerente: normalizarTexto(ficha.nombre),
        apellidoNormalizadoFichaGerente: normalizarTexto(ficha.apellido),
        dniFichaGerente: ficha.dni,
        fechaNacimientoFichaGerente: new Date(Date.UTC(1982, 4, 10)),
        telefonoFichaGerente: ficha.telefono,
        emailFichaGerente: `g03.${ficha.dni}@noctium.local`,
        creadoPorUsuarioId: gerente.idUsuario,
      },
    });
  }
}
