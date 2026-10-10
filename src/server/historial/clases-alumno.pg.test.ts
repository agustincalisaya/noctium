import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { crearInscripcion, finalizarInscripcion, marcarVencidas } from "@/server/turnos/inscripcion.publico";
import { cancelarTurno } from "@/server/turnos/turno.cancelacion.service";
import { registrarClaseDictada, corregirAsistenciaClaseDictada, anularClaseDictada } from "./clase-dictada.service";
import { listarClasesDelAlumno } from "./clases-alumno.service";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { conReloj } from "@/server/shared/reloj";
describe.skipIf(!basePgHabilitada)("E02 hechos reales de C y E", () => {
  let db: PrismaClient;
  beforeAll(()=>{db=clientePg();}); afterAll(async()=>{await db?.$disconnect();});
  it("nueve estados, legacy, anulación, filtros, re-inscripción y precedencia con servicios", async()=>{
    const alumno=await crearAlumnoDePrueba(db); const mesa={id:(await crearUsuarioDePrueba(db,{rol:"MESA_ENTRADA"})).idUsuario,rol:"MESA_ENTRADA" as const}; const actor=actorUsuario(mesa.id);
    const escenarios=[];
    for(const enDias of [-5,-4,-3,-2,2,3,4,5,6,7]){
      const turno=await crearTurnoDePrueba(db,{enDias}); const antes=new Date(inicioDeTurno(turno).getTime()-3600000);
      const ins=await conReloj(antes,()=>transaccion(tx=>crearInscripcion(tx,{turnoId:turno.idTurno,alumnoId:alumno.idAlumno,origen:"CENTRO",conReserva:enDias===7,actor})));
      escenarios.push({turno,ins:ins.inscripcion.id});
    }
    for(const [i,estado] of (["PRESENTE","AUSENTE",null] as const).entries()){
      const e=escenarios[i]!;
      await conReloj(new Date(inicioDeTurno(e.turno).getTime()+3600000),()=>transaccion(tx=>registrarClaseDictada(tx,{turnoId:e.turno.idTurno,actor,asistencias:estado?[{inscripcionId:e.ins,estado}]:undefined})));
    }
    await corregirAsistenciaClaseDictada(escenarios[0]!.turno.idTurno,mesa,{motivo:"E02 corrección vigente",asistencias:[{alumno_id:alumno.idAlumno,estado:"AUSENTE"}]});
    await corregirAsistenciaClaseDictada(escenarios[0]!.turno.idTurno,mesa,{motivo:"E02 vuelve presente",asistencias:[{alumno_id:alumno.idAlumno,estado:"PRESENTE"}]});
    await cancelarTurno(escenarios[5]!.turno.idTurno,mesa.id);
    for(const [i,vigencia] of ([[6,"CANCELADA_ALUMNO"],[7,"BAJA_ALUMNO"],[8,"QUITADA_CENTRO"]] as const))await transaccion(tx=>finalizarInscripcion(tx,{inscripcionId:escenarios[i]!.ins,vigencia,actor}));
    const vence=await db.turnoAlumno.findUniqueOrThrow({where:{idInscripcion:escenarios[9]!.ins}});
    await conReloj(new Date(vence.venceEl!.getTime()+1000),()=>transaccion(tx=>marcarVencidas(tx,escenarios[9]!.turno.idTurno,{momento:new Date(vence.venceEl!.getTime()+1000)})));
    const r=await listarClasesDelAlumno(alumno.idAlumno,{pagina:1,por_pagina:10},mesa);
    expect(Object.values(r.resumen.por_resultado).every(n=>n>=1)).toBe(true); expect(r.resumen).toMatchObject({total:10,asistio_sin_control:1,clases_con_control:2,porcentaje_asistencia:50}); expect(JSON.stringify(r)).not.toMatch(/precio|estado_pago/);
    const fecha=escenarios[0]!.turno.fechaTurno;
    const filtro=await listarClasesDelAlumno(alumno.idAlumno,{pagina:1,por_pagina:10,desde:fecha,hasta:fecha,resultado:"ASISTIO"},mesa);expect(filtro.items).toHaveLength(1);expect(filtro.resumen.porcentaje_asistencia).toBe(100);
    await anularClaseDictada(escenarios[0]!.turno.idTurno,mesa,"E02 anulación");expect((await listarClasesDelAlumno(alumno.idAlumno,{pagina:1,por_pagina:10,desde:fecha,hasta:fecha},mesa)).items[0]?.resultado).toBe("SIN_REGISTRAR_COMO_DICTADA");
    const nuevo=await transaccion(tx=>crearInscripcion(tx,{turnoId:escenarios[6]!.turno.idTurno,alumnoId:alumno.idAlumno,origen:"CENTRO",conReserva:false,actor}));expect(nuevo.inscripcion.id).not.toBe(escenarios[6]!.ins);
    expect((await listarClasesDelAlumno(alumno.idAlumno,{pagina:2,por_pagina:10},mesa)).items).toHaveLength(1);
    await cancelarTurno(escenarios[6]!.turno.idTurno,mesa.id);const filas=(await listarClasesDelAlumno(alumno.idAlumno,{pagina:1,por_pagina:10},mesa)).items.filter(i=>i.turno_id===escenarios[6]!.turno.idTurno);expect(filas.map(i=>i.resultado)).toEqual(expect.arrayContaining(["CANCELADA_ALUMNO","CANCELADA_CENTRO"]));
    await transaccion(tx=>finalizarInscripcion(tx,{inscripcionId:nuevo.inscripcion.id,vigencia:"BAJA_ALUMNO",actor,fecha:new Date(Date.now()+1000)}));expect((await listarClasesDelAlumno(alumno.idAlumno,{pagina:1,por_pagina:10},mesa)).items.find(i=>i.inscripcion_id===nuevo.inscripcion.id)?.resultado).toBe("CANCELADA_CENTRO");
    await expect(listarClasesDelAlumno(alumno.idAlumno,{pagina:1,por_pagina:10},{id:mesa.id,rol:"PROFESOR"})).rejects.toMatchObject({code:"SIN_PERMISO"});
  },15000);
});
