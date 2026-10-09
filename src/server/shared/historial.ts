import { randomUUID } from "node:crypto";
import type {
  AccionHistorialEstado,
  ActorTipo,
  EntidadHistorialEstado,
  EstadoPagoInscripcion,
  Prisma,
  PrismaClient,
  TipoEventoSeguridad,
  VigenciaInscripcion,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { despuesDelCommit, type Tx } from "@/server/shared/transaccion";

/**
 * Historial único (PR-0.md §2.10 y §2.16, Regla N.° 2 opción b): un solo
 * mecanismo para escribir los registros de trazabilidad que van en tablas
 * propias —transiciones de la inscripción, bajas y reactivaciones, eventos de
 * turno y eventos de seguridad—, con el id generado ANTES del commit
 * (idempotente: un reintento con el mismo id no duplica) y hasta 3 reintentos.
 */

/** Actor de una operación: un usuario o el «Proceso automático» (PR-0.md §2.1). */
export type ActorDominio = { tipo: "USUARIO"; usuarioId: string } | { tipo: "PROCESO_AUTOMATICO" };

export const PROCESO_AUTOMATICO: ActorDominio = { tipo: "PROCESO_AUTOMATICO" };
export const actorUsuario = (usuarioId: string): ActorDominio => ({ tipo: "USUARIO", usuarioId });

/** Columnas `actorTipo` + `…UsuarioId` coherentes con el CHECK de la migración. */
export function columnasActor(actor: ActorDominio): { actorTipo: ActorTipo; usuarioId: string | null } {
  return actor.tipo === "USUARIO"
    ? { actorTipo: "USUARIO", usuarioId: actor.usuarioId }
    : { actorTipo: "PROCESO_AUTOMATICO", usuarioId: null };
}

export type DatosHistorial =
  | {
    tipo: "INSCRIPCION";
    inscripcionId: string;
    vigenciaAnterior: VigenciaInscripcion | null;
    vigenciaNueva: VigenciaInscripcion;
    estadoPagoAnterior: EstadoPagoInscripcion | null;
    estadoPagoNuevo: EstadoPagoInscripcion;
    actor: ActorDominio;
    fecha: Date;
  }
  | {
    tipo: "ESTADO";
    entidad: EntidadHistorialEstado;
    entidadId: string;
    accion: AccionHistorialEstado;
    motivo?: string | null;
    actor: ActorDominio;
    fecha: Date;
  }
  | { tipo: "EVENTO_TURNO"; tipoEvento: string; turnoId: string; usuarioId: string; payload: Record<string, unknown> }
  | { tipo: "EVENTO_SEGURIDAD"; tipoEvento: TipoEventoSeguridad; usuarioId: string | null; email: string | null; ip: string };

export type RegistroHistorial = DatosHistorial & { id: string };

/** Fija el id del registro. Se llama antes del commit (lo hace `encolarHistorial`). */
export function prepararHistorial(datos: DatosHistorial): RegistroHistorial {
  return { ...datos, id: randomUUID() };
}

type Escritor = Pick<PrismaClient, "historialInscripcion" | "historialEstado" | "eventoTurno" | "eventoSeguridad"> | Tx;

/** Una escritura idempotente: `skipDuplicates` hace que repetir el mismo id no haga nada. */
async function escribir(db: Escritor, registro: RegistroHistorial): Promise<void> {
  switch (registro.tipo) {
    case "INSCRIPCION": {
      const { actorTipo, usuarioId } = columnasActor(registro.actor);
      await db.historialInscripcion.createMany({
        data: [{
          idHistorialInscripcion: registro.id,
          inscripcionId: registro.inscripcionId,
          vigenciaAnterior: registro.vigenciaAnterior,
          vigenciaNueva: registro.vigenciaNueva,
          estadoPagoAnterior: registro.estadoPagoAnterior,
          estadoPagoNuevo: registro.estadoPagoNuevo,
          actorTipo,
          usuarioId,
          fecha: registro.fecha,
        }],
        skipDuplicates: true,
      });
      return;
    }
    case "ESTADO": {
      const { actorTipo, usuarioId } = columnasActor(registro.actor);
      await db.historialEstado.createMany({
        data: [{
          idHistorialEstado: registro.id,
          entidad: registro.entidad,
          entidadId: registro.entidadId,
          accion: registro.accion,
          motivo: registro.motivo ?? null,
          actorTipo,
          usuarioId,
          fecha: registro.fecha,
        }],
        skipDuplicates: true,
      });
      return;
    }
    case "EVENTO_TURNO":
      await db.eventoTurno.createMany({
        data: [{
          idEvento: registro.id,
          tipoEvento: registro.tipoEvento,
          turnoId: registro.turnoId,
          usuarioId: registro.usuarioId,
          payloadEvento: JSON.parse(JSON.stringify(registro.payload)) as Prisma.InputJsonValue,
        }],
        skipDuplicates: true,
      });
      return;
    case "EVENTO_SEGURIDAD":
      await db.eventoSeguridad.createMany({
        data: [{
          idEvento: registro.id,
          tipoEvento: registro.tipoEvento,
          usuarioId: registro.usuarioId,
          emailEvento: registro.email,
          ipEvento: registro.ip,
        }],
        skipDuplicates: true,
      });
  }
}

export type OpcionesHistorial = {
  db?: Escritor;
  /** Reintentos después del primer intento (por defecto 3). */
  reintentos?: number;
  /** Espera antes del reintento n: `esperaMs * 2^(n-1)` (por defecto 100 ms). */
  esperaMs?: number;
};

export const REINTENTOS_HISTORIAL = 3;

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Escribe `registro` con hasta `reintentos` reintentos. Devuelve `true` si
 * quedó escrito. Si falla siempre, registra el error (sin datos sensibles) y
 * devuelve `false`: corre después del commit y no puede deshacer la operación.
 */
export async function registrarHistorial(registro: RegistroHistorial, opciones: OpcionesHistorial = {}): Promise<boolean> {
  const db = opciones.db ?? prisma;
  const reintentos = opciones.reintentos ?? REINTENTOS_HISTORIAL;
  const esperaMs = opciones.esperaMs ?? 100;
  for (let intento = 0; intento <= reintentos; intento++) {
    try {
      await escribir(db, registro);
      return true;
    } catch (error) {
      if (intento === reintentos) {
        console.error("[historial] no se pudo registrar", {
          tipo: registro.tipo,
          id: registro.id,
          intentos: intento + 1,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
      await dormir(esperaMs * 2 ** intento);
    }
  }
  return false;
}

/**
 * Genera ya el id del registro (antes del commit) y encola su escritura en la
 * cola posterior al commit de la transacción. Devuelve el registro preparado.
 */
export function encolarHistorial(tx: Tx, datos: DatosHistorial, opciones?: OpcionesHistorial): RegistroHistorial {
  const registro = prepararHistorial(datos);
  despuesDelCommit(tx, () => registrarHistorial(registro, opciones));
  return registro;
}
