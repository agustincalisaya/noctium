import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar-texto";
import { ServiceError } from "@/server/shared/service-error";
import type { DetalleAlumno, FichaAlumno } from "@/types/alumno.types";
import type {
  ContactoAlumnoInput,
  FormaPagoPreferidaInput,
  IdentidadAlumnoInput,
  ListarAlumnosQuery,
  ModificarAlumnoInput,
} from "./alumno.schema";

const MENSAJES = {
  DNI_DUPLICADO_ACTIVA: "Ya existe un alumno registrado con ese DNI",
  DNI_DUPLICADO_INACTIVA: "Ya existe un alumno registrado con ese DNI (ficha inactiva)",
  EMAIL_YA_ASOCIADO: "Ese email ya está asociado a una cuenta existente",
  ALUMNO_NO_ENCONTRADO: "El alumno ya no existe",
  FORMA_PAGO_NO_DISPONIBLE: "La forma de pago seleccionada ya no está disponible",
  CONFLICTO_EDICION_CONCURRENTE: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales",
  EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE:
    "No se puede modificar el email de un alumno con cuenta vinculada. Esta función está pendiente de una actualización del sistema.",
} as const;

/**
 * Alta de identidad del alumno (spec_modulo_B.md §2.1). La verificación de
 * unicidad de `dniAlumno` y el `INSERT` ocurren dentro de la misma
 * transacción, uno inmediatamente después del otro — es la "revalidación
 * inmediatamente antes del INSERT" que pide la spec, no una segunda
 * consulta redundante. La garantía real contra una alta duplicada
 * simultánea (Regla N.° 7 de docs/RULES.md) es el constraint único de la
 * base: el catch de `P2002` de abajo no es un caso opcional.
 *
 * Trazabilidad (Regla N.° 2, patrón a): columnas de auditoría en la propia
 * fila (`createdAtAlumno`, `creadoPorUsuarioId`) — no aplica tabla de
 * eventos separada, esto es una mutación única sobre la entidad, no un
 * evento discreto repetible.
 */
