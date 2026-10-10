import type { ContextoFixtures } from "./index";
import { crearAlumno } from "../../../src/server/alumnos/alumno.service";
import { crearProfesor } from "../../../src/server/profesores/profesor.service";
import { cambiarPassword, desactivarCuenta } from "../../../src/server/usuarios/cuenta.service";
import { transaccion } from "../../../src/server/shared/transaccion";

/**
 * HU-A-06: cuentas de acceso para probar el primer ingreso, «Mi cuenta» y la
 * tarjeta «Cuenta de acceso» en sus cuatro estados. Todo pasa por los
 * servicios del sistema: la cuenta la crea `crearCuentaParaFicha` (hash del
 * DNI, la marca y el evento CUENTA_CREADA), nunca una contraseña en claro.
 *
 * DNI 8806000x: se ordenan después de los del seed (4010…) y no chocan con
 * los de los tests con PostgreSQL (empiezan con 9). Cada caso se busca por su
 * DNI antes de crearlo, así que correr el seed dos veces no duplica nada.
 */
const IP = "127.0.0.1";
const NACIMIENTO_ALUMNO = new Date("2004-03-15T00:00:00.000Z");
const NACIMIENTO_PROFESOR = new Date(Date.UTC(1985, 6, 20));
/** Contraseña del alumno que ya hizo el primer ingreso: la misma convención que las cuentas del seed. */
const PASSWORD_YA_CAMBIADA = "Password123!";

export async function fixtureHuA06({ prisma }: ContextoFixtures) {
  const mesa = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } });
  const alumno = (dni: string, nombre: string, email?: string) =>
    crearAlumno({ nombre, apellido: "Prueba A06", dni, fecha_nacimiento: NACIMIENTO_ALUMNO, ...(email ? { email } : {}) }, mesa.idUsuario, IP);
  const existeAlumno = async (dni: string) => (await prisma.alumno.count({ where: { dniAlumno: dni } })) > 0;

  // 1. Alumno con la marca: ingresa con su DNI y va a /primer-ingreso.
  if (!(await existeAlumno("88060001"))) await alumno("88060001", "Primera", "a06.alumno.primer.ingreso@noctium.local");

  // 2. Profesor con la marca.
  if ((await prisma.profesor.count({ where: { dniProfesor: "88060002" } })) === 0) {
    await crearProfesor(
      { nombre: "Primero", apellido: "Prueba A06", dni: "88060002", fechaNacimiento: NACIMIENTO_PROFESOR, email: "a06.profesor.primer.ingreso@noctium.local" },
      mesa.idUsuario,
      IP,
    );
  }

  // 3. Alumno que ya cambió la contraseña inicial (sin la marca): para /mi-cuenta.
  if (!(await existeAlumno("88060003"))) {
    const { usuarioId } = await alumno("88060003", "Tercera", "a06.alumno.mi.cuenta@noctium.local");
    await transaccion((tx) => cambiarPassword(tx, { usuarioId: usuarioId!, nueva: PASSWORD_YA_CAMBIADA, conservarSesionActual: false, ip: IP }), { db: prisma });
  }

  // 4. Alumno con la cuenta inactiva: la tarjeta muestra «Inactiva». La baja
  // de la ficha (HU-B-07) todavía no existe: se marca la ficha inactiva acá
  // para que el estado sea el que dejará esa HU (ficha y cuenta inactivas) y
  // para que ningún otro fixture la tome como alumno activo.
  if (!(await existeAlumno("88060004"))) {
    const { idAlumno, usuarioId } = await alumno("88060004", "Cuarta", "a06.alumno.inactivo@noctium.local");
    await transaccion(async (tx) => {
      await desactivarCuenta(tx, usuarioId!);
      await tx.alumno.update({ where: { idAlumno }, data: { activoAlumno: false } });
    }, { db: prisma });
  }

  // 5. Ficha anterior sin cuenta: la tarjeta muestra «Sin cuenta».
  if (!(await existeAlumno("88060005"))) await alumno("88060005", "Quinta");
}
