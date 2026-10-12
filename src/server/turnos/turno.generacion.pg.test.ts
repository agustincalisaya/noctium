import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, type EstadoTurno } from "@prisma/client";
import { diaSemanaDeFecha } from "@/lib/horario-atencion";
import { GenerarTurnosSchema } from "./turno.generacion.schema";
import { confirmarGeneracion, vistaPreviaGeneracion } from "./turno.generacion.service";
import { aulasLibresEnFechas } from "./turno.generacion.aulas";
import { aulaConTurnoSuperpuesto } from "./turno.disponibilidad";
import { listarAulasActivasParaTurno } from "@/server/aulas/aula.publico";

vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (_accion: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) =>
    (req: NextRequest) => handler(Object.assign(req, { auth: { user: { id: "usuario-http" } } }), { params: Promise.resolve({}) }),
}));
const { POST: confirmarPorHttp } = await import("@/app/api/turnos/generacion/route");

// Nunca ejecutar contra la base habitual: requiere URL idéntica y nombre temporal C-17.
const url = process.env.HU_C17_TEST_DATABASE_URL;
const habilitada = Boolean(url && process.env.DATABASE_URL === url && new URL(url).pathname.includes("hu_c17_fase3"));
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgc17${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);

function primerLunesFuturo() {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)!.value);
  const fecha = new Date(Date.UTC(valor("year"), valor("month") - 1, valor("day")));
  fecha.setUTCDate(fecha.getUTCDate() + (7 - fecha.getUTCDay() + 1) % 7 + 7);
  return fecha;
}
const lunes = primerLunesFuturo();
const lunesN = (n: number) => new Date(lunes.getTime() + n * 7 * 86400000);

type Fixture = { materiaId: string; otraMateriaId: string; profesorId: string; otroProfesorId: string; aulaId: string; otraAulaId: string; horarioId: string; usuarioId: string };
let fixture: Fixture;
let secuencia = 0;

async function crearFixture(): Promise<Fixture> {
  const sufijo = `${prefijo}${++secuencia}`;
  const materia = await db!.materia.create({ data: { nombreMateria: `Materia ${sufijo}`, nombreNormalizadaMateria: `materia ${sufijo}` } });
  const otraMateria = await db!.materia.create({ data: { nombreMateria: `Otra ${sufijo}`, nombreNormalizadaMateria: `otra ${sufijo}` } });
  const profesor = await db!.profesor.create({ data: { nombreProfesor: "Prueba", apellidoProfesor: sufijo, nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: sufijo, dniProfesor: `${sufijo}p`, fechaNacimientoProfesor: new Date("1990-01-01T00:00:00.000Z") } });
  const otroProfesor = await db!.profesor.create({ data: { nombreProfesor: "Prueba", apellidoProfesor: `${sufijo}o`, nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: `${sufijo}o`, dniProfesor: `${sufijo}q`, fechaNacimientoProfesor: new Date("1990-01-01T00:00:00.000Z") } });
  await db!.profesorMateria.createMany({ data: [
    { profesorId: profesor.idProfesor, materiaId: materia.idMateria },
    { profesorId: profesor.idProfesor, materiaId: otraMateria.idMateria },
    { profesorId: otroProfesor.idProfesor, materiaId: materia.idMateria },
  ] });
  const nombreAula = `C17 ${sufijo.slice(-12)} A`;
  const nombreOtraAula = `C17 ${sufijo.slice(-12)} B`;
  const aula = await db!.aula.create({ data: { nombreAula, nombreNormalizadaAula: nombreAula.toLowerCase(), capacidadAula: 17 } });
  const otraAula = await db!.aula.create({ data: { nombreAula: nombreOtraAula, nombreNormalizadaAula: nombreOtraAula.toLowerCase(), capacidadAula: 19 } });
  const horario = await db!.horarioProfesor.create({ data: { profesorId: profesor.idProfesor, diaSemanaHorario: diaSemanaDeFecha(lunes), horaDesdeHorario: hora("08:00"), horaHastaHorario: hora("18:00") } });
  return { materiaId: materia.idMateria, otraMateriaId: otraMateria.idMateria, profesorId: profesor.idProfesor, otroProfesorId: otroProfesor.idProfesor, aulaId: aula.idAula, otraAulaId: otraAula.idAula, horarioId: horario.idHorario, usuarioId: `${sufijo}-usuario` };
}