export async function crearAlumno(input: IdentidadAlumnoInput, usuarioId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.alumno.findFirst({
        where: { dniAlumno: input.dni },
      });
      if (existente) {
        throw new ServiceError(
          "DNI_DUPLICADO",
          existente.activoAlumno ? MENSAJES.DNI_DUPLICADO_ACTIVA : MENSAJES.DNI_DUPLICADO_INACTIVA,
        );
      }

      return tx.alumno.create({
        data: {
          nombreAlumno: input.nombre,
          apellidoAlumno: input.apellido,
          // Requeridos desde HU-B-04 (orden case/acento-insensitivo del
          // listado, spec_modulo_B.md §2.4) — corrección necesaria acá
          // porque el alta (HU-B-01) es el único INSERT de Alumno fuera del
          // seed.
          nombreNormalizadoAlumno: normalizarTexto(input.nombre),
          apellidoNormalizadoAlumno: normalizarTexto(input.apellido),
          dniAlumno: input.dni,
          fechaNacimientoAlumno: input.fecha_nacimiento,
          generoAlumno: input.genero ?? null,
          activoAlumno: true,
          creadoPorUsuarioId: usuarioId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("DNI_DUPLICADO", MENSAJES.DNI_DUPLICADO_ACTIVA);
    }

    throw error;
  }
}

/**
 * Ficha del alumno (HU-B-02: identidad resumida + contacto actual, para la
 * ficha y para precargar el formulario de contacto). `null` si el id no
 * existe. Mismo patrón que `obtenerFichaProfesor()` de HU-D-02.
 */
export async function obtenerFichaAlumno(alumnoId: string): Promise<FichaAlumno | null> {
  const alumno = await prisma.alumno.findUnique({
    where: { idAlumno: alumnoId },
    select: {
      idAlumno: true,
      nombreAlumno: true,
      apellidoAlumno: true,
      dniAlumno: true,
      activoAlumno: true,
      telefonoAlumno: true,
      emailAlumno: true,
    },
  });
  if (!alumno) return null;

  return {
    id: alumno.idAlumno,
    nombre: alumno.nombreAlumno,
    apellido: alumno.apellidoAlumno,
    dni: alumno.dniAlumno,
    activo: alumno.activoAlumno,
    telefono: alumno.telefonoAlumno,
    email: alumno.emailAlumno,
  };
}

/** Consulta acotada para el autocompletado de HU-C-04. */
export async function buscarAlumnosActivos(query: string) {
  const termino = normalizarTexto(query.trim());
  if (termino.length < 2) return [];
  const alumnos = await prisma.alumno.findMany({
    where: {
      activoAlumno: true,
      OR: [
        { nombreNormalizadoAlumno: { contains: termino } },
        { apellidoNormalizadoAlumno: { contains: termino } },
        { dniAlumno: { contains: query.trim() } },
      ],
    },
    orderBy: [{ apellidoNormalizadoAlumno: "asc" }, { nombreNormalizadoAlumno: "asc" }, { idAlumno: "asc" }],
    take: 10,
    select: { idAlumno: true, nombreAlumno: true, apellidoAlumno: true, dniAlumno: true },
  });
  return alumnos.map((alumno) => ({ id: alumno.idAlumno, nombre: alumno.nombreAlumno, apellido: alumno.apellidoAlumno, dni: alumno.dniAlumno }));
}

export async function verificarAlumnoActivo(alumnoId: string, db: Prisma.TransactionClient = prisma): Promise<boolean> {
  return (await db.alumno.count({ where: { idAlumno: alumnoId, activoAlumno: true } })) > 0;
}

/**
 * Existencia + estado activo de una `FormaPago` (HU-B-03 criterio 6),
 * extraído de `actualizarFormaPagoPreferida()` para que `modificarAlumno()`
 * (HU-B-06) aplique la misma regla de negocio sin duplicarla. Se llama
 * únicamente cuando `forma_pago_id` no es `null` — "sin preferencia" nunca
 * necesita esta verificación.
 */
async function verificarFormaPagoActiva(tx: Prisma.TransactionClient, formaPagoId: string): Promise<void> {
  const formaPago = await tx.formaPago.findUnique({
    where: { idFormaPago: formaPagoId },
    select: { activaFormaPago: true },
  });
  if (!formaPago || !formaPago.activaFormaPago) {
    throw new ServiceError("FORMA_PAGO_NO_DISPONIBLE", MENSAJES.FORMA_PAGO_NO_DISPONIBLE);
  }
}

/**
 * Registro/actualización del contacto del alumno (HU-B-02,
 * `spec_modulo_B.md` §2.2). `input` ya llegó validado y normalizado por
 * `ContactoAlumnoSchema` en la capa delgada; `usuarioModificadorId` es el id
 * de la sesión ya autorizada con `alumnos:editar` (este servicio no chequea
 * permisos, mismo criterio que `crearAlumno()` de arriba).
 *
 * Actualiza únicamente los campos provistos (`spec_modulo_B.md` §2.2, punto
 * 3, textual) — `camposProvistos` distingue "el campo no vino en el
 * payload" (no se toca la columna) de "el campo vino vacío" (el schema
 * compartido `ContactoSchema` colapsa un string vacío a `undefined`, pero
 * eso significa "el usuario lo vació a propósito": se persiste como
 * `null`). Zod solo no alcanza para esa distinción porque ambos casos
 * llegan igual de `ContactoAlumnoInput` — por eso `camposProvistos` se
 * calcula en la capa delgada (Server Action / Route Handler) mirando la
 * presencia de la clave en el `FormData`/body crudo, antes de parsear, y se
 * pasa explícitamente acá.
 *
 * Corrección post-implementación (ver sección 8 de
 * `docs/tasks/Sprint 1/HU-B-02.md`): la versión original escribía ambos
 * campos siempre (`input.telefono ?? null`), asumiendo que "no provisto" y
 * "provisto vacío" eran equivalentes — cierto para el formulario real (los
 * dos `<input>` siempre están presentes en el `FormData`) pero falso para
 * cualquier otro consumidor de la API que omita una clave, violando el
 * contrato literal de la spec.
 *
 * Todo corre en una única `$transaction`: la verificación de email contra
 * cuentas existentes y el `UPDATE` se confirman juntos, sin guardado
 * parcial (criterios 5 y 6 de la HU).
 *
 * Verificación de email (`tx.usuario.findFirst` sobre `Usuario`, tabla de
 * Módulo A) — mismo patrón que `actualizarContactoProfesor()` de HU-D-02.
 * Documentado en `docs/tasks/Sprint 1/HU-B-02.md` §0 como deuda técnica /
 * posible tensión con la Regla N.° 3 de `docs/RULES.md` (aislamiento de
 * dominio), a resolver por el equipo de forma centralizada — no es un fix
 * unilateral de esta task.
 */
export async function actualizarContactoAlumno(
  alumnoId: string,
  input: ContactoAlumnoInput,
  camposProvistos: { telefono: boolean; email: boolean },
  usuarioModificadorId: string,
): Promise<{ id: string; telefono: string | null; email: string | null }> {
  return prisma.$transaction(async (tx) => {
    const alumno = await tx.alumno.findUnique({
      where: { idAlumno: alumnoId },
      select: { idAlumno: true, usuarioId: true },
    });
    if (!alumno) {
      throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);
    }

    if (input.email) {
      // Criterio 4 de la HU: el email no puede pertenecer a OTRA cuenta. La
      // cuenta propia del alumno (si tiene) queda excluida; sin cuenta
      // vinculada, cualquier coincidencia bloquea. Comparación
      // case-insensitive porque emailUsuario no garantiza estar guardado en
      // minúsculas.
      const otraCuenta = await tx.usuario.findFirst({
        where: {
          emailUsuario: { equals: input.email, mode: "insensitive" },
          ...(alumno.usuarioId ? { NOT: { idUsuario: alumno.usuarioId } } : {}),
        },
        select: { idUsuario: true },
      });
      if (otraCuenta) {
        throw new ServiceError("EMAIL_YA_ASOCIADO", MENSAJES.EMAIL_YA_ASOCIADO);
      }
    }

    const actualizado = await tx.alumno.update({
      where: { idAlumno: alumnoId },
      data: {
        ...(camposProvistos.telefono ? { telefonoAlumno: input.telefono ?? null } : {}),
        ...(camposProvistos.email ? { emailAlumno: input.email ?? null } : {}),
        modificadoPorUsuarioId: usuarioModificadorId,
        // updatedAtAlumno lo actualiza Prisma (@updatedAt).
      },
      select: { idAlumno: true, telefonoAlumno: true, emailAlumno: true },
    });

    return {
      id: actualizado.idAlumno,
      telefono: actualizado.telefonoAlumno,
      email: actualizado.emailAlumno,
    };
  });
}

