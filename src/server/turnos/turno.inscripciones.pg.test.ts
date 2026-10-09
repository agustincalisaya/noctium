import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba,
  crearAlumnoDePrueba,
  crearFichaMesaEntradaDePrueba,
  crearInscripcionDePrueba,
  crearMateriaDePrueba,
  crearTurnoDePrueba,
  crearUsuarioDePrueba,
} from "@/server/testing/fabricas";
import { ahora } from "@/server/shared/reloj";
import { agregarAlumnoTurno, quitarAlumnoTurno, solicitarTurnoPropio } from "@/server/turnos/turno.service";
import { registrarPago } from "@/server/pagos/pago.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): los puntos de entrada de los
// Sprints 1 y 2 sobre los servicios de inscripción y cobro del PR 0 (2.0 y
// 2.15). Las reglas que los tests unitarios de turno.inscripciones,
// turno.autoservicio y pago.service simulan con crearInscripcion y
// registrarOperacion se verifican acá, de punta a punta, con los mismos
// códigos, textos y respuestas de hoy.
describe.skipIf(!basePgHabilitada)("inscripción y cobro de Sprint 2 sobre los servicios del PR 0", () => {
  let db: PrismaClient;
  let usuarioId: string;
  const HORA = 60 * 60 * 1000;
  const eventos = async (turnoId: string) =>
    (await db.eventoTurno.findMany({ where: { turnoId }, orderBy: { creadoEnEvento: "asc" } })).map((e) => e.tipoEvento);
  const filas = (turnoId: string) => db.turnoAlumno.findMany({ where: { turnoId }, orderBy: { createdAtInscripcion: "asc" } });
  const reservasDeAlumnos = async (turnoId: string) =>
    (await db.$queryRawUnsafe<{ total: bigint }[]>('SELECT count(*) AS total FROM "reservas_turno" WHERE "turnoId" = $1 AND "tipoRecurso" = $2', turnoId, "ALUMNO"))[0]!.total;

  beforeAll(async () => {
    db = clientePg();
    usuarioId = (await crearUsuarioDePrueba(db)).idUsuario;
  });
  afterAll(async () => { await db?.$disconnect(); });

  describe("HU-C-04 §2.5 agregar alumno", () => {
    it("inscribe sin plazo de pago (PAGO_SIN_REGISTRAR, 2.15), con precio congelado; al llenar el cupo pasa a COMPLETO y rechaza CUPO_INSUFICIENTE", async () => {
      const turno = await crearTurnoDePrueba(db, { cupo: 2 });
      const [a, b, c] = await Promise.all([0, 1, 2].map(() => crearAlumnoDePrueba(db)));
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: a!.idAlumno }, usuarioId))
        .resolves.toEqual({ id: turno.idTurno, alumno_id: a!.idAlumno, alumnos_inscriptos: "1/2", estado: "DISPONIBLE" });
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: b!.idAlumno }, usuarioId))
        .resolves.toMatchObject({ alumnos_inscriptos: "2/2", estado: "COMPLETO" });
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: c!.idAlumno }, usuarioId))
        .rejects.toMatchObject({ code: "CUPO_INSUFICIENTE", message: "El turno alcanzó su cupo máximo" });
      expect((await filas(turno.idTurno)).map((f) => [f.alumnoId, f.vigencia, f.estadoPago, f.precio > 0, f.creadoPorUsuarioId]))
        .toEqual([[a!.idAlumno, "VIGENTE", "PAGO_SIN_REGISTRAR", true, usuarioId], [b!.idAlumno, "VIGENTE", "PAGO_SIN_REGISTRAR", true, usuarioId]]);
      expect((await db.turno.findUniqueOrThrow({ where: { idTurno: turno.idTurno } })).estadoTurno).toBe("COMPLETO");
      expect(await eventos(turno.idTurno)).toEqual(["turno:alumno_agregado", "turno:alumno_agregado", "turno:completado"]);
      expect(await reservasDeAlumnos(turno.idTurno)).toBe(2n);
    });

    it("rechaza turno PENDIENTE, CANCELADO, inexistente y vencido, con los códigos de hoy", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      const agregar = (turnoId: string) => agregarAlumnoTurno(turnoId, { alumno_id: alumno.idAlumno }, usuarioId);
      await expect(agregar((await crearTurnoDePrueba(db, { estado: "PENDIENTE" })).idTurno)).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
      await expect(agregar((await crearTurnoDePrueba(db, { estado: "CANCELADO" })).idTurno)).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
      await expect(agregar("no-existe")).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
      await expect(agregar((await crearTurnoDePrueba(db, { enDias: -1 })).idTurno)).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
      expect(await db.turnoAlumno.count({ where: { alumnoId: alumno.idAlumno } })).toBe(0);
    });

    it("rechaza alumno inactivo, repetido o con turno superpuesto, identificándolo; un turno contiguo no es conflicto", async () => {
      const turno = await crearTurnoDePrueba(db, { enDias: 4, hora: "10:00" });
      const inactivo = await crearAlumnoDePrueba(db, { activo: false });
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: inactivo.idAlumno }, usuarioId))
        .rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno no existe o no está activo", detalles: { alumno_id: inactivo.idAlumno } });
      const alumno = await crearAlumnoDePrueba(db);
      await agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, usuarioId);
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, usuarioId))
        .rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO", message: "El mismo alumno no puede agregarse dos veces al mismo turno", detalles: { alumno_id: alumno.idAlumno } });
      const superpuesto = await crearTurnoDePrueba(db, { enDias: 4, hora: "10:30" });
      await expect(agregarAlumnoTurno(superpuesto.idTurno, { alumno_id: alumno.idAlumno }, usuarioId))
        .rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: alumno.idAlumno } });
      const contiguo = await crearTurnoDePrueba(db, { enDias: 4, hora: "11:00" });
      await expect(agregarAlumnoTurno(contiguo.idTurno, { alumno_id: alumno.idAlumno }, usuarioId)).resolves.toMatchObject({ estado: "DISPONIBLE" });
    });

    it("una reserva vencida sin marcar no retiene cupo: se marca al operar y la clase vuelve a tener lugar (HU-C-24, criterio 2)", async () => {
      const turno = await crearTurnoDePrueba(db, { cupo: 1, enDias: 5 });
      const vencida = await crearInscripcionDePrueba(db, {
        turnoId: turno.idTurno, alumnoId: (await crearAlumnoDePrueba(db)).idAlumno,
        estadoPago: "RESERVADA", reservadaEl: new Date(ahora().getTime() - 30 * HORA), plazoHoras: 24,
      });
      await db.turno.update({ where: { idTurno: turno.idTurno }, data: { estadoTurno: "COMPLETO" } });
      const alumno = await crearAlumnoDePrueba(db);
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, usuarioId)).resolves.toMatchObject({ alumnos_inscriptos: "1/1" });
      expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: vencida.idInscripcion } }))
        .toMatchObject({ vigencia: "RESERVA_VENCIDA", finalizadaPorActorTipo: "PROCESO_AUTOMATICO" });
    });

    it("inscribir en una materia sin tarifa se rechaza con MATERIA_SIN_TARIFA (HU-L-06, cambio de 1.1)", async () => {
      const materia = await crearMateriaDePrueba(db, { tarifaHora: null });
      const turno = await crearTurnoDePrueba(db, { materiaId: materia.idMateria });
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: (await crearAlumnoDePrueba(db)).idAlumno }, usuarioId))
        .rejects.toMatchObject({ code: "MATERIA_SIN_TARIFA" });
    });
  });

  describe("HU-C-04 §2.5 quitar alumno", () => {
    it("no borra: la inscripción pasa a QUITADA_CENTRO con fecha y usuario, libera la reserva y el turno COMPLETO vuelve a DISPONIBLE", async () => {
      const turno = await crearTurnoDePrueba(db, { cupo: 1, enDias: 6 });
      const alumno = await crearAlumnoDePrueba(db);
      await agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, usuarioId);
      await expect(quitarAlumnoTurno(turno.idTurno, alumno.idAlumno, usuarioId))
        .resolves.toEqual({ id: turno.idTurno, alumno_id: alumno.idAlumno, alumnos_inscriptos: "0/1", estado: "DISPONIBLE" });
      const [fila] = await filas(turno.idTurno);
      expect(fila).toMatchObject({ vigencia: "QUITADA_CENTRO", finalizadaPorUsuarioId: usuarioId, finalizadaPorActorTipo: "USUARIO", finalizadaEl: expect.any(Date) });
      expect(await reservasDeAlumnos(turno.idTurno)).toBe(0n);
      expect(await eventos(turno.idTurno)).toEqual(["turno:alumno_agregado", "turno:completado", "turno:alumno_quitado", "turno:disponible_nuevamente"]);
      // Se puede volver a inscribir: la fila anterior queda como historia.
      await expect(agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, usuarioId)).resolves.toMatchObject({ alumnos_inscriptos: "1/1" });
      expect((await filas(turno.idTurno)).map((f) => f.vigencia)).toEqual(["QUITADA_CENTRO", "VIGENTE"]);
    });

    it("rechaza alumno no inscripto, turno PENDIENTE y CANCELADO sin escribir", async () => {
      const alumno = await crearAlumnoDePrueba(db);
      await expect(quitarAlumnoTurno((await crearTurnoDePrueba(db)).idTurno, alumno.idAlumno, usuarioId))
        .rejects.toMatchObject({ code: "ALUMNO_NO_ASIGNADO", detalles: { alumno_id: alumno.idAlumno } });
      await expect(quitarAlumnoTurno((await crearTurnoDePrueba(db, { estado: "PENDIENTE" })).idTurno, alumno.idAlumno, usuarioId)).rejects.toMatchObject({ code: "TURNO_PENDIENTE" });
      await expect(quitarAlumnoTurno((await crearTurnoDePrueba(db, { estado: "CANCELADO" })).idTurno, alumno.idAlumno, usuarioId)).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
    });
  });

  describe("HU-C-12 §2.14.2 solicitar turno propio", () => {
    it("inscribe a la ficha de la sesión sin plazo y responde con los textos del alumno", async () => {
      const cuenta = await crearUsuarioDePrueba(db, { rol: "ALUMNO" });
      const alumno = await crearAlumnoDePrueba(db, { usuarioId: cuenta.idUsuario });
      const turno = await crearTurnoDePrueba(db, { enDias: 7, hora: "15:00", cupo: 3 });
      await expect(solicitarTurnoPropio(turno.idTurno, cuenta.idUsuario)).resolves.toEqual({ id: turno.idTurno, alumnos_inscriptos: "1/3", estado: "DISPONIBLE" });
      expect((await filas(turno.idTurno))[0]).toMatchObject({ alumnoId: alumno.idAlumno, estadoPago: "PAGO_SIN_REGISTRAR", venceEl: null });
      await expect(solicitarTurnoPropio(turno.idTurno, cuenta.idUsuario)).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO", message: "Ya estás inscripto en este turno" });
      const superpuesto = await crearTurnoDePrueba(db, { enDias: 7, hora: "15:30" });
      await expect(solicitarTurnoPropio(superpuesto.idTurno, cuenta.idUsuario)).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE", message: "Ya tenés otro turno en ese horario" });
      const pendiente = await crearTurnoDePrueba(db, { estado: "PENDIENTE" });
      await expect(solicitarTurnoPropio(pendiente.idTurno, cuenta.idUsuario)).rejects.toMatchObject({ code: "TURNO_NO_DISPONIBLE", message: "El turno ya no está disponible" });
    });
  });

  describe("HU-I-01 POST /api/pagos (2.15): contrato de Sprint 2 sobre registrarOperacion en modo compatibilidad", () => {
    it("sin caja abierta: CAJA_NO_ABIERTA y no registra nada; con caja: pago, comprobante e inscripción PAGADA", async () => {
      const mesa = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;
      const turno = await crearTurnoDePrueba(db, { enDias: 8 });
      const alumno = await crearAlumnoDePrueba(db);
      await agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, mesa);
      const input = { turno_id: turno.idTurno, alumno_id: alumno.idAlumno, forma_pago_id: "formapago-efectivo", monto: "1500.50" };
      await expect(registrarPago(input, mesa)).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA", status: 409 });
      expect(await db.pago.count({ where: { turnoId: turno.idTurno } })).toBe(0);

      await abrirCajaDePrueba(db, { usuarioId: mesa });
      const pago = await registrarPago(input, mesa);
      expect(pago).toMatchObject({
        turno_id: turno.idTurno, alumno: { id: alumno.idAlumno }, monto: "1500.50",
        forma_pago: { id: "formapago-efectivo", nombre: expect.any(String) }, fecha_pago: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        comprobante: { id: expect.any(String), numero: expect.stringMatching(/^0001-\d{8}$/) },
      });
      expect((await filas(turno.idTurno))[0]).toMatchObject({ estadoPago: "PAGADA" });
      // Pago parcial (Sprint 2): otro cobro de la misma inscripción se admite en este modo.
      await expect(registrarPago({ ...input, monto: "0.01" }, mesa)).resolves.toMatchObject({ monto: "0.01" });
    });

    it("conserva el orden y los códigos de Sprint 2: inscripción antes que forma y fecha", async () => {
      const mesa = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;
      await abrirCajaDePrueba(db, { usuarioId: mesa });
      const turno = await crearTurnoDePrueba(db, { enDias: 9 });
      const alumno = await crearAlumnoDePrueba(db);
      const otro = await crearAlumnoDePrueba(db);
      await agregarAlumnoTurno(turno.idTurno, { alumno_id: alumno.idAlumno }, mesa);
      const input = { turno_id: turno.idTurno, alumno_id: alumno.idAlumno, forma_pago_id: "formapago-efectivo", monto: "100" };
      await expect(registrarPago({ ...input, alumno_id: otro.idAlumno, forma_pago_id: "no-existe" }, mesa)).rejects.toMatchObject({ code: "ALUMNO_NO_INSCRIPTO" });
      await expect(registrarPago({ ...input, forma_pago_id: "no-existe" }, mesa)).rejects.toMatchObject({ code: "FORMA_PAGO_NO_ENCONTRADA" });
      await expect(registrarPago({ ...input, fecha_pago: new Date("2099-01-01") }, mesa)).rejects.toMatchObject({ code: "FECHA_PAGO_FUTURA" });
      await expect(registrarPago({ ...input, turno_id: "no-existe" }, mesa)).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
      const pendiente = await crearTurnoDePrueba(db, { estado: "PENDIENTE" });
      await expect(registrarPago({ ...input, turno_id: pendiente.idTurno }, mesa)).rejects.toMatchObject({ code: "TURNO_NO_ADMITE_PAGO" });
      expect(await db.pago.count({ where: { turnoId: turno.idTurno } })).toBe(0);
    });
  });
});