function entrada(cantidad = 1, inicio = "10:00") {
  return GenerarTurnosSchema.parse({
    materia_id: fixture.materiaId, profesor_id: fixture.profesorId, horario_id: fixture.horarioId,
    duracion_min: 120, hora_inicio: inicio, aula_id: fixture.aulaId,
    fecha_desde: iso(lunesN(0)), fecha_hasta: iso(lunesN(cantidad - 1)),
  });
}

async function crearTurnoExistente(n: number, estado: EstadoTurno, opciones: {
  materiaId?: string; profesorId?: string; aulaId?: string; inicio?: string; duracion?: number;
} = {}) {
  return db!.turno.create({ data: {
    fechaTurno: lunesN(n), horaInicioTurno: hora(opciones.inicio ?? "10:00"),
    duracionMinutosTurno: opciones.duracion ?? 120, cupoMaximoTurno: 17,
    materiaId: opciones.materiaId ?? fixture.materiaId,
    profesorId: opciones.profesorId ?? fixture.profesorId,
    aulaId: opciones.aulaId ?? fixture.aulaId,
    estadoTurno: estado, creadoPorUsuarioId: "fixture",
  } });
}

async function ningunaEscrituraGenerada(reservasAntes: number) {
  expect(await db!.turno.count({ where: { creadoPorUsuarioId: fixture.usuarioId } })).toBe(0);
  expect(await db!.reservaTurno.count({ where: { recursoId: { in: [fixture.profesorId, fixture.aulaId] } } })).toBe(reservasAntes);
}