/**
 * Listado de alumnos (HU-B-04, spec_modulo_B.md §2.4). Sin filtro
 * `activoAlumno` — incluye activos e inactivos a propósito, la columna
 * Estado distingue (mismo criterio que `listarMaterias()` de Materias).
 * Orden por `apellidoNormalizadoAlumno`/`nombreNormalizadoAlumno` (case/
 * acento-insensitivo) con `dniAlumno` como segundo criterio de desempate
 * estable — sin este segundo criterio, dos alumnos con el mismo apellido y
 * nombre normalizado podrían cambiar de orden entre páginas.
 */
export async function listarAlumnos(query: ListarAlumnosQuery) {
  const { pagina, por_pagina: porPagina } = query;

  const total = await prisma.alumno.count();
  const paginaActual = total === 0 ? 1 : Math.min(pagina, Math.ceil(total / porPagina));

  const alumnos = await prisma.alumno.findMany({
    orderBy: [
      { apellidoNormalizadoAlumno: "asc" },
      { nombreNormalizadoAlumno: "asc" },
      { dniAlumno: "asc" },
    ],
    skip: (paginaActual - 1) * porPagina,
    take: porPagina,
  });

  return {
    items: alumnos.map((alumno) => ({
      id: alumno.idAlumno,
      apellido: alumno.apellidoAlumno,
      nombre: alumno.nombreAlumno,
      dni: alumno.dniAlumno,
      telefono: alumno.telefonoAlumno,
      email: alumno.emailAlumno,
      is_active: alumno.activoAlumno,
    })),
    paginacion: {
      total,
      pagina_actual: paginaActual,
      total_paginas: Math.ceil(total / porPagina),
      por_pagina: porPagina,
    },
  };
}

