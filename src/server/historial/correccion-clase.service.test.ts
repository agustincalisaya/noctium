import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tx: { claseDictada: { findFirst: vi.fn(), updateMany: vi.fn() }, correccionAsistencia: { create: vi.fn() }, $queryRaw: vi.fn() }, bloquear: vi.fn(), profesor: vi.fn(), email: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: unknown) => unknown) => fn(m.tx) }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: m.bloquear }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: m.profesor }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: m.email }));
import { corregirAsistenciaClaseDictada as corregir, anularClaseDictada as anular } from "./clase-dictada.service";
import { conReloj } from "@/server/shared/reloj";
const mesa = { id: "m", rol: "MESA_ENTRADA" as const };
const profesor = { id: "p", rol: "PROFESOR" as const };
const datos = { motivo: "Error de carga", asistencias: [{ alumno_id: "a", estado: "AUSENTE" as const }] };
beforeEach(() => {
 vi.clearAllMocks(); m.tx.claseDictada.findFirst.mockResolvedValue({ idClaseDictada: "cd", profesorId: "prof", fechaClaseDictada: new Date("2026-10-01T00:00:00Z") });
 m.tx.$queryRaw.mockResolvedValue([{ alumno_id: "a", asistencia: "PRESENTE", con_control: true }]);
 m.tx.correccionAsistencia.create.mockResolvedValue({ idCorreccionAsistencia: "cor" }); m.tx.claseDictada.updateMany.mockResolvedValue({ count: 1 }); m.profesor.mockResolvedValue({ id: "prof" }); m.email.mockResolvedValue("m@test.local");
});
describe("E11 corrección y anulación", () => {
 it("crea compensación con valor anterior y nuevo sin editar snapshot", async () => {
  await expect(corregir("t", mesa, datos)).resolves.toMatchObject({ id: "cor", totales: { presentes: 0, ausentes: 1 } });
  expect(m.tx.correccionAsistencia.create).toHaveBeenCalledWith({ data: expect.objectContaining({ alumnos: { create: [{ alumnoId: "a", estadoAnterior: "PRESENTE", estadoNuevo: "AUSENTE" }] }, creadoPorUsuarioId: "m", motivo: datos.motivo }) });
  expect(m.tx.claseDictada.updateMany).not.toHaveBeenCalled();
 });
 it("rechaza sin cambios y permite primera carga legacy", async () => {
  m.tx.$queryRaw.mockResolvedValue([{ alumno_id: "a", asistencia: "AUSENTE", con_control: true }]);
  await expect(corregir("t", mesa, datos)).rejects.toMatchObject({ code: "ASISTENCIA_SIN_CAMBIOS" });
  m.tx.$queryRaw.mockResolvedValue([{ alumno_id: "a", asistencia: null, con_control: false }]);
  await expect(corregir("t", mesa, datos)).resolves.toMatchObject({ con_control_asistencia: true });
 });
 it.each([[[]], [[...datos.asistencias, ...datos.asistencias]], [[{ alumno_id: "otro", estado: "PRESENTE" as const }]]])("valida conjunto exacto", async asistencias => {
  await expect(corregir("t", mesa, { ...datos, asistencias })).rejects.toMatchObject({ code: "ASISTENCIA_INCOMPLETA" }); expect(m.tx.correccionAsistencia.create).not.toHaveBeenCalled();
 });
 it.each(["GERENTE", "ALUMNO"] as const)("rechaza %s en servicio", async rol => {
  await expect(anular("t", { id: "u", rol }, "No se dio")).rejects.toMatchObject({ code: "SIN_PERMISO" }); expect(m.bloquear).not.toHaveBeenCalled();
 });
 it("profesor ajeno no opera", async () => { m.profesor.mockResolvedValue({ id: "otro" }); await expect(anular("t", profesor, "No se dio")).rejects.toMatchObject({ code: "SIN_PERMISO" }); });
 it("día 7 inclusivo usa calendario de clase, día 8 rechaza", async () => {
  await conReloj(new Date("2026-10-09T02:59:59Z"), () => expect(anular("t", profesor, "No se dio")).resolves.toMatchObject({ id: "cd" }));
  await conReloj(new Date("2026-10-09T03:00:00Z"), () => expect(anular("t", profesor, "No se dio")).rejects.toMatchObject({ code: "PLAZO_CORRECCION_VENCIDO" }));
 });
 it("mesa opera fuera de plazo, marca con condición atómica y auditoría", async () => {
  await conReloj(new Date("2026-12-01T12:00:00Z"), () => anular("t", mesa, "No se dio"));
  expect(m.tx.claseDictada.updateMany).toHaveBeenCalledWith({ where: { idClaseDictada: "cd", anuladaEl: null }, data: { anuladaEl: new Date("2026-12-01T12:00:00Z"), anuladaPorUsuarioId: "m", motivoAnulacion: "No se dio" } });
 });
 it("no registrada 404 y carrera de anulación 409", async () => {
  m.tx.claseDictada.findFirst.mockResolvedValue(null); await expect(anular("t", mesa, "Motivo")).rejects.toMatchObject({ code: "CLASE_NO_REGISTRADA" });
  m.tx.claseDictada.findFirst.mockResolvedValue({ idClaseDictada: "cd" }); m.tx.claseDictada.updateMany.mockResolvedValue({ count: 0 });
  await expect(anular("t", mesa, "Motivo")).rejects.toMatchObject({ code: "CLASE_DICTADA_YA_ANULADA" });
 });
});
