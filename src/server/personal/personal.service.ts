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
import type { AltaIntegranteInput, ModificarIntegranteInput } from "@/server/personal/personal.schema";
import type {
  DetalleIntegrante,
  DisponibilidadIntegrante,
  IntegranteCreado,
  IntegranteModificado,
  ListadoPersonal,
} from "@/types/personal.types";

/**
 * Personal de mesa de entrada (spec_modulo_F.md, HU-F-01). Toda la lógica del
 * módulo vive acá (Regla N.° 4); las rutas y las acciones ya validaron el
 * payload con Zod y el permiso. Nunca devuelve textos: lanza
 * `ErrorDeDominio(clave)`. La ficha y su cuenta son una unidad (regla 3.1):
 * la cuenta la crea y la cambia el módulo A, en la misma transacción.
 */

type Db = Tx | Prisma.TransactionClient;

/** `true` si `error` es un P2002 sobre `campo` (filtra por la columna para no confundir índices únicos). */
function esConflictoUnico(error: unknown, campo: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(campo) : typeof target === "string" && target.includes(campo);
}

/**
 * Defensa de constraints fuera de la transacción (spec_modulo_F.md §2.1 paso
 * 6): un alta o una modificación simultánea con el mismo DNI pasa el
 * `findFirst` y la cierra el índice único. Un P2002 sobre `emailUsuario` no
 * puede salir del alta (A usa `ON CONFLICT DO NOTHING`); queda como defensa.
 */
function traducirConflictoUnico(error: unknown): never {
  if (esConflictoUnico(error, "dniFichaMesaEntrada")) throw new ErrorDeDominio("errores.personal.dniDuplicado");
  if (esConflictoUnico(error, "emailUsuario")) throw new ErrorDeDominio("errores.cuenta.emailYaAsociado");
  throw error;
}

/** Unicidad del DNI contra todas las fichas de mesa de entrada, activas e inactivas, salvo `excluirId` (regla 3.2). */
async function dniEnUso(db: Db, dni: string, excluirId?: string): Promise<boolean> {
  const otra = await db.fichaMesaEntrada.findFirst({
    where: { dniFichaMesaEntrada: dni, ...(excluirId ? { NOT: { idFichaMesaEntrada: excluirId } } : {}) },
    select: { idFichaMesaEntrada: true },
  });
  return otra !== null;
}