/**
 * Detalle completo del alumno (HU-B-04, spec_modulo_B.md §2.4): identidad +
 * contacto + forma de pago preferida (nombre resuelto vía `include`, no
 * solo el id) + estado + fecha de alta. Separada de `obtenerFichaAlumno()`
 * (HU-B-02) a propósito — esa función alimenta el formulario de contacto y
 * no necesita forma de pago ni fecha de alta (Nota de alcance, HU-B-04 §1
 * punto 6).
 *
 * `genero`, `fecha_nacimiento` y `version` (HU-B-06): se agregan para
 * precargar el formulario único de edición — `version` además es la
 * condición de concurrencia optimista que ese formulario manda de vuelta.
 */
export async function obtenerDetalleAlumno(alumnoId: string): Promise<DetalleAlumno> {
  const alumno = await prisma.alumno.findUnique({
    where: { idAlumno: alumnoId },
    include: { formaPagoPreferida: { select: { nombreFormaPago: true } } },
  });

  if (!alumno) {
    throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);
  }

  return {
    id: alumno.idAlumno,
    nombre: alumno.nombreAlumno,
    apellido: alumno.apellidoAlumno,
    dni: alumno.dniAlumno,
    fecha_nacimiento: alumno.fechaNacimientoAlumno.toISOString().slice(0, 10),
    genero: alumno.generoAlumno,
    is_active: alumno.activoAlumno,
    telefono: alumno.telefonoAlumno,
    email: alumno.emailAlumno,
    forma_pago_preferida: alumno.formaPagoPreferida?.nombreFormaPago ?? null,
    // HU-B-03: id crudo, para precargar el <select> por id (el nombre no
    // sirve para eso — y una preferencia que quedó inactiva desde que se
    // guardó de todas formas necesita su id real, no solo el texto).
    forma_pago_preferida_id: alumno.formaPagoPreferidaId,
    created_at: alumno.createdAtAlumno.toISOString(),
    version: alumno.version,
  };
}

/**
 * Catálogo de formas de pago activas (HU-B-03, spec_modulo_B.md §2.3),
 * para poblar el `<select>` de la ficha — solo `id`/`nombre`, sin exponer
 * ningún otro campo del catálogo (ej. `activaFormaPago`, ya implícito en el
 * filtro).
 */
export async function listarFormasPagoActivas() {
  const formasPago = await prisma.formaPago.findMany({
    where: { activaFormaPago: true },
    orderBy: { nombreFormaPago: "asc" },
    select: { idFormaPago: true, nombreFormaPago: true },
  });

  return formasPago.map((fp) => ({ id: fp.idFormaPago, nombre: fp.nombreFormaPago }));
}

/**
 * Asociar/quitar la forma de pago preferida del alumno (HU-B-03,
 * spec_modulo_B.md §2.3). Si `forma_pago_id` no es `null`, la existencia y
 * el estado activo de la `FormaPago` se revalidan dentro de la misma
 * transacción que el `UPDATE` de `Alumno` — "en el momento de confirmar",
 * no basta con que estuviera activa cuando se abrió el formulario (criterio
 * 6). No es el patrón de `updateMany` atómico de la Regla N.° 7 de
 * `docs/RULES.md`: el chequeo es sobre `FormaPago` y la mutación sobre
 * `Alumno` (filas distintas, no condición+mutación sobre la misma fila) —
 * mismo criterio ya usado en la verificación de email de
 * `actualizarContactoAlumno()`.
 *
 * Sin evento de dominio: mismo precedente que el resto del módulo (ver
 * Nota de alcance, HU-B-03 §1) — ninguna otra función de este service emite
 * `alumno:*` todavía pese a que `spec_modulo_B.md §4` los documenta.
 */
export async function actualizarFormaPagoPreferida(
  alumnoId: string,
  input: FormaPagoPreferidaInput,
): Promise<{ id: string; forma_pago_preferida_id: string | null }> {
  return prisma.$transaction(async (tx) => {
    // Mismo chequeo previo que actualizarContactoAlumno(): sin esto, un
    // alumnoId inexistente propaga un P2025 sin traducir (500 genérico) en
    // vez de un 404 consistente con el resto del módulo.
    const existente = await tx.alumno.findUnique({
      where: { idAlumno: alumnoId },
      select: { idAlumno: true },
    });
    if (!existente) {
      throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);
    }

    if (input.forma_pago_id !== null) {
      await verificarFormaPagoActiva(tx, input.forma_pago_id);
    }

    const alumno = await tx.alumno.update({
      where: { idAlumno: alumnoId },
      data: { formaPagoPreferidaId: input.forma_pago_id },
      select: { idAlumno: true, formaPagoPreferidaId: true },
    });

    return { id: alumno.idAlumno, forma_pago_preferida_id: alumno.formaPagoPreferidaId };
  });
}

