import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ErrorDeDominio, esErrorDeDominio } from "@/server/shared/error-dominio";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import {
  cambiarEmailCuenta,
  crearCuentaParaFicha,
  obtenerResumenCuenta,
  verificarEmailNoAsociadoAOtraCuenta,
} from "@/server/usuarios/cuenta.service";
import { construirFiltroBusquedaGerentes } from "@/server/gerentes/gerente.busqueda";
import {
  POR_PAGINA_GERENTES,
  type AltaGerenteInput,
  type ListarGerentesQuery,
  type ModificarGerenteInput,
} from "@/server/gerentes/gerente.schema";
import type {
  DetalleGerente,
  DisponibilidadGerente,
  GerenteCreado,
  GerenteModificado,
  ListadoGerentes,
} from "@/types/gerente.types";

/**
 * Gerentes (spec_modulo_G.md, HU-G-01). Mismo diseño que
 * `personal.service.ts` (HU-F-01) sobre `FichaGerente`: la duplicación es
 * deliberada (task HU-G-01, decisión 2). Toda la lógica del módulo vive acá
 * (Regla N.° 4); las rutas y las acciones ya validaron el payload con Zod y el
 * permiso. Nunca devuelve textos: lanza `ErrorDeDominio(clave)`. La ficha y su
 * cuenta son una unidad (regla 3.1): la cuenta la crea y la cambia el módulo
 * A, en la misma transacción.
 */

type Db = Tx | Prisma.TransactionClient;

/** `true` si `error` es un P2002 sobre `campo` (filtra por la columna para no confundir índices únicos). */
function esConflictoUnico(error: unknown, campo: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(campo) : typeof target === "string" && target.includes(campo);
}

/**
 * Defensa de constraints fuera de la transacción (spec_modulo_G.md §2.1 paso
 * 5): un alta o una modificación simultánea con el mismo DNI pasa el
 * `findFirst` y la cierra el índice único. Un P2002 sobre `emailUsuario` no
 * puede salir del alta (A usa `ON CONFLICT DO NOTHING`); queda como defensa.
 */
function traducirConflictoUnico(error: unknown): never {
  if (esConflictoUnico(error, "dniFichaGerente")) throw new ErrorDeDominio("errores.gerente.dniDuplicado");
  if (esConflictoUnico(error, "emailUsuario")) throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
  throw error;
}

/** Unicidad del DNI contra todas las fichas de gerente, activas e inactivas, salvo `excluirId` (regla 3.2). */
async function dniEnUso(db: Db, dni: string, excluirId?: string): Promise<boolean> {
  const otra = await db.fichaGerente.findFirst({
    where: { dniFichaGerente: dni, ...(excluirId ? { NOT: { idFichaGerente: excluirId } } : {}) },
    select: { idFichaGerente: true },
  });
  return otra !== null;
}