describe.skipIf(!habilitada)("HU-C-17 Fase 3: PostgreSQL temporal aislado", () => {
  beforeAll(async () => {
    await db!.parametroSistema.upsert({ where: { clave: "generacion_maxima_meses" }, update: { valor: "6" }, create: { clave: "generacion_maxima_meses", valor: "6" } });
    await db!.parametroSistema.upsert({ where: { clave: "generacion_maxima_turnos" }, update: { valor: "40" }, create: { clave: "generacion_maxima_turnos", valor: "40" } });
    for (const [clave, valor] of Object.entries({ dias_operativos: "LUNES,MARTES,MIERCOLES,JUEVES,VIERNES", horario_operativo_desde: "08:00", horario_operativo_hasta: "20:00", granularidad_turno_minutos: "30" })) {
      await db!.parametroSistema.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
    }
  });
  beforeEach(async () => { fixture = await crearFixture(); });
  afterAll(async () => { await db?.$disconnect(); });

  it.each([1, 3])("genera %i ocurrencia(s) DISPONIBLE con cupo, reservas, auditoría y eventos", async (cantidad) => {
    const resultado = await confirmarGeneracion(entrada(cantidad), fixture.usuarioId);
    expect(resultado).toMatchObject({ cantidad, turno_ids: expect.any(Array), generacion_id: expect.any(String) });
    expect(resultado.turno_ids).toHaveLength(cantidad);
    expect(resultado.generacion_id).toBe(resultado.turno_ids[0]);
    expect(resultado.generacion_id).toMatch(/^c[a-z0-9]+$/);
    const turnos = await db!.turno.findMany({ where: { idTurno: { in: resultado.turno_ids } }, orderBy: { fechaTurno: "asc" }, include: { alumnos: true, reservas: true } });
    expect(turnos).toHaveLength(cantidad);
    for (const [indice, turno] of turnos.entries()) {
      expect(turno).toMatchObject({ fechaTurno: lunesN(indice), estadoTurno: "DISPONIBLE", prioridadTurno: "NORMAL", cupoMaximoTurno: 17,
        materiaId: fixture.materiaId, profesorId: fixture.profesorId, aulaId: fixture.aulaId, creadoPorUsuarioId: fixture.usuarioId });
      expect(turno.createdAtTurno).toBeInstanceOf(Date);
      expect(turno.updatedAtTurno).toBeInstanceOf(Date);
      expect(turno.alumnos).toEqual([]);
      expect(turno.reservas.map((reserva) => reserva.tipoRecurso).sort()).toEqual(["AULA", "PROFESOR"]);
    }
    const eventos = await db!.eventoTurno.findMany({ where: { turnoId: { in: resultado.turno_ids } }, orderBy: { creadoEnEvento: "asc" } });
    expect(eventos).toHaveLength(3 * cantidad);
    for (const id of resultado.turno_ids) {
      const delTurno = eventos.filter((evento) => evento.turnoId === id);
      expect(delTurno.map((evento) => evento.tipoEvento).sort()).toEqual(["turno:aula_asignada", "turno:configurado", "turno:disponibilizado"]);
      expect(delTurno.find((evento) => evento.tipoEvento === "turno:configurado")?.payloadEvento).toMatchObject({ generacion_id: resultado.generacion_id, usuario_id: fixture.usuarioId });
      expect(delTurno.find((evento) => evento.tipoEvento === "turno:disponibilizado")?.payloadEvento).toMatchObject({ alumno_ids: [] });
    }
  });

  it.each([0, 1, 2])("conflicto en posición %i impide todo INSERT y toda reserva parcial", async (indice) => {
    await crearTurnoExistente(indice, "PENDIENTE");
    const reservasAntes = await db!.reservaTurno.count({ where: { recursoId: { in: [fixture.profesorId, fixture.aulaId] } } });
    const eventosAntes = await db!.eventoTurno.count();
    await expect(confirmarGeneracion(entrada(3), fixture.usuarioId)).rejects.toMatchObject({
      code: "GENERACION_CON_CONFLICTOS", detalles: { cantidad: 3, fechas: expect.arrayContaining([expect.objectContaining({ fecha: iso(lunesN(indice)), estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"] })]) },
    });
    await ningunaEscrituraGenerada(reservasAntes);
    expect(await db!.eventoTurno.count()).toBe(eventosAntes);
  });

  it("recalcula tras preview válida y detecta el conflicto nuevo", async () => {
    const input = entrada(2);
    expect((await vistaPreviaGeneracion(input)).hay_conflictos).toBe(false);
    await crearTurnoExistente(1, "DISPONIBLE");
    await expect(confirmarGeneracion(input, fixture.usuarioId)).rejects.toMatchObject({ code: "GENERACION_CON_CONFLICTOS", detalles: { fechas: expect.arrayContaining([expect.objectContaining({ fecha: iso(lunesN(1)), estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"] })]) } });
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: fixture.usuarioId } })).toBe(0);
  });

  it("toma la capacidad actual del aula aunque haya cambiado después de preview", async () => {
    const input = entrada();
    expect((await vistaPreviaGeneracion(input)).hay_conflictos).toBe(false);
    await db!.aula.update({ where: { idAula: fixture.aulaId }, data: { capacidadAula: 7 } });
    const resultado = await confirmarGeneracion(input, fixture.usuarioId);
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: resultado.turno_ids[0] } })).cupoMaximoTurno).toBe(7);
  });

  it.each(["materia", "profesor", "aula"] as const)("revalida %s después de preview", async (entidad) => {
    const input = entrada();
    expect((await vistaPreviaGeneracion(input)).hay_conflictos).toBe(false);
    if (entidad === "materia") await db!.materia.update({ where: { idMateria: fixture.materiaId }, data: { activaMateria: false } });
    if (entidad === "profesor") await db!.profesor.update({ where: { idProfesor: fixture.profesorId }, data: { activoProfesor: false } });
    if (entidad === "aula") await db!.aula.update({ where: { idAula: fixture.aulaId }, data: { activaAula: false } });
    const codigo = { materia: "MATERIA_NO_DISPONIBLE", profesor: "PROFESOR_NO_ENCONTRADO", aula: "AULA_INACTIVA" }[entidad];
    await expect(confirmarGeneracion(input, fixture.usuarioId)).rejects.toMatchObject({ code: codigo });
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: fixture.usuarioId } })).toBe(0);
  });

  it("permite intervalos contiguos y CANCELADO no bloquea", async () => {
    await crearTurnoExistente(0, "DISPONIBLE", { inicio: "08:00" });
    await crearTurnoExistente(0, "COMPLETO", { inicio: "12:00" });
    await crearTurnoExistente(0, "CANCELADO", { inicio: "10:00" });
    const resultado = await confirmarGeneracion(entrada(), fixture.usuarioId);
    expect(resultado.cantidad).toBe(1);
  });

  it.each([
    ["AULA_OCUPADA", { profesorId: "otro", materiaId: "otra" }],
    ["PROFESOR_OCUPADO", { aulaId: "otra", materiaId: "otra" }],
    ["TURNO_EXISTENTE", {}],
  ] as const)("detecta %s contra reservas y duplicados reales", async (motivo, opciones) => {
    await crearTurnoExistente(0, "DISPONIBLE", {
      ...(opciones.profesorId ? { profesorId: fixture.otroProfesorId } : {}),
      ...(opciones.aulaId ? { aulaId: fixture.otraAulaId } : {}),
      ...(opciones.materiaId ? { materiaId: fixture.otraMateriaId } : {}),
    });
    await expect(confirmarGeneracion(entrada(), fixture.usuarioId)).rejects.toMatchObject({ code: "GENERACION_CON_CONFLICTOS", detalles: { fechas: [{ motivos: [motivo] }] } });
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: fixture.usuarioId } })).toBe(0);
  });

  it("traduce una carrera real 23P01 a HTTP 409 y revierte el lote completo", async () => {
    let avisarInsercion!: (pid: number) => void;
    let liberarBloqueo!: () => void;
    const insertado = new Promise<number>((resolver) => { avisarInsercion = resolver; });
    const bloqueo = new Promise<void>((resolver) => { liberarBloqueo = resolver; });
    const bloqueador = db!.$transaction(async (tx) => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.turno.create({ data: {
        fechaTurno: lunesN(1), horaInicioTurno: hora("10:00"), duracionMinutosTurno: 120,
        cupoMaximoTurno: 17, materiaId: fixture.otraMateriaId, profesorId: fixture.otroProfesorId,
        aulaId: fixture.aulaId, estadoTurno: "DISPONIBLE", creadoPorUsuarioId: "bloqueador",
      } });
      avisarInsercion(pid);
      await bloqueo;
    }, { timeout: 15_000 });
    const pidBloqueador = await insertado;
    const input = entrada(2);
    const respuestaPendiente = confirmarPorHttp(new NextRequest("http://localhost/api/turnos/generacion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materia_id: input.materia_id, profesor_id: input.profesor_id, horario_id: input.horario_id,
        duracion_min: input.duracion_min, hora_inicio: input.hora_inicio, aula_id: input.aula_id,
        fecha_desde: iso(input.fecha_desde), fecha_hasta: iso(input.fecha_hasta),
      }),
    }), { params: Promise.resolve({}) });
    try {
      const limite = Date.now() + 8_000;
      let esperando = false;
      while (Date.now() < limite) {
        const [fila] = await db!.$queryRaw<{ total: bigint }[]>`
          SELECT count(*) AS total FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> ${pidBloqueador}
            AND wait_event_type = 'Lock' AND query ILIKE '%turnos%'
        `;
        if (fila!.total > 0n) { esperando = true; break; }
        await new Promise((resolver) => setTimeout(resolver, 30));
      }
      expect(esperando).toBe(true);
    } finally {
      liberarBloqueo();
    }
    await bloqueador;
    const respuesta = await respuestaPendiente;
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "GENERACION_CON_CONFLICTOS" } });
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: "usuario-http", materiaId: fixture.materiaId } })).toBe(0);
    expect(await db!.reservaTurno.count({ where: { recursoId: fixture.profesorId } })).toBe(0);
    expect(await db!.reservaTurno.count({ where: { recursoId: fixture.aulaId } })).toBe(1);
  });

  it("un fallo al emitir eventos después del COMMIT no deshace turnos ni reservas", async () => {
    await db!.$executeRawUnsafe(`
      CREATE FUNCTION c17_fallar_evento() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fallo de evento C17'; END $$
    `);
    await db!.$executeRawUnsafe(`CREATE TRIGGER c17_fallar_evento BEFORE INSERT ON "eventos_turno" FOR EACH ROW EXECUTE FUNCTION c17_fallar_evento()`);
    try {
      await expect(confirmarGeneracion(entrada(), fixture.usuarioId)).rejects.toThrow("fallo de evento C17");
      const turnos = await db!.turno.findMany({ where: { creadoPorUsuarioId: fixture.usuarioId }, include: { reservas: true } });
      expect(turnos).toHaveLength(1);
      expect(turnos[0]).toMatchObject({ estadoTurno: "DISPONIBLE", reservas: [{}, {}] });
      expect(await db!.eventoTurno.count({ where: { turnoId: turnos[0]!.idTurno } })).toBe(0);
    } finally {
      await db!.$executeRawUnsafe(`DROP TRIGGER c17_fallar_evento ON "eventos_turno"`);
      await db!.$executeRawUnsafe(`DROP FUNCTION c17_fallar_evento()`);
    }
  });
});

