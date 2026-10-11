import type { ContextoFixtures } from "./index";
import { normalizarTexto } from "../../../src/lib/normalizar-texto";

/**
 * HU-F-03: fichas de mesa de entrada de prueba para el listado, la búsqueda y
 * la paginación. Con las 2 del seed base y las de HU-F-01, el listado supera
 * una página de 10.
 *
 * - **Sin cuenta vinculada** (`usuarioId` nulo): esta HU solo lista, así que no
 *   crea usuarios (decisión 12 de la task). El schema lo admite: `usuarioId`
 *   es opcional y el email de la ficha no es único. Es la excepción de la regla
 *   3.1 para fichas de prueba; la ficha muestra «Sin cuenta».
 * - Apellidos con tilde y con ñ («Álvarez», «Núñez») y dos que coinciden en
 *   parte («García», «Garcés»), activas e inactivas, y DNIs con el prefijo común
 *   880620 para probar la búsqueda parcial por DNI.
 * - Idempotente: cada ficha se busca por su DNI antes de crearla; correr el
 *   seed dos veces no duplica ni cambia nada.
 */
const INTEGRANTES: { dni: string; nombre: string; apellido: string; activo: boolean; telefono: string | null }[] = [
  { dni: "88062001", nombre: "Agustina", apellido: "Álvarez", activo: true, telefono: "1155562001" },
  { dni: "88062002", nombre: "Martín", apellido: "Núñez", activo: true, telefono: null },
  { dni: "88062003", nombre: "Lucía", apellido: "García", activo: true, telefono: "1155562003" },
  { dni: "88062004", nombre: "Tomás", apellido: "Garcés", activo: false, telefono: null },
  { dni: "88062005", nombre: "Sofía", apellido: "Benítez", activo: true, telefono: "1155562005" },
  { dni: "88062006", nombre: "Joaquín", apellido: "Castro", activo: true, telefono: null },
  { dni: "88062007", nombre: "Valentina", apellido: "Domínguez", activo: false, telefono: "1155562007" },
  { dni: "88062008", nombre: "Ignacio", apellido: "Espinoza", activo: true, telefono: null },
  { dni: "88062009", nombre: "Camila", apellido: "Fernández", activo: true, telefono: "1155562009" },
  { dni: "88062010", nombre: "Mateo", apellido: "Ibáñez", activo: true, telefono: null },
  { dni: "88062011", nombre: "Renata", apellido: "Muñoz", activo: false, telefono: "1155562011" },
  { dni: "88062012", nombre: "Bruno", apellido: "Peña", activo: true, telefono: null },
];

export async function fixtureHuF03({ prisma }: ContextoFixtures) {
  const gerente = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  for (const integrante of INTEGRANTES) {
    if ((await prisma.fichaMesaEntrada.count({ where: { dniFichaMesaEntrada: integrante.dni } })) > 0) continue;
    await prisma.fichaMesaEntrada.create({
      data: {
        usuarioId: null,
        activoFichaMesaEntrada: integrante.activo,
        nombreFichaMesaEntrada: integrante.nombre,
        apellidoFichaMesaEntrada: integrante.apellido,
        nombreNormalizadoFichaMesaEntrada: normalizarTexto(integrante.nombre),
        apellidoNormalizadoFichaMesaEntrada: normalizarTexto(integrante.apellido),
        dniFichaMesaEntrada: integrante.dni,
        fechaNacimientoFichaMesaEntrada: new Date(Date.UTC(1990, 0, 15)),
        telefonoFichaMesaEntrada: integrante.telefono,
        emailFichaMesaEntrada: `f03.${integrante.dni}@noctium.local`,
        creadoPorUsuarioId: gerente.idUsuario,
      },
    });
  }
}
