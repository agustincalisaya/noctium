/**
 * HU-I-05 — datos exclusivos de la verificación E2E/HTTP. Solo corre contra una
 * base descartable `noctium_pruebas_i05_*` (la crea y la borra
 * `scripts/testing/run-hu-i-05.mjs`). Las cuentas y fichas se crean con las
 * fábricas de prueba; los cobros y las correcciones, con los servicios de
 * dominio (HU-I-10, HU-I-06) y un reloj fijo, así cada pago tiene su
 * comprobante emitido por `registrarOperacion`. Las anulaciones las hace el
 * flujo HTTP autorizado de HU-I-06 en `api-check.mjs`.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearFichaMesaEntradaDePrueba, crearInscripcionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba,
} from "../../src/server/testing/fabricas";
import { registrarOperacionDePago } from "../../src/server/pagos/pago.service";
import { corregirOperacion, corregirPago } from "../../src/server/pagos/correccion.service";
import { conReloj } from "../../src/server/shared/reloj";
import { transaccion } from "../../src/server/shared/transaccion";

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith("/noctium_pruebas_i05_")) throw new Error("Se exige la base descartable noctium_pruebas_i05_*");
const salida = process.env.HU_I05_FIXTURES;
if (!salida) throw new Error("Falta HU_I05_FIXTURES");

const db = new PrismaClient();
/** Martes 06/10/2026 12:00 en el centro: todas las clases son posteriores; los pagos, de esa fecha o anteriores. */
const MOMENTO = new Date("2026-10-06T15:00:00.000Z");
const PASSWORD = "Password123!"; // misma clave pública del seed; solo pruebas
const SECRETO = "SECRETO-I05";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const conClave = async (usuarioId: string) => db.usuario.update({ where: { idUsuario: usuarioId }, data: { passwordHashUsuario: hash } });
  const cuenta = async (email: string) => {
    const u = await crearUsuarioDePrueba(db, { rol: "ALUMNO", email });
    await conClave(u.idUsuario);
    return u.idUsuario;
  };
  const alumno = async (usuarioId: string, nombre: string, apellido: string) => {
    const a = await crearAlumnoDePrueba(db, { usuarioId });
    await db.alumno.update({ where: { idAlumno: a.idAlumno }, data: {
      nombreAlumno: nombre, apellidoAlumno: apellido, nombreNormalizadoAlumno: nombre.toLowerCase(), apellidoNormalizadoAlumno: apellido.toLowerCase(),
    } });
    return a.idAlumno;
  };

  const ficha = await crearFichaMesaEntradaDePrueba(db);
  const mesa = ficha.usuarioId!;
  await db.fichaMesaEntrada.update({ where: { usuarioId: mesa }, data: { nombreFichaMesaEntrada: "Julián", apellidoFichaMesaEntrada: "Ferreyra" } });
  await db.usuario.update({ where: { idUsuario: mesa }, data: { emailUsuario: "mesa.i05@prueba.local", passwordHashUsuario: hash } });
  await db.fichaMesaEntrada.update({ where: { usuarioId: mesa }, data: { emailFichaMesaEntrada: "mesa.i05@prueba.local" } });
  await abrirCajaDePrueba(db, { usuarioId: mesa, abiertaEl: new Date("2026-10-06T11:00:00.000Z") });

  const alumnoA = await alumno(await cuenta("sofia.i05@prueba.local"), "Sofía", "Acosta");
  const alumnoB = await alumno(await cuenta("lucas.i05@prueba.local"), "Lucas", "Martínez");
  await alumno(await cuenta("vacio.i05@prueba.local"), "Valentina", "Sinpagos");
  await cuenta("sinficha.i05@prueba.local");

  const materia = async (nombre: string) => (await db.materia.create({ data: { nombreMateria: nombre, nombreNormalizadaMateria: nombre.toLowerCase(), tarifaHoraMateria: 12000 } })).idMateria;
  const fisica = await materia("Física I");
  const matematica = await materia("Matemática II");
  const quimicaB = await materia("Química Orgánica");
  const MP = "formapago-mercado-pago";
  const EF = "formapago-efectivo";

  /** Clase futura (respecto de MOMENTO) con inscripciones de los alumnos indicados y su precio. */
  const clase = (materiaId: string, enDias: number, alumnos: { id: string; precio: number }[]) => conReloj(MOMENTO, async () => {
    const turno = await crearTurnoDePrueba(db, { enDias, materiaId, hora: "16:00" });
    const ids: Record<string, string> = {};
    for (const a of alumnos) ids[a.id] = (await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: a.id, precio: a.precio })).idInscripcion;
    return ids;
  });
  const cobrar = (alumnoId: string, items: { inscripcion_id: string; monto: string; motivo?: string }[], fecha: string, forma = MP) =>
    conReloj(MOMENTO, () => registrarOperacionDePago({
      alumno_id: alumnoId,
      items: items.map((i) => ({ inscripcion_id: i.inscripcion_id, monto: i.monto, ...(i.motivo ? { motivo_ajuste: i.motivo } : {}) })),
      forma_pago_id: forma, fecha_pago: new Date(`${fecha}T00:00:00.000Z`),
    }, mesa));

  // Operación de dos clases (foto del comprobante: Física I 13/10 + Matemática II 21/10). B paga la misma clase de Física.
  const compartida = await clase(fisica, 7, [{ id: alumnoA, precio: 12000 }, { id: alumnoB, precio: 12000 }]);
  const mat21 = await clase(matematica, 15, [{ id: alumnoA, precio: 11000 }]);
  const multi = await cobrar(alumnoA, [
    { inscripcion_id: compartida[alumnoA]!, monto: "12000.00" }, { inscripcion_id: mat21[alumnoA]!, monto: "11000.00" },
  ], "2026-10-06");
  const pagoDeB = (await cobrar(alumnoB, [{ inscripcion_id: compartida[alumnoB]!, monto: "12000.00" }], "2026-10-06", EF)).pagos[0]!.id;
  const quimica = await clase(quimicaB, 9, [{ id: alumnoB, precio: 9000 }]);
  const pagoDeBOtraClase = (await cobrar(alumnoB, [{ inscripcion_id: quimica[alumnoB]!, monto: "9000.00" }], "2026-10-05", EF)).pagos[0]!.id;

  // 19 operaciones de una clase: 12 de Física I y 7 de Matemática II, fechas de pago descendentes, una con centavos y ajuste.
  const simples: { pago: string; materia: string; fecha: string; monto: string }[] = [];
  for (let i = 0; i < 19; i++) {
    const esFisica = i % 3 !== 2;
    const materiaId = esFisica ? fisica : matematica;
    const precio = esFisica ? 12000 : 11000;
    const monto = i === 4 ? "15000.50" : `${precio}.00`;
    const insc = await clase(materiaId, 20 + i, [{ id: alumnoA, precio }]);
    const fecha = new Date(Date.UTC(2026, 9, 5) - i * 4 * 86400000).toISOString().slice(0, 10);
    const r = await cobrar(alumnoA, [{ inscripcion_id: insc[alumnoA]!, monto, ...(i === 4 ? { motivo: `Ajuste ${SECRETO}` } : {}) }], fecha);
    simples.push({ pago: r.pagos[0]!.id, materia: materiaId, fecha, monto });
  }

  // HU-I-06 por servicio: corrección de monto (simple 1) y de fecha + forma (simple 2).
  const operador = { id: mesa, rol: "MESA_ENTRADA" as const };
  await conReloj(MOMENTO, () => transaccion((tx) => corregirPago(tx, { pagoId: simples[1]!.pago, monto: "10500.00", motivo: `Corrección ${SECRETO}`, usuario: operador })));
  await conReloj(MOMENTO, () => transaccion((tx) => corregirOperacion(tx, {
    pagoId: simples[2]!.pago, fechaPago: new Date("2026-10-04T00:00:00.000Z"), formaPagoId: EF, motivo: `Corrección ${SECRETO}`, usuario: operador,
  })));

  writeFileSync(salida!, JSON.stringify({
    alumnoA, alumnoB, materias: { fisica, matematica, quimicaB },
    multi: { pagos: multi.pagos.map((p) => p.id), comprobante: multi.comprobante },
    simples, pagoDeB, pagoDeBOtraClase,
    corregidoMonto: simples[1]!.pago, corregidoFecha: simples[2]!.pago,
    /** Lo anula api-check.mjs por HTTP: total (operación de una clase) y parcial (Matemática II de la operación doble). */
    anularTotal: simples[0]!.pago, anularParcial: multi.pagos[1]!.id,
    secreto: SECRETO,
  }, null, 2));
  console.log(`Fixtures HU-I-05 listos: ${2 + simples.length} pagos de A, 2 de B.`);
}

main().finally(() => db.$disconnect());
