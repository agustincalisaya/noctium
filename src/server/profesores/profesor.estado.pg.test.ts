import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearProfesorDePrueba, crearUsuarioDePrueba, crearTurnoDePrueba, crearMateriaDePrueba, crearAlumnoDePrueba, crearInscripcionDePrueba, crearOperacionDePrueba, abrirCajaDePrueba } from "@/server/testing/fabricas";
import { actorUsuario } from "@/server/shared/historial";
import * as bloqueos from "@/server/shared/bloquear";
import { obtenerImpactoBajaProfesor, desactivarProfesor, reactivarProfesor, cancelarTurnosFuturosDeProfesor, cambiarProfesorDeTurnosFuturos, listarTurnosFuturosParaBaja, previsualizarCambioDeProfesor } from "@/server/profesores/profesor.estado.service";
import { obtenerOpcionProfesorActivo, obtenerNombresProfesores } from "@/server/profesores/profesor.publico";
import { listarHistorialEstados } from "@/server/shared/historial-estados";
import { configurarTurno, asignarParticipantesTurno } from "@/server/turnos/turno.service";
import { reprogramarTurno } from "@/server/turnos/turno.reprogramacion.service";
import { diaSemanaDeFecha } from "@/lib/horario-atencion";

import * as cuentas from "@/server/usuarios/cuenta.service";

