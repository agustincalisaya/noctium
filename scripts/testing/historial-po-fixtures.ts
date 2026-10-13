/** Solo base descartable; datos exclusivos para pruebas Playwright E04/E08. */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { crearAlumnoDePrueba, crearProfesorDePrueba, crearTurnoDePrueba, crearInscripcionDePrueba, crearUsuarioDePrueba, crearMateriaDePrueba, crearFichaMesaEntradaDePrueba } from "../../src/server/testing/fabricas";
import { registrarClaseDictada, anularClaseDictada } from "../../src/server/historial/clase-dictada.service";
import { registrarResultadoExamen, anularResultadoExamen } from "../../src/server/historial/resultado-examen.service";
import { registrarIndicacion } from "../../src/server/historial/indicacion.service";
import { registrarObservacionClase } from "../../src/server/historial/observacion-clase.service";
import { transaccion } from "../../src/server/shared/transaccion";
import { actorUsuario } from "../../src/server/shared/historial";
import { inicioDeTurno } from "../../src/server/shared/fechas-centro";
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith("/noctium_pruebas_")) throw new Error("Se exige base descartable");
async function main() {
const db = new PrismaClient();
const password = "Password123!"; // misma clave pública de la seed, solo pruebas
const hash = await bcrypt.hash(password, 10);
async function cuenta(rol: "ALUMNO" | "PROFESOR", email: string) {
  const u = await crearUsuarioDePrueba(db, { rol, email });
  await db.usuario.update({ where: { idUsuario: u.idUsuario }, data: { passwordHashUsuario: hash } });
  return { id: u.idUsuario, rol };
}
const mesaFicha = await crearFichaMesaEntradaDePrueba(db);
await db.fichaMesaEntrada.update({ where: { usuarioId: mesaFicha.usuarioId! }, data: { nombreFichaMesaEntrada: "Julián", apellidoFichaMesaEntrada: "Ferreyra" } });
await db.usuario.update({ where: { idUsuario: mesaFicha.usuarioId! }, data: { passwordHashUsuario: hash } });
const mesa = { id: mesaFicha.usuarioId!, rol: "MESA_ENTRADA" as const };
const alumnoUser = await cuenta("ALUMNO", "historial.po@prueba.local");
const vacioUser = await cuenta("ALUMNO", "historial.vacio@prueba.local");
const profesorUser = await cuenta("PROFESOR", "historial.profesor@prueba.local");
const ajenoUser = await cuenta("PROFESOR", "historial.ajeno@prueba.local");
const alumno = await crearAlumnoDePrueba(db, { usuarioId: alumnoUser.id });
await db.alumno.update({ where: { idAlumno: alumno.idAlumno }, data: { nombreAlumno: "Sofía", apellidoAlumno: "Acosta" } });
await crearAlumnoDePrueba(db, { usuarioId: vacioUser.id });
const nuevo = await crearAlumnoDePrueba(db);
await db.alumno.update({ where: { idAlumno: nuevo.idAlumno }, data: { nombreAlumno: "Joaquín", apellidoAlumno: "Herrera" } });
const profesor = await crearProfesorDePrueba(db);
await db.profesor.update({ where: { idProfesor: profesor.idProfesor }, data: { usuarioId: profesorUser.id, nombreProfesor: "Laura", apellidoProfesor: "Méndez" } });
const ajeno = await crearProfesorDePrueba(db);
await db.profesor.update({ where: { idProfesor: ajeno.idProfesor }, data: { usuarioId: ajenoUser.id } });
const materias: string[] = [];
for (const nombre of ["Física I", "Matemática II"]) {
  const m = await crearMateriaDePrueba(db);
  await db.materia.update({ where: { idMateria: m.idMateria }, data: { nombreMateria: nombre, nombreNormalizadaMateria: nombre.toLowerCase() } });
  materias.push(m.idMateria);
}
const clases: { turno: string; clase: string; fecha: Date; materia: string }[] = [];
for (let i = 0; i < 13; i++) {
  const turno = await crearTurnoDePrueba(db, { enDias: -2 - i, profesorId: profesor.idProfesor, materiaId: materias[i % 2], hora: "14:00" });
  const ins = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, reservadaEl: new Date(inicioDeTurno(turno).getTime() - 60000) });
  const clase = await transaccion(tx => registrarClaseDictada(tx, { turnoId: turno.idTurno, actor: actorUsuario(mesa.id), ...(i % 3 ? { asistencias: [{ inscripcionId: ins.idInscripcion, estado: i % 4 ? "PRESENTE" : "AUSENTE" }] } : {}) }));
  if (i === 0) await transaccion(tx => registrarObservacionClase(tx, turno.idTurno, { temas_vistos: "Movimiento rectilíneo y problemas de cinemática", observaciones_internas: "SECRETO_CLASE_PO" }, mesa));
  clases.push({ turno: turno.idTurno, clase: clase.id, fecha: turno.fechaTurno, materia: turno.materiaId });
}
await anularClaseDictada(clases[12].turno, mesa, "CLASE_ANULADA_PO");
const examen = await registrarResultadoExamen(alumno.idAlumno, { materia_id: materias[0], fecha_examen: clases[0].fecha, nota: "8", descripcion_publica: "Parcial de cinemática", observaciones: "SECRETO_EXAMEN_PO" }, mesa);
await registrarResultadoExamen(alumno.idAlumno, { materia_id: materias[1], fecha_examen: clases[1].fecha, nota: "5", observaciones: "SECRETO_HISTORICO_PO" }, mesa);
const anulado = await registrarResultadoExamen(alumno.idAlumno, { materia_id: materias[0], fecha_examen: clases[0].fecha, nota: "1", descripcion_publica: "EXAMEN_ANULADO_PO" }, mesa);
await anularResultadoExamen(alumno.idAlumno, anulado.id, { motivo: "Prueba" }, mesa);
await transaccion(tx => registrarIndicacion(tx, alumno.idAlumno, { materia_id: materias[0], indicacion: "Repasar los ejercicios 4 a 9 de la guía antes de la próxima clase.", clase_dictada_id: clases[0].clase }, mesa));
await transaccion(tx => registrarIndicacion(tx, alumno.idAlumno, { materia_id: materias[1], indicacion: "Practicar derivadas y revisar cada paso. " + "TextoLargoSinEspacios".repeat(18) }, mesa));
// Registro histórico sin autor: se omite solo ese detalle.
await db.resultadoExamen.update({ where: { idResultadoExamen: (await db.resultadoExamen.findFirstOrThrow({ where: { alumnoId: alumno.idAlumno, materiaId: materias[1] } })).idResultadoExamen }, data: { creadoPorUsuarioId: null } });
const futura = await crearTurnoDePrueba(db, { enDias: 3, profesorId: profesor.idProfesor, materiaId: materias[0] });
await crearInscripcionDePrueba(db, { turnoId: futura.idTurno, alumnoId: nuevo.idAlumno });
writeFileSync(process.env.HISTORIAL_PO_FIXTURES ?? "/tmp/noctium-po-fixtures.json", JSON.stringify({ alumno: alumno.idAlumno, nuevo: nuevo.idAlumno, profesor: profesorUser.id, materias, origenA: clases[0].turno, origenB: clases[1].turno, futura: futura.idTurno, examen: examen.id, mesaEmail: (await db.usuario.findUniqueOrThrow({ where: { idUsuario: mesa.id } })).emailUsuario, expected: { clases_dictadas: 12, examenes: 2, indicaciones: 2 } }, null, 2));
await db.$disconnect();
console.log("Fixtures PO listos: 16 registros vigentes y escenarios aislados de profesor/mesa/alumno.");

}
void main().catch(e => { console.error(e); process.exit(1); });