describe.skipIf(!habilitada)("HU-C-21 Fase 2: PostgreSQL temporal aislado", () => {
  beforeEach(async () => { fixture = await crearFixture(); });

  it("la lectura agrupada de aulas libres coincide con aulaConTurnoSuperpuesto", async () => {
    const martes = new Date(lunesN(4).getTime() + 86400000);
    await crearTurnoExistente(0, "DISPONIBLE", { inicio: "11:00" }); // superpuesto: ocupa
    await crearTurnoExistente(1, "DISPONIBLE", { inicio: "12:00" }); // contiguo después: no ocupa
    await crearTurnoExistente(1, "COMPLETO", { inicio: "08:00" }); // contiguo antes: no ocupa
    await crearTurnoExistente(2, "PENDIENTE"); // no reserva el aula
    await crearTurnoExistente(2, "COMPLETO", { aulaId: fixture.otraAulaId, materiaId: fixture.otraMateriaId }); // ocupa la otra aula
    await crearTurnoExistente(3, "CANCELADO");
    await db!.turno.create({ data: { // otra fecha, mismo horario y aula
      fechaTurno: martes, horaInicioTurno: hora("10:00"), duracionMinutosTurno: 120, cupoMaximoTurno: 17,
      materiaId: fixture.materiaId, profesorId: fixture.profesorId, aulaId: fixture.aulaId, estadoTurno: "DISPONIBLE", creadoPorUsuarioId: "fixture",
    } });

    const fechas = [0, 1, 2, 3, 4].map(lunesN);
    const libres = await aulasLibresEnFechas(db!, fechas, "10:00", 120);
    const activas = await listarAulasActivasParaTurno(1);
    expect(activas.map(({ id }) => id)).toEqual(expect.arrayContaining([fixture.aulaId, fixture.otraAulaId]));
    for (const fechaTurno of fechas) {
      const turno = { fechaTurno, horaInicioTurno: hora("10:00"), duracionMinutosTurno: 120 };
      for (const aula of activas) {
        const ocupada = await aulaConTurnoSuperpuesto(db!, turno, aula.id);
        expect(libres.get(iso(fechaTurno))!.some(({ id }) => id === aula.id), `${iso(fechaTurno)} ${aula.nombre}`).toBe(!ocupada);
      }
    }
    const libre = (n: number, aulaId: string) => libres.get(iso(lunesN(n)))!.some(({ id }) => id === aulaId);
    expect([0, 1, 2, 3, 4].map((n) => libre(n, fixture.aulaId))).toEqual([false, true, true, true, true]);
    expect([0, 1, 2, 3, 4].map((n) => libre(n, fixture.otraAulaId))).toEqual([true, true, false, true, true]);
  });

  it("la vista previa usa el aula y el cupo de cada fecha y no consulta las excluidas", async () => {
    await crearTurnoExistente(1, "DISPONIBLE", { profesorId: fixture.otroProfesorId, materiaId: fixture.otraMateriaId });
    const sinCambios = await vistaPreviaGeneracion(entrada(3));
    expect(sinCambios.fechas[1]).toMatchObject({ estado: "CONFLICTO", motivos: ["AULA_OCUPADA"], solo_excluible: false, sin_aulas_libres: false });

    const input = GenerarTurnosSchema.parse({
      materia_id: fixture.materiaId, profesor_id: fixture.profesorId, horario_id: fixture.horarioId,
      duracion_min: 120, hora_inicio: "10:00", aula_id: fixture.aulaId,
      fecha_desde: iso(lunesN(0)), fecha_hasta: iso(lunesN(2)),
      aulas_por_fecha: [{ fecha: iso(lunesN(1)), aula_id: fixture.otraAulaId }], fechas_excluidas: [iso(lunesN(2))],
    });
    const resultado = await vistaPreviaGeneracion(input);
    expect(resultado).toMatchObject({ cantidad: 3, cantidad_incluida: 2, con_aula_cambiada: 1, excluidas: 1, hay_conflictos: false });
    expect(resultado.fechas[0]).toMatchObject({ aula: { id: fixture.aulaId }, aula_cambiada: false, cupo: 17, cupo_aula_por_defecto: 17 });
    expect(resultado.fechas[1]).toMatchObject({ estado: "OK", aula: { id: fixture.otraAulaId }, aula_cambiada: true, cupo: 19, cupo_aula_por_defecto: 17 });
    expect(resultado.fechas[2]).toMatchObject({ estado: "OK", motivos: [], excluida: true });
  });
});