// Solo bases descartables, creadas por scripts/test-pg.mjs.
describe.skipIf(!basePgHabilitada)("HU-D-08 PostgreSQL real", () => {
  let db: PrismaClient;
  let gerente: string;
  const alumnosCreados: string[] = [];
  const alumno = async () => { const a = await crearAlumnoDePrueba(db); alumnosCreados.push(a.idAlumno); return a; };
  beforeAll(async () => { db = clientePg(); gerente = (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario; });
  afterAll(async () => {
    // El seed posterior busca el primer alumno activo: estas filas pertenecen a esta suite.
    await db?.alumno.updateMany({ where: { idAlumno: { in: alumnosCreados } }, data: { activoAlumno: false } });
    await db?.$disconnect();
  });
  const actor = () => actorUsuario(gerente);
  const darBaja = (id: string, version = 0, motivo?: string) => desactivarProfesor(id, { version, motivo }, actor());
  const ficha = (id: string) => db.profesor.findUniqueOrThrow({ where: { idProfesor: id } });
  const atender = async (id: string, fecha: Date, desde = "08:00", hasta = "20:00") => db.horarioProfesor.create({ data: { profesorId: id, diaSemanaHorario: diaSemanaDeFecha(fecha), horaDesdeHorario: new Date(`1970-01-01T${desde}:00Z`), horaHastaHorario: new Date(`1970-01-01T${hasta}:00Z`) } });

  it("sin cuenta: baja y reactivación, versión e historial; no pierde DNI ni nombre histórico", async () => {
    const p = await crearProfesorDePrueba(db);
    expect(await obtenerImpactoBajaProfesor(p.idProfesor)).toMatchObject({ motivo_obligatorio: false, tiene_cuenta: false, clases_futuras: { confirmados: 0 } });
    await darBaja(p.idProfesor);
    expect(await obtenerOpcionProfesorActivo(p.idProfesor)).toBeNull();
    expect((await obtenerNombresProfesores([p.idProfesor]))[p.idProfesor]).toBeTruthy();
    await expect(db.profesor.create({ data: { ...p, idProfesor: undefined, activoProfesor: true } })).rejects.toMatchObject({ code: "P2002" });
    await expect(reactivarProfesor(p.idProfesor, { version: 0 }, actor())).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
    await reactivarProfesor(p.idProfesor, { version: 1 }, actor());
    expect((await ficha(p.idProfesor)).version).toBe(2);
    expect(await listarHistorialEstados("PROFESOR", p.idProfesor)).toEqual(expect.arrayContaining([
      expect.objectContaining({ accion: "DESACTIVAR", usuario_id: gerente }), expect.objectContaining({ accion: "REACTIVAR", usuario_id: gerente }),
    ]));
  });
  it("cuenta vinculada: baja atómica, umbral de sesiones y marca conservados al reactivar", async () => {
    const p = await crearProfesorDePrueba(db);
    const u = await crearUsuarioDePrueba(db, { rol: "PROFESOR" });
    await db.usuario.update({ where: { idUsuario: u.idUsuario }, data: { debeCambiarPasswordUsuario: true } });
    await db.profesor.update({ where: { idProfesor: p.idProfesor }, data: { usuarioId: u.idUsuario } });
    await darBaja(p.idProfesor);
    const baja = await db.usuario.findUniqueOrThrow({ where: { idUsuario: u.idUsuario } });
    expect(baja.activoUsuario).toBe(false); expect(baja.sesionesValidasDesdeUsuario).not.toBeNull();
    await reactivarProfesor(p.idProfesor, { version: 1 }, actor());
    const alta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: u.idUsuario } });
    expect(alta.activoUsuario).toBe(true); expect(alta.debeCambiarPasswordUsuario).toBe(true);
    expect(alta.sesionesValidasDesdeUsuario).toEqual(baja.sesionesValidasDesdeUsuario);
  });
  it("futuras bloquean sin cambiar cuenta/versión/historial; pasadas obligan motivo; solo Pendientes permiten baja", async () => {
    const t = await crearTurnoDePrueba(db);
    await expect(darBaja(t.profesorId!)).rejects.toMatchObject({ code: "PROFESOR_CON_CLASES_FUTURAS" });
    expect((await ficha(t.profesorId!)).version).toBe(0);
    expect(await listarHistorialEstados("PROFESOR", t.profesorId!)).toHaveLength(0);
    const pasado = await crearTurnoDePrueba(db, { enDias: -3 });
    await expect(darBaja(pasado.profesorId!)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO" });
    await darBaja(pasado.profesorId!, 0, "Dejó el centro");
    const pendiente = await crearTurnoDePrueba(db, { estado: "PENDIENTE" });
    expect(await darBaja(pendiente.profesorId!)).toMatchObject({ pendientes_afectados: 1 });
    expect((await db.turno.findUniqueOrThrow({ where: { idTurno: pendiente.idTurno } })).estadoTurno).toBe("PENDIENTE");
    await expect(asignarParticipantesTurno(pendiente.idTurno, { alumno_ids: [] }, gerente)).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
  });
  it("paginación/filtros cuentan todas las materias; cancelar conserva inscripciones y no las restaura", async () => {
    const p = await crearProfesorDePrueba(db);
    const m = await crearMateriaDePrueba(db);
    for (let n = 0; n < 11; n++) await crearTurnoDePrueba(db, { profesorId: p.idProfesor, materiaId: m.idMateria, enDias: n + 3 });
    const otra = await crearTurnoDePrueba(db, { profesorId: p.idProfesor, enDias: 20 });
    const lista = await listarTurnosFuturosParaBaja(p.idProfesor, { pagina: 1 });
    expect(lista.items).toHaveLength(10); expect(lista.total).toBe(12); expect(lista.materias).toHaveLength(2);
    expect(lista.seleccion.items).toHaveLength(12);
    expect(lista.seleccion.items[0]).toMatchObject({ materia: { id: m.idMateria }, profesor: { id: p.idProfesor }, estado: "DISPONIBLE", con_pagos: false, inscriptos: 0 });
    const filtrada = await listarTurnosFuturosParaBaja(p.idProfesor, { pagina: 2, materia_id: m.idMateria });
    expect(filtrada.seleccion.items).toHaveLength(11);
    expect(filtrada.seleccion.items.every((t) => t.materia.id === m.idMateria)).toBe(true);
    expect((await listarTurnosFuturosParaBaja(p.idProfesor, { pagina: 2, materia_id: m.idMateria })).items).toHaveLength(1);
    const ins = await crearInscripcionDePrueba(db, { turnoId: otra.idTurno, alumnoId: (await alumno()).idAlumno });
    const { pagos } = await crearOperacionDePrueba(db, { cajaId: (await abrirCajaDePrueba(db)).idCaja, inscripcionIds: [ins.idInscripcion] });
    const antes = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: ins.idInscripcion } });
    const r = await cancelarTurnosFuturosDeProfesor(p.idProfesor, { turno_ids: [otra.idTurno] }, actor());
    expect(r).toMatchObject({ procesadas: 1, canceladas: 1, restantes: { confirmados: 11 } });
    expect(await db.pago.findUniqueOrThrow({ where: { idPago: pagos[0].idPago } })).toEqual(pagos[0]);
    expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: ins.idInscripcion } })).toEqual(antes);
    expect(await db.reservaTurno.count({ where: { turnoId: otra.idTurno } })).toBe(0);
    await expect(cancelarTurnosFuturosDeProfesor(p.idProfesor, { turno_ids: [otra.idTurno, (await crearTurnoDePrueba(db)).idTurno] }, actor())).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
  it("vista previa y cambio parcial: mueve solo compatibles, conserva inscripciones y deja motivo de cada fallo", async () => {
    const origen = await crearProfesorDePrueba(db), destino = await crearProfesorDePrueba(db), m = await crearMateriaDePrueba(db);
    await db.profesorMateria.createMany({ data: [origen, destino].map((p) => ({ profesorId: p.idProfesor, materiaId: m.idMateria })) });
    const t = await crearTurnoDePrueba(db, { profesorId: origen.idProfesor, materiaId: m.idMateria, hora: "10:00" });
    const fuera = await crearTurnoDePrueba(db, { profesorId: origen.idProfesor, materiaId: m.idMateria, hora: "15:00" });
    await atender(destino.idProfesor, t.fechaTurno, "08:00", "12:00");
    const ins = await crearInscripcionDePrueba(db, { turnoId: t.idTurno, alumnoId: (await alumno()).idAlumno });
    const antes = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: ins.idInscripcion } });
    const input = { turno_ids: [t.idTurno, fuera.idTurno], profesor_destino_id: destino.idProfesor };
    expect(await previsualizarCambioDeProfesor(origen.idProfesor, input)).toMatchObject({ se_pueden: 1, no_se_pueden: 1 });
    expect(await cambiarProfesorDeTurnosFuturos(origen.idProfesor, input, actor())).toMatchObject({ procesadas: 1, cambiadas: 1, no_procesadas: [{ turno_id: fuera.idTurno, code: "PROFESOR_FUERA_DE_HORARIO" }] });
    expect((await db.turno.findUniqueOrThrow({ where: { idTurno: t.idTurno } })).profesorId).toBe(destino.idProfesor);
    expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: ins.idInscripcion } })).toEqual(antes);
    expect(await db.reservaTurno.count({ where: { turnoId: t.idTurno, recursoId: destino.idProfesor, tipoRecurso: "PROFESOR" } })).toBe(1);
  });

  it("un fallo posterior a inactivar la cuenta revierte ficha, cuenta y revocación", async () => {
    const p = await crearProfesorDePrueba(db), u = await crearUsuarioDePrueba(db, { rol: "PROFESOR" });
    await db.profesor.update({ where: { idProfesor: p.idProfesor }, data: { usuarioId: u.idUsuario } });
    const original = cuentas.desactivarCuenta;
    const fallo = vi.spyOn(cuentas, "desactivarCuenta").mockImplementationOnce(async (tx, id) => { await original(tx, id); throw new Error("fallo inyectado después de cuenta"); });
    try { await expect(darBaja(p.idProfesor)).rejects.toThrow("fallo inyectado"); } finally { fallo.mockRestore(); }
    expect(await ficha(p.idProfesor)).toMatchObject({ activoProfesor: true, version: 0 });
    expect(await db.usuario.findUniqueOrThrow({ where: { idUsuario: u.idUsuario } })).toMatchObject({ activoUsuario: true, sesionesValidasDesdeUsuario: null });
    expect(await listarHistorialEstados("PROFESOR", p.idProfesor)).toHaveLength(0);
  });
  it("baja real contra reprogramación simultánea no deja futuras con profesor inactivo", async () => {
    const t = await crearTurnoDePrueba(db, { enDias: -3 });
    const futuro = new Date(t.fechaTurno); futuro.setUTCDate(futuro.getUTCDate() + 10);
    await atender(t.profesorId!, futuro);
    const rs = await Promise.allSettled([darBaja(t.profesorId!, 0, "Dejó el centro"), reprogramarTurno(t.idTurno, { fecha: futuro, hora_inicio: "11:00" }, gerente)]);
    expect(rs.some((r) => r.status === "fulfilled")).toBe(true);
    const actual = await ficha(t.profesorId!);
    const impacto = actual.activoProfesor ? await obtenerImpactoBajaProfesor(t.profesorId!) : null;
    if (!actual.activoProfesor) expect((await db.turno.findUniqueOrThrow({ where: { idTurno: t.idTurno } })).fechaTurno).toEqual(t.fechaTurno);
    else expect(impacto?.clases_futuras.confirmados).toBe(1);
  });
  it("dos bajas simultáneas: una confirma y solo se escribe un historial", async () => {
    const p = await crearProfesorDePrueba(db);
    const rs = await Promise.allSettled([darBaja(p.idProfesor), darBaja(p.idProfesor)]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listarHistorialEstados("PROFESOR", p.idProfesor)).toHaveLength(1);
  });
  it("baja serializa creación y confirmación: una operación esperando no puede usar al profesor inactivo", async () => {
    const p = await crearProfesorDePrueba(db), m = await crearMateriaDePrueba(db);
    const t = await crearTurnoDePrueba(db, { profesorId: p.idProfesor, materiaId: m.idMateria, estado: "PENDIENTE" });
    await db.profesorMateria.create({ data: { profesorId: p.idProfesor, materiaId: m.idMateria } });
    await atender(p.idProfesor, t.fechaTurno);
    let soltar!: () => void, tomado!: () => void;
    const listo = new Promise<void>((r) => { tomado = r; }), espera = new Promise<void>((r) => { soltar = r; });
    const original = bloqueos.bloquear;
    let primera = true;
    const pausa = vi.spyOn(bloqueos, "bloquear").mockImplementation(async (tx, input) => {
      await original(tx, input);
      if (primera) { primera = false; tomado(); await espera; }
    });
    const baja = darBaja(p.idProfesor);
    await listo;
    const crear = configurarTurno({ materia_id: m.idMateria, profesor_id: p.idProfesor, fecha: t.fechaTurno, hora_inicio: "11:00", duracion_min: 60 }, gerente);
    const confirmar = asignarParticipantesTurno(t.idTurno, { alumno_ids: [] }, gerente);
    // Attach rejection handlers immediately; both operations wait on the same resource.
    const resultados = Promise.allSettled([crear, confirmar]); soltar();
    try { await baja; } finally { pausa.mockRestore(); }
    expect((await resultados).every((r) => r.status === "rejected" && r.reason.code === "PROFESOR_NO_ENCONTRADO")).toBe(true);
    expect(await db.turno.count({ where: { profesorId: p.idProfesor, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } } })).toBe(0);
  });
  it("reprogramación con profesor inactivo se rechaza bajo bloqueo", async () => {
    const t = await crearTurnoDePrueba(db);
    await db.profesor.update({ where: { idProfesor: t.profesorId! }, data: { activoProfesor: false } });
    await expect(reprogramarTurno(t.idTurno, { fecha: t.fechaTurno, hora_inicio: "11:00" }, gerente)).rejects.toMatchObject({ code: "PROFESOR_INACTIVO" });
    expect((await db.turno.findUniqueOrThrow({ where: { idTurno: t.idTurno } })).horaInicioTurno).toEqual(t.horaInicioTurno);
  });
});
