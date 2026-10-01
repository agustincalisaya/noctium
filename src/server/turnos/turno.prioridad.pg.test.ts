import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { actualizarPrioridadTurno } from "./turno.service";

const url = process.env.DATABASE_URL;
const habilitada = Boolean(url && url === process.env.HU_C10_TEST_DATABASE_URL && new URL(url).pathname === "/noctium_test");
const db = habilitada ? new PrismaClient() : null;
const prefijo = `c10pg${Date.now()}`;
const materiaId = `${prefijo}-materia`;
const turnoId = `${prefijo}-turno`;
const usuarioId = `${prefijo}-usuario`;

describe.skipIf(!habilitada)("HU-C-10 en PostgreSQL aislado", () => {
  beforeAll(async () => {
    await db!.materia.create({ data: { idMateria: materiaId, nombreMateria: prefijo, nombreNormalizadaMateria: prefijo } });
    await db!.turno.create({ data: {
      idTurno: turnoId, materiaId, fechaTurno: new Date("2030-10-01T00:00:00.000Z"),
      horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60,
    } });
  });
  afterAll(async () => {
    if (!db) return;
    await db.eventoTurno.deleteMany({ where: { turnoId } });
    await db.turno.deleteMany({ where: { idTurno: turnoId } });
    await db.materia.deleteMany({ where: { idMateria: materiaId } });
    await db.$disconnect();
  });

  it("persiste ALTA y URGENTE con un evento por cambio; no-op no toca fecha ni historial", async () => {
    const inicial = await db!.turno.findUniqueOrThrow({ where: { idTurno: turnoId } });
    expect(inicial.prioridadTurno).toBe("NORMAL");

    await actualizarPrioridadTurno(turnoId, { prioridad: "ALTA" }, usuarioId);
    const alta = await db!.turno.findUniqueOrThrow({ where: { idTurno: turnoId } });
    expect(alta).toMatchObject({ prioridadTurno: "ALTA", modificadoPorUsuarioId: usuarioId, estadoTurno: "PENDIENTE" });
    expect(alta.fechaTurno).toEqual(inicial.fechaTurno);
    expect(await db!.eventoTurno.count({ where: { turnoId, tipoEvento: "turno:prioridad_actualizada" } })).toBe(1);

    expect(await actualizarPrioridadTurno(turnoId, { prioridad: "ALTA" }, usuarioId)).toMatchObject({ sin_cambios: true });
    const sinCambio = await db!.turno.findUniqueOrThrow({ where: { idTurno: turnoId } });
    expect(sinCambio.updatedAtTurno).toEqual(alta.updatedAtTurno);
    expect(await db!.eventoTurno.count({ where: { turnoId } })).toBe(1);

    await actualizarPrioridadTurno(turnoId, { prioridad: "URGENTE" }, usuarioId);
    const eventos = await db!.eventoTurno.findMany({ where: { turnoId }, orderBy: { creadoEnEvento: "asc" } });
    expect(eventos.map((evento) => evento.payloadEvento)).toEqual([
      { turno_id: turnoId, prioridad_anterior: "NORMAL", prioridad_nueva: "ALTA", usuario_id: usuarioId },
      { turno_id: turnoId, prioridad_anterior: "ALTA", prioridad_nueva: "URGENTE", usuario_id: usuarioId },
    ]);
  });

  it("bloquea CANCELADO y conserva prioridad e historial", async () => {
    await db!.turno.update({ where: { idTurno: turnoId }, data: { estadoTurno: "CANCELADO" } });
    await expect(actualizarPrioridadTurno(turnoId, { prioridad: "NORMAL" }, usuarioId)).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: turnoId } })).prioridadTurno).toBe("URGENTE");
    expect(await db!.eventoTurno.count({ where: { turnoId } })).toBe(2);
  });
});
