import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
describe.skipIf(!basePgHabilitada)("E02 migración de permisos",()=>{
 let db:PrismaClient;beforeAll(()=>{db=clientePg();});afterAll(async()=>{await db?.$disconnect();});
 it("revoca solo alumnos:leer del profesor; mantiene mesa/gerente e historial acotado",async()=>{
  expect(await db.rolPermiso.findUnique({where:{rolPermiso_accionPermiso:{rolPermiso:"PROFESOR",accionPermiso:"alumnos:leer"}}})).toBeNull();
  for(const rol of ["MESA_ENTRADA","GERENTE"] as const)expect(await db.rolPermiso.findUnique({where:{rolPermiso_accionPermiso:{rolPermiso:rol,accionPermiso:"alumnos:leer"}}})).not.toBeNull();
  expect(await db.rolPermiso.findUnique({where:{rolPermiso_accionPermiso:{rolPermiso:"PROFESOR",accionPermiso:"historial:leer"}}})).not.toBeNull();
 });
});