/** `YYYY-MM-DD` de una columna `@db.Date` (medianoche UTC). */
function fechaCalendario(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Alta de un integrante (spec_modulo_F.md §2.1, HU-F-01 c1 a c4 y c6; HU-A-06
 * c1 y c2), en una única `transaccion`:
 * 1. DNI único entre todas las fichas de mesa de entrada (no contra otras tablas).
 * 2. `crearCuentaParaFicha` con rol `MESA_ENTRADA`: A verifica el email sin
 *    revelar de quién es, guarda solo el hash del DNI como contraseña inicial,
 *    pone la marca de cambio obligatorio y registra CUENTA_CREADA (con `ip`).
 * 3. La ficha, activa, con `usuarioId`, los nombres normalizados,
 *    `creadoPorUsuarioId` y `version = 0` (Regla N.° 2, opción (a)).
 * Si algo falla, no queda ni ficha ni cuenta. Este módulo le entrega el DNI a
 * A y nunca ve ni devuelve la contraseña.
 */
export async function crearIntegrante(
  input: AltaIntegranteInput,
  usuarioRegistranteId: string,
  ip?: string | null,
): Promise<IntegranteCreado> {
  try {
    return await transaccion(async (tx) => {
      if (await dniEnUso(tx, input.dni)) throw new ErrorDeDominio("errores.personal.dniDuplicado");

      const { usuario_id: usuarioId } = await crearCuentaParaFicha(tx, {
        email: input.email,
        dni: input.dni,
        rol: "MESA_ENTRADA",
        ip,
      });

      const ficha = await tx.fichaMesaEntrada.create({
        data: {
          usuarioId,
          activoFichaMesaEntrada: true,
          nombreFichaMesaEntrada: input.nombre,
          apellidoFichaMesaEntrada: input.apellido,
          nombreNormalizadoFichaMesaEntrada: normalizarTexto(input.nombre),
          apellidoNormalizadoFichaMesaEntrada: normalizarTexto(input.apellido),
          dniFichaMesaEntrada: input.dni,
          fechaNacimientoFichaMesaEntrada: input.fechaNacimiento,
          generoFichaMesaEntrada: input.genero ?? null,
          telefonoFichaMesaEntrada: input.telefono ?? null,
          emailFichaMesaEntrada: input.email,
          // Cargar el contacto en el alta no es una modificación: modificadoPorUsuarioId queda null.
          creadoPorUsuarioId: usuarioRegistranteId,
          version: 0,
        },
      });

      return {
        id: ficha.idFichaMesaEntrada,
        nombre: ficha.nombreFichaMesaEntrada,
        apellido: ficha.apellidoFichaMesaEntrada,
        dni: ficha.dniFichaMesaEntrada,
        email: ficha.emailFichaMesaEntrada,
        telefono: ficha.telefonoFichaMesaEntrada,
        activo: ficha.activoFichaMesaEntrada,
        cuenta: await obtenerResumenCuenta(usuarioId, tx),
      };
    });
  } catch (error) {
    traducirConflictoUnico(error);
  }
}

/**
 * Modificación (spec_modulo_F.md §2.2, HU-F-01 c5; HU-A-06 c6), en una única
 * `transaccion`:
 * 1. La ficha existe (activa o inactiva: P-F6, corregir un dato no la
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
 *    mismo orden de bloqueo que la baja de HU-F-05: ficha y después cuenta).
 *    No revoca sesiones. Cambiar el DNI no toca la contraseña.
 */
export async function modificarIntegrante(
  id: string,
  input: ModificarIntegranteInput,
  usuarioId: string,
): Promise<IntegranteModificado> {
  try {
    return await transaccion(async (tx) => {
      const actual = await tx.fichaMesaEntrada.findUnique({
        where: { idFichaMesaEntrada: id },
        select: {
          usuarioId: true,
          nombreFichaMesaEntrada: true,
          apellidoFichaMesaEntrada: true,
          dniFichaMesaEntrada: true,
          fechaNacimientoFichaMesaEntrada: true,
          generoFichaMesaEntrada: true,
          telefonoFichaMesaEntrada: true,
          emailFichaMesaEntrada: true,
          version: true,
        },
      });
      if (!actual) throw new ErrorDeDominio("errores.personal.noEncontrado");

      const data: Prisma.FichaMesaEntradaUpdateManyMutationInput = {};
      const camposModificados: string[] = [];

      if (input.nombre !== undefined && input.nombre !== actual.nombreFichaMesaEntrada) {
        data.nombreFichaMesaEntrada = input.nombre;
        camposModificados.push("nombre");
      }
      if (input.apellido !== undefined && input.apellido !== actual.apellidoFichaMesaEntrada) {
        data.apellidoFichaMesaEntrada = input.apellido;
        camposModificados.push("apellido");
      }
      if (input.dni !== undefined && input.dni !== actual.dniFichaMesaEntrada) {
        data.dniFichaMesaEntrada = input.dni;
        camposModificados.push("dni");
      }
      if (
        input.fechaNacimiento !== undefined &&
        input.fechaNacimiento.getTime() !== actual.fechaNacimientoFichaMesaEntrada.getTime()
      ) {
        data.fechaNacimientoFichaMesaEntrada = input.fechaNacimiento;
        camposModificados.push("fechaNacimiento");
      }
      if (input.genero !== undefined && input.genero !== actual.generoFichaMesaEntrada) {
        data.generoFichaMesaEntrada = input.genero;
        camposModificados.push("genero");
      }
      if (input.telefono !== undefined && input.telefono !== actual.telefonoFichaMesaEntrada) {
        data.telefonoFichaMesaEntrada = input.telefono;
        camposModificados.push("telefono");
      }
      const emailNuevo =
        input.email !== undefined && input.email !== actual.emailFichaMesaEntrada ? input.email : undefined;
      if (emailNuevo !== undefined) {
        data.emailFichaMesaEntrada = emailNuevo;
        camposModificados.push("email");
      }

      if (camposModificados.length === 0) {
        return { id, campos_modificados: [], version: actual.version };
      }

      if (data.dniFichaMesaEntrada !== undefined && (await dniEnUso(tx, input.dni!, id))) {
        throw new ErrorDeDominio("errores.personal.dniDuplicado");
      }
      if (emailNuevo !== undefined && !actual.usuarioId) {
        await verificarEmailNoAsociadoAOtraCuenta(emailNuevo, {}, tx);
      }

      if (data.nombreFichaMesaEntrada !== undefined || data.apellidoFichaMesaEntrada !== undefined) {
        data.nombreNormalizadoFichaMesaEntrada = normalizarTexto(input.nombre ?? actual.nombreFichaMesaEntrada);
        data.apellidoNormalizadoFichaMesaEntrada = normalizarTexto(input.apellido ?? actual.apellidoFichaMesaEntrada);
      }

      const { count } = await tx.fichaMesaEntrada.updateMany({
        where: { idFichaMesaEntrada: id, version: input.version },
        // updatedAtFichaMesaEntrada lo actualiza Prisma (@updatedAt).
        data: { ...data, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
      });
      if (count === 0) throw new ErrorDeDominio("errores.personal.conflictoEdicion");

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
 * Ficha del integrante (spec_modulo_F.md §2.4, parte de HU-F-01): los datos,
 * `version`, alta, última modificación (`null` si nunca se modificó) y la
 * «Cuenta de acceso» con `obtenerResumenCuenta` (nunca el hash ni el DNI como
 * contraseña). HU-F-05 suma sus campos sin cambiar la firma.
 */
export async function obtenerDetalleIntegrante(id: string, db: Db = prisma): Promise<DetalleIntegrante> {
  const ficha = await db.fichaMesaEntrada.findUnique({ where: { idFichaMesaEntrada: id } });
  if (!ficha) throw new ErrorDeDominio("errores.personal.noEncontrado");

  return {
    id: ficha.idFichaMesaEntrada,
    version: ficha.version,
    activo: ficha.activoFichaMesaEntrada,
    nombre: ficha.nombreFichaMesaEntrada,
    apellido: ficha.apellidoFichaMesaEntrada,
    dni: ficha.dniFichaMesaEntrada,
    fechaNacimiento: fechaCalendario(ficha.fechaNacimientoFichaMesaEntrada),
    genero: ficha.generoFichaMesaEntrada,
    telefono: ficha.telefonoFichaMesaEntrada,
    email: ficha.emailFichaMesaEntrada,
    creadoEl: ficha.createdAtFichaMesaEntrada,
    // Una ficha nunca modificada no tiene modificador: el alta no cuenta como modificación.
    modificadoEl: ficha.modificadoPorUsuarioId ? ficha.updatedAtFichaMesaEntrada : null,
    cuenta: await obtenerResumenCuenta(ficha.usuarioId, db),
  };
}

/**
 * Listado mínimo (spec_modulo_F.md §2.3, DEC-38): todas las fichas, activas e
 * inactivas, por apellido y nombre normalizados y el DNI como desempate (orden
 * total). Sin búsqueda ni paginación: las suma HU-F-03. Solo lectura.
 */
export async function listarPersonal(db: Db = prisma): Promise<ListadoPersonal> {
  const fichas = await db.fichaMesaEntrada.findMany({
    orderBy: [
      { apellidoNormalizadoFichaMesaEntrada: "asc" },
      { nombreNormalizadoFichaMesaEntrada: "asc" },
      { dniFichaMesaEntrada: "asc" },
    ],
    select: {
      idFichaMesaEntrada: true,
      apellidoFichaMesaEntrada: true,
      nombreFichaMesaEntrada: true,
      dniFichaMesaEntrada: true,
      telefonoFichaMesaEntrada: true,
      emailFichaMesaEntrada: true,
      activoFichaMesaEntrada: true,
    },
  });
  return {
    items: fichas.map((f) => ({
      id: f.idFichaMesaEntrada,
      apellido: f.apellidoFichaMesaEntrada,
      nombre: f.nombreFichaMesaEntrada,
      dni: f.dniFichaMesaEntrada,
      telefono: f.telefonoFichaMesaEntrada,
      email: f.emailFichaMesaEntrada,
      activo: f.activoFichaMesaEntrada,
    })),
    total: fichas.length,
  };
}

/**
 * Verificación al salir del campo (HU-F-01 c3): una ayuda para la pantalla;
 * el alta y la modificación la repiten siempre. El DNI contra todas las fichas
 * salvo `excluirId`; el email contra las cuentas, salvo la de la propia ficha.
 * Solo dice si está disponible, nunca de quién es. Un campo ausente cuenta
 * como disponible. Un `excluirId` inexistente es INTEGRANTE_NO_ENCONTRADO.
 * Solo lectura.
 */
export async function verificarDisponibilidadIntegrante(
  consulta: { dni?: string; email?: string; excluirId?: string },
  db: Db = prisma,
): Promise<DisponibilidadIntegrante> {
  const propia = consulta.excluirId
    ? await db.fichaMesaEntrada.findUnique({
        where: { idFichaMesaEntrada: consulta.excluirId },
        select: { usuarioId: true },
      })
    : null;
  // Editar una ficha que no existe: el mismo 404 que la modificación.
  if (consulta.excluirId && !propia) throw new ErrorDeDominio("errores.personal.noEncontrado");

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
