import type { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { obtenerCancelacionesPorMes, obtenerCancelacionesPorMateria } from "./cancelaciones.service";
import { obtenerClasesPorMateria } from "./clases.service";
import { conReloj } from "@/server/shared/reloj";
import { prisma } from "@/lib/prisma";

describe.skipIf(!basePgHabilitada)("HU-H-10 PostgreSQL por servicios públicos", () => {
  const rango = { desde: "2026-05", hasta: "2026-10" };
  let db: PrismaClient;
  beforeAll(() => { db = clientePg(); execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=512" }, stdio: "pipe" }); }, 120_000);
  afterAll(async () => { await db?.$disconnect(); await prisma.$disconnect(); });
  it("cuatro series y denominadores coinciden con SQL independiente por fecha de clase", async () => {
    const r = await obtenerCancelacionesPorMes(rango);
    const grupos = await db.$queryRaw<{ mes: string; vigencia: string; cantidad: number }[]>`SELECT to_char(t."fechaTurno",'YYYY-MM') AS mes, CASE WHEN ta.vigencia = 'VIGENTE' AND ta."estadoPago" = 'RESERVADA' AND ta."venceEl" <= CURRENT_TIMESTAMP THEN 'RESERVA_VENCIDA' ELSE ta.vigencia::text END AS vigencia, count(*)::int AS cantidad FROM turno_alumno ta JOIN turnos t ON t."idTurno" = ta."turnoId" WHERE t."estadoTurno" IN ('DISPONIBLE','COMPLETO') AND t."fechaTurno" >= DATE '2026-05-01' AND t."fechaTurno" < DATE '2026-11-01' AND ta.vigencia <> 'QUITADA_CENTRO' GROUP BY 1,2`;
    const clases = await db.$queryRaw<{ mes: string; estado: string; cantidad: number }[]>`SELECT to_char("fechaTurno",'YYYY-MM') AS mes,"estadoTurno"::text AS estado,count(*)::int AS cantidad FROM turnos WHERE "fechaTurno" >= DATE '2026-05-01' AND "fechaTurno" < DATE '2026-11-01' AND "estadoTurno" IN ('DISPONIBLE','COMPLETO','CANCELADO') GROUP BY 1,2`;
    for (const mes of r.meses) {
      const cantidad = (vigencia: string) => grupos.find(f => f.mes === mes.mes && f.vigencia === vigencia)?.cantidad ?? 0;
      expect(mes).toEqual({ mes: mes.mes, clases_canceladas_centro: clases.find(f => f.mes === mes.mes && f.estado === 'CANCELADO')?.cantidad ?? 0, inscripciones_canceladas_alumno: cantidad('CANCELADA_ALUMNO'), reservas_vencidas: cantidad('RESERVA_VENCIDA'), bajas: cantidad('BAJA_ALUMNO') });
    }
    expect(r.tasas.clases.totales).toBe((await obtenerClasesPorMateria(rango)).total);
    expect(r.tasas.inscripciones.totales).toBe(grupos.filter(f => ['VIGENTE','CANCELADA_ALUMNO','RESERVA_VENCIDA'].includes(f.vigencia)).reduce((s,f) => s+f.cantidad,0));
    expect(r.totales.bajas).toBeGreaterThan(0); expect(r.totales.reservas_vencidas).toBeGreaterThan(0);
  });
  it("fixtures contienen vencidas marcadas/no marcadas, centro excluido, quitadas y reinscripción", async () => {
    const marcadas = await db.turnoAlumno.count({ where: { vigencia: 'RESERVA_VENCIDA' } });
    const sinMarcar = await db.turnoAlumno.count({ where: { vigencia: 'VIGENTE', estadoPago: 'RESERVADA', venceEl: { lte: new Date() }, turno: { estadoTurno: { in: ['DISPONIBLE','COMPLETO'] } } } });
    expect(marcadas).toBeGreaterThan(0); expect(sinMarcar).toBeGreaterThan(0);
    expect(await db.turnoAlumno.count({ where: { vigencia: 'QUITADA_CENTRO' } })).toBeGreaterThan(0);
    expect(await db.turnoAlumno.count({ where: { vigencia: 'CANCELADA_ALUMNO', turno: { estadoTurno: 'CANCELADO' } } })).toBeGreaterThan(0);
    const pares = await db.$queryRaw<{ cantidad: number }[]>`SELECT count(*)::int AS cantidad FROM (SELECT "turnoId","alumnoId" FROM turno_alumno GROUP BY 1,2 HAVING bool_or(vigencia='CANCELADA_ALUMNO') AND bool_or(vigencia='VIGENTE')) p`;
    expect(pares[0].cantidad).toBeGreaterThan(0);
  });
  it("el borde venceEl clasifica sin proceso ni escritura: vigente un ms antes, vencida al igualar", async () => {
    const reserva = await db.turnoAlumno.findFirstOrThrow({ where: { vigencia: 'VIGENTE', estadoPago: 'RESERVADA', venceEl: { lte: new Date() }, turno: { estadoTurno: { in: ['DISPONIBLE','COMPLETO'] } } }, include: { turno: true } });
    const mes = reserva.turno.fechaTurno.toISOString().slice(0,7), consulta = { desde: mes, hasta: mes };
    const antes = await conReloj(new Date(reserva.venceEl!.getTime()-1), () => obtenerCancelacionesPorMes(consulta));
    const igual = await conReloj(reserva.venceEl!, () => obtenerCancelacionesPorMes(consulta));
    expect(igual.totales.reservas_vencidas).toBe(antes.totales.reservas_vencidas+1);
    expect(igual.tasas.inscripciones.totales).toBe(antes.tasas.inscripciones.totales);
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.idInscripcion } })).vigencia).toBe('VIGENTE');
  });
  it("materia solo cuenta dos series y sus totales coinciden con mensual", async () => {
    const mensual = await obtenerCancelacionesPorMes(rango), materias = await obtenerCancelacionesPorMateria(rango);
    expect(materias.items.reduce((s,m) => s+m.clases_canceladas_centro,0)).toBe(mensual.totales.clases_canceladas_centro);
    expect(materias.items.reduce((s,m) => s+m.inscripciones_canceladas_alumno,0)).toBe(mensual.totales.inscripciones_canceladas_alumno);
    expect(materias.items.every(m => !('bajas' in m) && !('reservas_vencidas' in m))).toBe(true);
  });
  it("seed repetido conserva hechos y todos los resultados", async () => {
    const antes = await obtenerCancelacionesPorMes(rango), cantidad = await db.turnoAlumno.count();
    execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=512" }, stdio: "pipe" });
    expect(await db.turnoAlumno.count()).toBe(cantidad); expect(await obtenerCancelacionesPorMes(rango)).toEqual(antes);
  },120_000);
  it("sin denominadores ambos son null", async () => { const r=await obtenerCancelacionesPorMes({ desde:'2038-01',hasta:'2038-06' }); expect(r.tasas.clases.tasa).toBeNull();expect(r.tasas.inscripciones.tasa).toBeNull();expect(await obtenerCancelacionesPorMateria({ desde:'2038-01',hasta:'2038-06' })).toEqual({items:[]}); });
});
