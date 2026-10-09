import type { ContextoFixtures } from "./index";
import { configurarTurno, asignarParticipantesTurno } from "../../../src/server/turnos/turno.service";
import { asignarAulaTurno } from "../../../src/server/turnos/turno.aula.service";
import { registrarPago } from "../../../src/server/pagos/pago.service";
import { conReloj, ahora } from "../../../src/server/shared/reloj";
import { fechaCentro, instanteCentro } from "../../../src/server/shared/fechas-centro";
/** Históricos reales por servicios, identificados por clave natural estable; no se alteran hechos al resembrar. */
export async function fixtureHuH06({ prisma }: ContextoFixtures) {
  const [profesor,materia,aula,mesa,alumnos] = await Promise.all([
    prisma.profesor.findUnique({where:{dniProfesor:"27100001"}}),
    prisma.materia.findUnique({where:{codigoMateria:"MAT101"}}),
    prisma.aula.findUnique({where:{nombreAula:"Aula 1"}}),
    prisma.usuario.findUnique({where:{emailUsuario:"mesa.entrada@noctium.local"}}),
    prisma.alumno.findMany({where:{activoAlumno:true},orderBy:{dniAlumno:"asc"},take:8}),
  ]);
  if (!profesor || !materia || !aula || !mesa || alumnos.length<8) throw new Error("HU-H-06 necesita el seed base de profesor1, MAT101, Aula 1, mesa.entrada y ocho alumnos activos.");
  const hoy=fechaCentro(ahora());
  for (let atraso=1;atraso<=23;atraso++) {
    if (atraso%4===0) continue; // huecos visibles en el gráfico y la tabla
    const primerDia=new Date(Date.UTC(hoy.getUTCFullYear(),hoy.getUTCMonth()-atraso,1));
    const lunes=14+(8-new Date(Date.UTC(primerDia.getUTCFullYear(),primerDia.getUTCMonth(),14)).getUTCDay())%7;
    for (let numero=0;numero<(atraso%3===0?2:1);numero++) {
      const dia=new Date(Date.UTC(primerDia.getUTCFullYear(),primerDia.getUTCMonth(),lunes+numero));
      const fecha=dia.toISOString().slice(0,10);
      await conReloj(instanteCentro(fecha,"07:00"),async()=>{
        let clase=await prisma.turno.findFirst({where:{fechaTurno:dia,horaInicioTurno:new Date("1970-01-01T11:00:00Z"),profesorId:profesor.idProfesor,materiaId:materia.idMateria,creadoPorUsuarioId:mesa.idUsuario}});
        if (!clase) {
          const creada=await configurarTurno({fecha:dia,hora_inicio:"11:00",duracion_min:60,materia_id:materia.idMateria,profesor_id:profesor.idProfesor},mesa.idUsuario);
          clase=await prisma.turno.findUniqueOrThrow({where:{idTurno:creada.id}});
        }
        if (clase.estadoTurno==="PENDIENTE") {
          if (!clase.aulaId) await asignarAulaTurno(clase.idTurno,{aula_id:aula.idAula},mesa.idUsuario);
          await asignarParticipantesTurno(clase.idTurno,{alumno_ids:alumnos.slice(0,2+atraso%7).map(a=>a.idAlumno)},mesa.idUsuario);
        }
        const pago=await prisma.pago.findFirst({where:{turnoId:clase.idTurno,alumnoId:alumnos[0].idAlumno}});
        if (!pago) await registrarPago({turno_id:clase.idTurno,alumno_id:alumnos[0].idAlumno,monto:String(atraso%3===0?3800000:988000+atraso*1000),forma_pago_id:"formapago-transferencia",fecha_pago:dia},mesa.idUsuario);
      });
    }
  }
}