/**
 * "Provisto" para cada campo editable de `modificarAlumno()` — mismo
 * criterio `camposProvistos` que `actualizarContactoAlumno()` (HU-B-02),
 * extendido a todos los campos del formulario único (HU-B-06 §4.2 punto 6):
 * distingue "la clave no vino en el payload" (no se toca la columna) de
 * "vino provista" (se escribe, incluso si el valor colapsó a `null`/
 * `undefined` — es como el usuario vuelve género a "sin especificar").
 */
export type CamposProvistosModificarAlumno = {
  nombre: boolean;
  apellido: boolean;
  dni: boolean;
  fecha_nacimiento: boolean;
  genero: boolean;
  telefono: boolean;
  email: boolean;
  forma_pago_id: boolean;
};

/**
 * Modificación de datos del alumno (HU-B-06, `spec_modulo_B.md` §2.5,
 * ajustado por el bloqueante de §0/§1 de `docs/tasks/Sprint 1/HU-B-06.md`).
 *
 * Orden de verificación (§4.2 de la task):
 * 1. Existencia de la ficha — para poder distinguir "no existe" de
 *    "edición concurrente" en el `updateMany` final (mismo razonamiento que
 *    la Regla N.° 7: `count === 0` no implica que la fila no exista).
 * 2. DNI: unicidad excluyendo la propia ficha, contra activas e inactivas
 *    (Regla N.° 3.4 de la spec) — doble validación aplicativa + `P2002`,
 *    mismo patrón que `crearAlumno()`. Se reutiliza el código
 *    `DNI_DUPLICADO` de HU-B-01 en vez de introducir uno nuevo
 *    (`DNI_YA_REGISTRADO`) para la misma regla de negocio — unificado a
 *    pedido explícito (ver sección 8 de la task).
 * 3. Email: unicidad contra `Usuario.email` (lectura, mismo patrón que
 *    `actualizarContactoAlumno()`). Si la ficha tiene cuenta vinculada
 *    (`usuarioId` no nulo) y el email efectivamente cambia, se rechaza el
 *    request ENTERO con `EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE` — bloqueante
 *    confirmado: `actualizarEmailCuenta()` no existe en Módulo A, así que no
 *    hay forma de propagar el cambio a `Usuario.email` sin un `UPDATE`
 *    directo sobre esa tabla (prohibido por la Regla N.° 3). Se decidió
 *    rechazo atómico (nada se guarda, ni siquiera el resto de los campos
 *    del payload) en vez de guardar `Alumno.emailAlumno` desincronizado de
 *    `Usuario.email` — mismo criterio de "todo o nada" que ya aplican los
 *    otros tres 409 de este mismo endpoint (`DNI_DUPLICADO`,
 *    `EMAIL_YA_ASOCIADO`, `FORMA_PAGO_NO_DISPONIBLE`), sin introducir un
 *    caso especial de guardado parcial que rompería el contrato `{data,
 *    error}` mutuamente excluyente (Regla N.° 5). Decisión confirmada por
 *    Adriel — ver sección 8 de la task para el detalle completo.
 * 4. Forma de pago: mismo helper `verificarFormaPagoActiva()` que
 *    `actualizarFormaPagoPreferida()`.
 * 5. Concurrencia optimista (Regla N.° 7): condición y mutación en una sola
 *    sentencia (`updateMany` con `version` en el `where`, `increment` en el
 *    `data`) — `count === 0` es `CONFLICTO_EDICION_CONCURRENTE`.
 *
 * Sin evento de dominio (mismo precedente que el resto del módulo, Nota de
 * alcance HU-B-06 §1).
 */