/** `YYYY-MM-DD` de una columna `@db.Date` (medianoche UTC). */
function fechaCalendario(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Alta de un gerente (spec_modulo_G.md §2.1, HU-G-01 c1 a c3, c5 y c6;
 * HU-A-06 c1 y c2), en una única `transaccion`:
 * 1. DNI único entre todas las fichas de gerente (no contra otras tablas).
 * 2. `crearCuentaParaFicha` con rol `GERENTE`: A verifica el email sin
 *    revelar de quién es, guarda solo el hash del DNI como contraseña inicial,
 *    pone la marca de cambio obligatorio y registra CUENTA_CREADA (con `ip`).
 * 3. La ficha, activa, con `usuarioId`, los nombres normalizados,
 *    `creadoPorUsuarioId` y `version = 0` (Regla N.° 2, opción (a)).
 * Si algo falla, no queda ni ficha ni cuenta. Este módulo le entrega el DNI a
 * A y nunca ve ni devuelve la contraseña (regla 3.8).
 */
export async function crearGerente(
  input: AltaGerenteInput,
  usuarioRegistranteId: string,
  ip?: string | null,
): Promise<GerenteCreado> {
  try {
    return await transaccion(async (tx) => {
      if (await dniEnUso(tx, input.dni)) throw new ErrorDeDominio("errores.gerente.dniDuplicado");

      const { usuario_id: usuarioId } = await crearCuentaParaFicha(tx, {
        email: input.email,
        dni: input.dni,
        rol: "GERENTE",
        ip,
      });

      const ficha = await tx.fichaGerente.create({
        data: {
          usuarioId,
          activoFichaGerente: true,
          nombreFichaGerente: input.nombre,
          apellidoFichaGerente: input.apellido,
          nombreNormalizadoFichaGerente: normalizarTexto(input.nombre),
          apellidoNormalizadoFichaGerente: normalizarTexto(input.apellido),
          dniFichaGerente: input.dni,
          fechaNacimientoFichaGerente: input.fechaNacimiento,
          generoFichaGerente: input.genero ?? null,
          telefonoFichaGerente: input.telefono ?? null,
          emailFichaGerente: input.email,
          // Cargar el contacto en el alta no es una modificación: modificadoPorUsuarioId queda null.
          creadoPorUsuarioId: usuarioRegistranteId,
          version: 0,
        },
      });

      return {
        id: ficha.idFichaGerente,
        nombre: ficha.nombreFichaGerente,
        apellido: ficha.apellidoFichaGerente,
        dni: ficha.dniFichaGerente,
        email: ficha.emailFichaGerente,
        telefono: ficha.telefonoFichaGerente,
        activo: ficha.activoFichaGerente,
        cuenta: await obtenerResumenCuenta(usuarioId, tx),
      };
    });
  } catch (error) {
    traducirConflictoUnico(error);
  }
}

/**
 * Modificación (spec_modulo_G.md §2.2, HU-G-01 c4; HU-A-06 c6), en una única
 * `transaccion`:
 * 1. La ficha existe (activa o inactiva: P-G4, corregir un dato no la
 *    reactiva). Sin cambios respecto de lo guardado: `campos_modificados: []`
 *    sin escribir.
 * 2. DNI nuevo: único entre las demás fichas.
 * 3. Email nuevo de una ficha sin cuenta: no puede ser el de ninguna cuenta.
 *    Con cuenta lo verifica `cambiarEmailCuenta` (paso 6). Sin cambios, no se
 *    revalida.
 * 4. Nombres normalizados si cambian nombre o apellido.
 * 5. `updateMany` condicionado a `version` (Regla N.° 7): `count === 0` es
 *    CONFLICTO_EDICION_CONCURRENTE. Solo los campos que cambian.
 * 6. Con cuenta y email nuevo: `cambiarEmailCuenta`, después de la ficha (el
 *    mismo orden que usará la baja de HU-G-05: ficha y después cuenta).
 *    No revoca sesiones, tampoco si la ficha es la del propio gerente
 *    (DEC-44). Cambiar el DNI no toca la contraseña.
 */
export async function modificarGerente(
  id: string,
  input: ModificarGerenteInput,
  usuarioId: string,
): Promise<GerenteModificado> {
  try {
    return await transaccion(async (tx) => {
      const actual = await tx.fichaGerente.findUnique({
        where: { idFichaGerente: id },
        select: {
          usuarioId: true,
          nombreFichaGerente: true,
          apellidoFichaGerente: true,
          dniFichaGerente: true,
          fechaNacimientoFichaGerente: true,
          generoFichaGerente: true,
          telefonoFichaGerente: true,
          emailFichaGerente: true,
          version: true,
        },
      });
      if (!actual) throw new ErrorDeDominio("errores.gerente.noEncontrado");

      const data: Prisma.FichaGerenteUpdateManyMutationInput = {};
      const camposModificados: string[] = [];

      if (input.nombre !== undefined && input.nombre !== actual.nombreFichaGerente) {
        data.nombreFichaGerente = input.nombre;
        camposModificados.push("nombre");
      }
      if (input.apellido !== undefined && input.apellido !== actual.apellidoFichaGerente) {
        data.apellidoFichaGerente = input.apellido;
        camposModificados.push("apellido");
      }
      if (input.dni !== undefined && input.dni !== actual.dniFichaGerente) {
        data.dniFichaGerente = input.dni;
        camposModificados.push("dni");
      }
      if (
        input.fechaNacimiento !== undefined &&
        input.fechaNacimiento.getTime() !== actual.fechaNacimientoFichaGerente.getTime()
      ) {
        data.fechaNacimientoFichaGerente = input.fechaNacimiento;
        camposModificados.push("fechaNacimiento");
      }
      if (input.genero !== undefined && input.genero !== actual.generoFichaGerente) {
        data.generoFichaGerente = input.genero;
        camposModificados.push("genero");
      }
      if (input.telefono !== undefined && input.telefono !== actual.telefonoFichaGerente) {
        data.telefonoFichaGerente = input.telefono;
        camposModificados.push("telefono");
      }
      const emailNuevo =
        input.email !== undefined && input.email !== actual.emailFichaGerente ? input.email : undefined;
      if (emailNuevo !== undefined) {
        data.emailFichaGerente = emailNuevo;
        camposModificados.push("email");
      }

      if (camposModificados.length === 0) {
        return { id, campos_modificados: [], version: actual.version };
      }

      if (data.dniFichaGerente !== undefined && (await dniEnUso(tx, input.dni!, id))) {
        throw new ErrorDeDominio("errores.gerente.dniDuplicado");
      }
      if (emailNuevo !== undefined && !actual.usuarioId) {
        await verificarEmailNoAsociadoAOtraCuenta(emailNuevo, {}, tx);
      }

      if (data.nombreFichaGerente !== undefined || data.apellidoFichaGerente !== undefined) {
        data.nombreNormalizadoFichaGerente = normalizarTexto(input.nombre ?? actual.nombreFichaGerente);
        data.apellidoNormalizadoFichaGerente = normalizarTexto(input.apellido ?? actual.apellidoFichaGerente);
      }

      const { count } = await tx.fichaGerente.updateMany({
        where: { idFichaGerente: id, version: input.version },
        // updatedAtFichaGerente lo actualiza Prisma (@updatedAt).
        data: { ...data, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
      });
      if (count === 0) throw new ErrorDeDominio("errores.gerente.conflictoEdicion");

      // El email de la ficha es el de la cuenta (regla 3.3): misma unicidad y
      // misma transacción. Si A lo rechaza, se deshace también la ficha.
      if (emailNuevo !== undefined && actual.usuarioId) {
        await cambiarEmailCuenta(tx, { usuarioId: actual.usuarioId, email: emailNuevo });
      }

      return { id, campos_modificados: camposModificados, version: input.version + 1 };
    });
  } catch (error) {
    traducirConflictoUnico(error);
  }
}

/**
 * Ficha del gerente (spec_modulo_G.md §2.4, parte de HU-G-01): los datos,
 * `version`, alta, última modificación (`null` si nunca se modificó), la
 * «Cuenta de acceso» con `obtenerResumenCuenta` (nunca el hash ni el DNI como
 * contraseña) y `esVos` (la ficha es la del gerente autenticado, DEC-44).
 * HU-G-05 le suma el historial de estados y sus indicadores sin cambiar la
 * firma. Solo lectura.
 */
export async function obtenerDetalleGerente(
  id: string,
  sesionUsuarioId: string,
  db: Db = prisma,
): Promise<DetalleGerente> {
  const ficha = await db.fichaGerente.findUnique({ where: { idFichaGerente: id } });
  if (!ficha) throw new ErrorDeDominio("errores.gerente.noEncontrado");

  return {
    id: ficha.idFichaGerente,
    version: ficha.version,
    activo: ficha.activoFichaGerente,
    nombre: ficha.nombreFichaGerente,
    apellido: ficha.apellidoFichaGerente,
    dni: ficha.dniFichaGerente,
    fechaNacimiento: fechaCalendario(ficha.fechaNacimientoFichaGerente),
    genero: ficha.generoFichaGerente,
    telefono: ficha.telefonoFichaGerente,
    email: ficha.emailFichaGerente,
    creadoEl: ficha.createdAtFichaGerente,
    // Una ficha nunca modificada no tiene modificador: el alta no cuenta como modificación.
    modificadoEl: ficha.modificadoPorUsuarioId ? ficha.updatedAtFichaGerente : null,
    cuenta: await obtenerResumenCuenta(ficha.usuarioId, db),
    esVos: ficha.usuarioId !== null && ficha.usuarioId === sesionUsuarioId,
  };
}

/**
 * Listado de gerentes (spec_modulo_G.md §2.3, HU-G-03 c1 a c5; parte de
 * HU-G-01, DEC-38), sobre activos e inactivos. Mismo diseño que
 * `listarPersonal` (HU-F-03):
 * - Orden por apellido y nombre normalizados y el DNI como desempate (orden
 *   total: ninguna fila se repite ni se pierde al paginar).
 * - Búsqueda con `construirFiltroBusquedaGerentes` (criterio de HU-B-05); un
 *   `q` de menos de 2 caracteres devuelve el listado completo.
 * - Paginación de a `POR_PAGINA_GERENTES`, con el `total` del resultado
 *   filtrado. Una página fuera de rango se lleva a la última y, sin
 *   resultados, `pagina` es 1 y `total_paginas` es 0.
 * - `esVos` por ítem (criterio 3): la ficha cuya cuenta es la de la sesión.
 *   Una ficha sin cuenta nunca lo es. `usuarioId` se lee para calcularlo,
 *   pero no se devuelve.
 * Solo lectura: no escribe nada.
 */
export async function listarGerentes(
  query: ListarGerentesQuery,
  sesionUsuarioId: string,
  db: Db = prisma,
): Promise<ListadoGerentes> {
  const where = construirFiltroBusquedaGerentes(query.q);
  const total = await db.fichaGerente.count({ where });
  const totalPaginas = Math.ceil(total / POR_PAGINA_GERENTES);
  const pagina = total === 0 ? 1 : Math.min(query.pagina, totalPaginas);

  const fichas = await db.fichaGerente.findMany({
    where,
    orderBy: [
      { apellidoNormalizadoFichaGerente: "asc" },
      { nombreNormalizadoFichaGerente: "asc" },
      { dniFichaGerente: "asc" },
    ],
    skip: (pagina - 1) * POR_PAGINA_GERENTES,
    take: POR_PAGINA_GERENTES,
    select: {
      idFichaGerente: true,
      usuarioId: true,
      apellidoFichaGerente: true,
      nombreFichaGerente: true,
      dniFichaGerente: true,
      telefonoFichaGerente: true,
      emailFichaGerente: true,
      activoFichaGerente: true,
    },
  });
  return {
    items: fichas.map((f) => ({
      id: f.idFichaGerente,
      apellido: f.apellidoFichaGerente,
      nombre: f.nombreFichaGerente,
      dni: f.dniFichaGerente,
      telefono: f.telefonoFichaGerente,
      email: f.emailFichaGerente,
      activo: f.activoFichaGerente,
      esVos: f.usuarioId !== null && f.usuarioId === sesionUsuarioId,
    })),
    pagina,
    por_pagina: POR_PAGINA_GERENTES,
    total,
    total_paginas: totalPaginas,
  };
}

/**
 * Verificación al salir del campo (HU-G-01, decisión 9): una ayuda para la
 * pantalla; el alta y la modificación la repiten siempre. El DNI contra todas
 * las fichas salvo `excluirId`; el email contra las cuentas, salvo la de la
 * propia ficha. Solo dice si está disponible, nunca de quién es. Un campo
 * ausente cuenta como disponible. Un `excluirId` inexistente es
 * GERENTE_NO_ENCONTRADO. Solo lectura.
 */
export async function verificarDisponibilidadGerente(
  consulta: { dni?: string; email?: string; excluirId?: string },
  db: Db = prisma,
): Promise<DisponibilidadGerente> {
  const propia = consulta.excluirId
    ? await db.fichaGerente.findUnique({
        where: { idFichaGerente: consulta.excluirId },
        select: { usuarioId: true },
      })
    : null;
  // Editar una ficha que no existe: el mismo 404 que la modificación.
  if (consulta.excluirId && !propia) throw new ErrorDeDominio("errores.gerente.noEncontrado");

  const dniDisponible = consulta.dni === undefined || !(await dniEnUso(db, consulta.dni, consulta.excluirId));

  let emailDisponible = true;
  if (consulta.email !== undefined) {
    try {
      await verificarEmailNoAsociadoAOtraCuenta(consulta.email, { excluirUsuarioId: propia?.usuarioId ?? null }, db);
    } catch (error) {
      if (!esErrorDeDominio(error, "errores.cuenta.emailYaAsociado")) throw error;
      emailDisponible = false;
    }
  }

  return { dni_disponible: dniDisponible, email_disponible: emailDisponible };
}