describe.skipIf(!habilitada)("HU-C-21 Fase 3: confirmación con aula por fecha (PostgreSQL)", () => {
  beforeEach(async () => { fixture = await crearFixture(); });

  // Lunes 0 y 3 con el aula por defecto (17), lunes 1 con la otra aula (19) y lunes 2 excluido.
  const conListas = () => GenerarTurnosSchema.parse({
    materia_id: fixture.materiaId, profesor_id: fixture.profesorId, horario_id: fixture.horarioId,
    duracion_min: 120, hora_inicio: "10:00", aula_id: fixture.aulaId,
    fecha_desde: iso(lunesN(0)), fecha_hasta: iso(lunesN(3)),
    aulas_por_fecha: [{ fecha: iso(lunesN(1)), aula_id: fixture.otraAulaId }], fechas_excluidas: [iso(lunesN(2))],
  });
  const reservasDeLasAulas = () => db!.reservaTurno.count({ where: { recursoId: { in: [fixture.profesorId, fixture.aulaId, fixture.otraAulaId] } } });

  it("crea cada clase con su aula y su cupo, no crea las excluidas y reserva el aula de cada fecha (puntos 1 a 4)", async () => {
    await crearTurnoExistente(1, "DISPONIBLE", { profesorId: fixture.otroProfesorId, materiaId: fixture.otraMateriaId }); // ocupa el aula por defecto el lunes 1
    const resultado = await confirmarGeneracion(conListas(), fixture.usuarioId);
    expect(resultado).toMatchObject({ cantidad: 3, aulas_cambiadas: 1, fechas_excluidas: 1 });

    const turnos = await db!.turno.findMany({ where: { creadoPorUsuarioId: fixture.usuarioId }, orderBy: { fechaTurno: "asc" }, include: { alumnos: true, reservas: true } });
    expect(turnos.map(({ idTurno }) => idTurno).sort()).toEqual([...resultado.turno_ids].sort());
    expect(turnos.map((turno) => [iso(turno.fechaTurno), turno.aulaId, turno.cupoMaximoTurno, turno.estadoTurno])).toEqual([
      [iso(lunesN(0)), fixture.aulaId, 17, "DISPONIBLE"],
      [iso(lunesN(1)), fixture.otraAulaId, 19, "DISPONIBLE"],
      [iso(lunesN(3)), fixture.aulaId, 17, "DISPONIBLE"],
    ]);
    for (const turno of turnos) {
      expect(turno.alumnos).toEqual([]);
      expect(turno.reservas.map(({ tipoRecurso, recursoId }) => [tipoRecurso, recursoId]).sort()).toEqual([["AULA", turno.aulaId], ["PROFESOR", fixture.profesorId]]);
    }
    // Punto 2: la fecha excluida no tiene clase ni reservas propias.
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: fixture.usuarioId, fechaTurno: lunesN(2) } })).toBe(0);
    expect(await db!.reservaTurno.count({ where: { recursoId: { in: [fixture.profesorId, fixture.aulaId, fixture.otraAulaId] }, turno: { fechaTurno: lunesN(2) } } })).toBe(0);

    // Puntos 1 y 4: mismo generacion_id y eventos con el aula y el cupo de cada clase.
    const eventos = await db!.eventoTurno.findMany({ where: { turnoId: { in: resultado.turno_ids } } });
    expect(eventos).toHaveLength(9);
    for (const turno of turnos) {
      const payload = (tipo: string) => eventos.find((evento) => evento.turnoId === turno.idTurno && evento.tipoEvento === tipo)?.payloadEvento;
      expect(payload("turno:configurado")).toMatchObject({ generacion_id: resultado.generacion_id });
      expect(payload("turno:aula_asignada")).toMatchObject({ aula_id: turno.aulaId, cupo_maximo: turno.cupoMaximoTurno });
      expect(payload("turno:disponibilizado")).toMatchObject({ aula_id: turno.aulaId, alumno_ids: [] });
    }
  });

  it("un aula elegida ocupada al confirmar no inserta nada (punto 5)", async () => {
    await crearTurnoExistente(1, "DISPONIBLE", { profesorId: fixture.otroProfesorId, materiaId: fixture.otraMateriaId, aulaId: fixture.otraAulaId });
    const reservasAntes = await reservasDeLasAulas();
    const eventosAntes = await db!.eventoTurno.count();
    await expect(confirmarGeneracion(conListas(), fixture.usuarioId)).rejects.toMatchObject({
      code: "GENERACION_CON_CONFLICTOS",
      detalles: { hay_conflictos: true, fechas: expect.arrayContaining([expect.objectContaining({ fecha: iso(lunesN(1)), motivos: ["AULA_OCUPADA"], aula_cambiada: true })]) },
    });
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: fixture.usuarioId } })).toBe(0);
    expect(await reservasDeLasAulas()).toBe(reservasAntes);
    expect(await db!.eventoTurno.count()).toBe(eventosAntes);
  });

  it("carrera real sobre un aula elegida: 23P01 → 409 sin filas nuevas (punto 6)", async () => {
    let avisarInsercion!: (pid: number) => void;
    let liberarBloqueo!: () => void;
    const insertado = new Promise<number>((resolver) => { avisarInsercion = resolver; });
    const bloqueo = new Promise<void>((resolver) => { liberarBloqueo = resolver; });
    const bloqueador = db!.$transaction(async (tx) => {
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.turno.create({ data: {
        fechaTurno: lunesN(1), horaInicioTurno: hora("10:00"), duracionMinutosTurno: 120,
        cupoMaximoTurno: 19, materiaId: fixture.otraMateriaId, profesorId: fixture.otroProfesorId,
        aulaId: fixture.otraAulaId, estadoTurno: "DISPONIBLE", creadoPorUsuarioId: "bloqueador",
      } });
      avisarInsercion(pid);
      await bloqueo;
    }, { timeout: 15_000 });
    const pidBloqueador = await insertado;
    const respuestaPendiente = confirmarPorHttp(new NextRequest("http://localhost/api/turnos/generacion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materia_id: fixture.materiaId, profesor_id: fixture.profesorId, horario_id: fixture.horarioId,
        duracion_min: 120, hora_inicio: "10:00", aula_id: fixture.aulaId,
        fecha_desde: iso(lunesN(0)), fecha_hasta: iso(lunesN(3)),
        aulas_por_fecha: [{ fecha: iso(lunesN(1)), aula_id: fixture.otraAulaId }], fechas_excluidas: [iso(lunesN(2))],
      }),
    }), { params: Promise.resolve({}) });
    try {
      const limite = Date.now() + 8_000;
      let esperando = false;
      while (Date.now() < limite) {
        const [fila] = await db!.$queryRaw<{ total: bigint }[]>`
          SELECT count(*) AS total FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> ${pidBloqueador}
            AND wait_event_type = 'Lock' AND query ILIKE '%turnos%'
        `;
        if (fila!.total > 0n) { esperando = true; break; }
        await new Promise((resolver) => setTimeout(resolver, 30));
      }
      expect(esperando).toBe(true);
    } finally {
      liberarBloqueo();
    }
    await bloqueador;
    const respuesta = await respuestaPendiente;
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "GENERACION_CON_CONFLICTOS" } });
    expect(await db!.turno.count({ where: { creadoPorUsuarioId: "usuario-http", materiaId: fixture.materiaId } })).toBe(0);
    expect(await db!.reservaTurno.count({ where: { recursoId: fixture.profesorId } })).toBe(0);
    expect(await db!.reservaTurno.count({ where: { recursoId: fixture.aulaId } })).toBe(0);
    expect(await db!.reservaTurno.count({ where: { recursoId: fixture.otraAulaId } })).toBe(1);
  });
});