export async function modificarAlumno(
  alumnoId: string,
  input: ModificarAlumnoInput,
  camposProvistos: CamposProvistosModificarAlumno,
  usuarioModificadorId: string,
): Promise<{ id: string; campos_modificados: string[]; version: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.alumno.findUnique({
        where: { idAlumno: alumnoId },
        select: { idAlumno: true, usuarioId: true },
      });
      if (!existente) {
        throw new ServiceError("ALUMNO_NO_ENCONTRADO", MENSAJES.ALUMNO_NO_ENCONTRADO);
      }

      if (camposProvistos.dni && input.dni !== undefined) {
        const otroConDni = await tx.alumno.findFirst({
          where: { dniAlumno: input.dni, NOT: { idAlumno: alumnoId } },
          select: { activoAlumno: true },
        });
        if (otroConDni) {
          throw new ServiceError(
            "DNI_DUPLICADO",
            otroConDni.activoAlumno ? MENSAJES.DNI_DUPLICADO_ACTIVA : MENSAJES.DNI_DUPLICADO_INACTIVA,
          );
        }
      }

      if (camposProvistos.email && input.email !== undefined) {
        const otraCuenta = await tx.usuario.findFirst({
          where: {
            emailUsuario: { equals: input.email, mode: "insensitive" },
            ...(existente.usuarioId ? { NOT: { idUsuario: existente.usuarioId } } : {}),
          },
          select: { idUsuario: true },
        });
        if (otraCuenta) {
          throw new ServiceError("EMAIL_YA_ASOCIADO", MENSAJES.EMAIL_YA_ASOCIADO);
        }

        if (existente.usuarioId) {
          throw new ServiceError(
            "EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE",
            MENSAJES.EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE,
          );
        }
      }

      if (camposProvistos.forma_pago_id && input.forma_pago_id !== null && input.forma_pago_id !== undefined) {
        await verificarFormaPagoActiva(tx, input.forma_pago_id);
      }

      const campos_modificados: string[] = [];
      // Unchecked, no la "checked": formaPagoPreferidaId es un escalar FK
      // que solo aparece en la variante Unchecked del updateMany (la
      // checked solo expone la relación formaPagoPreferida, no su id).
      const data: Prisma.AlumnoUncheckedUpdateManyInput = {
        modificadoPorUsuarioId: usuarioModificadorId,
      };

      if (camposProvistos.nombre && input.nombre !== undefined) {
        data.nombreAlumno = input.nombre;
        data.nombreNormalizadoAlumno = normalizarTexto(input.nombre);
        campos_modificados.push("nombre");
      }
      if (camposProvistos.apellido && input.apellido !== undefined) {
        data.apellidoAlumno = input.apellido;
        data.apellidoNormalizadoAlumno = normalizarTexto(input.apellido);
        campos_modificados.push("apellido");
      }
      if (camposProvistos.dni && input.dni !== undefined) {
        data.dniAlumno = input.dni;
        campos_modificados.push("dni");
      }
      if (camposProvistos.fecha_nacimiento && input.fecha_nacimiento !== undefined) {
        data.fechaNacimientoAlumno = input.fecha_nacimiento;
        campos_modificados.push("fecha_nacimiento");
      }
      if (camposProvistos.genero) {
        data.generoAlumno = input.genero ?? null;
        campos_modificados.push("genero");
      }
      if (camposProvistos.telefono) {
        data.telefonoAlumno = input.telefono ?? null;
        campos_modificados.push("telefono");
      }
      if (camposProvistos.email) {
        data.emailAlumno = input.email ?? null;
        campos_modificados.push("email");
      }
      if (camposProvistos.forma_pago_id) {
        data.formaPagoPreferidaId = input.forma_pago_id ?? null;
        campos_modificados.push("forma_pago_id");
      }

      const resultado = await tx.alumno.updateMany({
        where: { idAlumno: alumnoId, version: input.version },
        data: { ...data, version: { increment: 1 } },
      });

      if (resultado.count === 0) {
        throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE", MENSAJES.CONFLICTO_EDICION_CONCURRENTE);
      }

      return { id: alumnoId, campos_modificados, version: input.version + 1 };
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;

    // Defensa en profundidad (Regla N.° 3.4): si dos requests concurrentes
    // pasan ambos la verificación aplicativa de DNI antes de que cualquiera
    // haga el UPDATE, el constraint único de la base es la garantía real.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("DNI_DUPLICADO", MENSAJES.DNI_DUPLICADO_ACTIVA);
    }

    throw error;
  }
}
