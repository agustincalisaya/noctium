// ============================================================
// Noctium — Seed de desarrollo (Sprint 1)
//
// Ejecutar con:  npx prisma db seed
// (o directo:    npx tsx prisma/seed.ts)
//
// CREDENCIALES: todos los usuarios usan la contraseña  Password123!
//
//   gerente@noctium.local            GERENTE
//   mesa.entrada@noctium.local       MESA_ENTRADA
//   profesor1..4@noctium.local       PROFESOR
//   alumno01..06@noctium.local       ALUMNO
//   alumno.inactivo@noctium.local    ALUMNO con activoUsuario = false
//                                    (probar "La cuenta está inactiva", HU-A-01)
//
// Fichas SIN cuenta (HU-B-01 / HU-B-08): alumnos 07..15, el alumno inactivo 17
// y el profesor inactivo. Los alumnos 07..15 sirven para probar el autorregistro
// con vinculación por código (HU-B-08 c4); varían en si tienen o no email
// verificable (c5).
//
// Ejemplos INACTIVOS (para probar filtros de listados): alumno 17,
// profesor 5, materia "Historia de la Ciencia" y "Aula 12".
//
// Es idempotente: se puede correr N veces sin duplicar datos.
//  - Usuarios / alumnos / profesores / materias / aulas / formas de pago /
//    parámetros: upsert por clave única.
//  - HorarioProfesor (sin clave única): se borra y recrea por profesor.
//  - Turnos: ids fijos ("seed-turno-XX") + upsert. Las fechas se calculan
//    relativas a la semana en curso, así que al re-correr el seed los turnos
//    se "mueven" a las semanas actuales en vez de duplicarse.
//  - No toca datos que no sean del seed (ej. el alumno de prueba manual).
//  - No siembra tablas de runtime (TokenRevocado, IntentoLoginFallido,
//    IntentoRegistro, EventoSeguridad, CodigoVerificacion).
// ============================================================

import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type DiaSemana,
  type Genero,
  type RolUsuario,
} from "@prisma/client";
import { normalizarTexto } from "../src/lib/normalizar-texto";
import { ContactoSchema } from "../src/server/shared/contacto.schema";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";
const BCRYPT_COST = 12;

// ------------------------------------------------------------
// Helpers de fecha/hora (todo en UTC para columnas @db.Date / @db.Time)
// ------------------------------------------------------------

const DIAS: DiaSemana[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

/** Hora del día como valor @db.Time (fecha base 1970-01-01). */
function hora(h: number): Date {
  return new Date(Date.UTC(1970, 0, 1, h, 0, 0));
}

/** Lunes de la semana en curso + offset de semanas + offset de días, como @db.Date. */
function fechaRelativa(semana: number, diaIdx: number): Date {
  const hoy = new Date();
  const desdeLunes = (hoy.getDay() + 6) % 7; // lunes = 0
  return new Date(
    Date.UTC(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate() - desdeLunes + semana * 7 + diaIdx,
    ),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

// ------------------------------------------------------------
// Datos
// ------------------------------------------------------------

const FORMAS_PAGO = ["Efectivo", "Transferencia", "Débito", "Mercado Pago"] as const;

const MATERIAS: { nombre: string; codigo: string | null; activa: boolean }[] = [
  { nombre: "Matemática", codigo: "MAT101", activa: true },
  { nombre: "Física", codigo: "FIS101", activa: true },
  { nombre: "Programación I", codigo: "PRG101", activa: true },
  { nombre: "Bases de Datos", codigo: "BDD201", activa: true },
  { nombre: "Química", codigo: null, activa: true }, // sin código: se muestra "—"
  { nombre: "Inglés Técnico", codigo: null, activa: true },
  { nombre: "Historia de la Ciencia", codigo: "HIS101", activa: false },
];

// Nombres pensados para verificar orden natural (Aula 2 antes que Aula 10).
const AULAS: { nombre: string; capacidad: number; activa: boolean }[] = [
  { nombre: "Aula 1", capacidad: 10, activa: true },
  { nombre: "Aula 2", capacidad: 20, activa: true },
  { nombre: "Aula 10", capacidad: 30, activa: true },
  { nombre: "Aula 11", capacidad: 35, activa: true },
  { nombre: "Aula 12", capacidad: 25, activa: false },
  { nombre: "Laboratorio", capacidad: 15, activa: true },
];

type HorarioSeed = { dia: number; desde: number; hasta: number }; // dia: 0 = lunes

const PROFESORES: {
  nombre: string;
  apellido: string;
  dni: string;
  nacimiento: [number, number, number];
  genero: Genero | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  cuenta: boolean; // vinculado a un Usuario (profesorN@noctium.local)
  activo: boolean;
  materias: string[];
  horarios: HorarioSeed[];
}[] = [
  {
    nombre: "Laura",
    apellido: "Giménez",
    dni: "27100001",
    nacimiento: [1979, 3, 12],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0001",
    email: "profesor1@noctium.local",
    direccion: "Av. Corrientes 1234",
    cuenta: true,
    activo: true,
    materias: ["Matemática", "Física"],
    horarios: [
      { dia: 0, desde: 8, hasta: 12 },
      { dia: 2, desde: 8, hasta: 12 },
      { dia: 4, desde: 14, hasta: 18 },
    ],
  },
  {
    nombre: "Martín",
    apellido: "Rossi",
    dni: "28100002",
    nacimiento: [1982, 7, 25],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0002",
    email: "profesor2@noctium.local",
    direccion: null,
    cuenta: true,
    activo: true,
    materias: ["Programación I", "Bases de Datos"],
    horarios: [
      // Intervalos contiguos (10-12 y 12-14): no deben considerarse superpuestos.
      { dia: 0, desde: 10, hasta: 12 },
      { dia: 0, desde: 12, hasta: 14 },
      { dia: 1, desde: 14, hasta: 18 },
      { dia: 3, desde: 10, hasta: 14 },
    ],
  },
  {
    nombre: "Carolina",
    apellido: "Vega",
    dni: "29100003",
    nacimiento: [1985, 11, 2],
    genero: "FEMENINO",
    telefono: null, // solo email
    email: "profesor3@noctium.local",
    direccion: "Calle Falsa 742",
    cuenta: true,
    activo: true,
    materias: ["Química", "Matemática"],
    horarios: [
      { dia: 1, desde: 8, hasta: 12 },
      { dia: 3, desde: 14, hasta: 18 },
      { dia: 4, desde: 8, hasta: 12 },
    ],
  },
  {
    nombre: "Sergio",
    apellido: "Acuña",
    dni: "30100004",
    nacimiento: [1988, 5, 19],
    genero: "PREFIERO_NO_INDICARLO",
    telefono: "+54 11 5560-0004",
    email: null, // solo teléfono
    direccion: null,
    cuenta: true,
    activo: true,
    materias: ["Inglés Técnico", "Programación I"],
    horarios: [
      { dia: 0, desde: 16, hasta: 20 },
      { dia: 2, desde: 14, hasta: 18 },
      { dia: 3, desde: 16, hasta: 20 },
    ],
  },
  {
    // Profesor INACTIVO y sin cuenta (HU-D-01 c5): no debe recibir turnos.
    nombre: "Héctor",
    apellido: "Molina",
    dni: "31100005",
    nacimiento: [1970, 1, 30],
    genero: null,
    telefono: "+54 11 5560-0005",
    email: "hector.molina@example.com",
    direccion: null,
    cuenta: false,
    activo: false,
    materias: ["Física"],
    horarios: [
      { dia: 1, desde: 10, hasta: 12 },
      { dia: 3, desde: 8, hasta: 12 },
    ],
  },
];

type AlumnoSeed = {
  nombre: string;
  apellido: string;
  genero: Genero | null;
  cuenta: "activa" | "inactiva" | null; // null = ficha sin cuenta
  activo: boolean;
};

const ALUMNOS: AlumnoSeed[] = [
  { nombre: "Sofía", apellido: "Fernández", genero: "FEMENINO", cuenta: "activa", activo: true },
  { nombre: "Lucas", apellido: "Martínez", genero: "MASCULINO", cuenta: "activa", activo: true },
  { nombre: "Valentina", apellido: "López", genero: "FEMENINO", cuenta: "activa", activo: true },
  { nombre: "Mateo", apellido: "González", genero: "MASCULINO", cuenta: "activa", activo: true },
  { nombre: "Camila", apellido: "Rodríguez", genero: "FEMENINO", cuenta: "activa", activo: true },
  { nombre: "Joaquín", apellido: "Pérez", genero: "MASCULINO", cuenta: "activa", activo: true },
  { nombre: "Martina", apellido: "Sánchez", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Tomás", apellido: "Romero", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Julieta", apellido: "Díaz", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Benjamín", apellido: "Torres", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Lucía", apellido: "Álvarez", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Nicolás", apellido: "Ruiz", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Agustina", apellido: "Benítez", genero: "OTRO", cuenta: null, activo: true },
  { nombre: "Facundo", apellido: "Herrera", genero: "PREFIERO_NO_INDICARLO", cuenta: null, activo: true },
  { nombre: "Florencia", apellido: "Castro", genero: null, cuenta: null, activo: true },
  { nombre: "Ramiro", apellido: "Molina", genero: "MASCULINO", cuenta: "inactiva", activo: true },
  // Alumno INACTIVO y sin cuenta
  { nombre: "Bruno", apellido: "Paz", genero: null, cuenta: null, activo: false },
];

// Cuentas de alumno que creaba una versión previa del seed (todos los alumnos
// tenían cuenta). Ya no corresponden: esas fichas ahora no tienen cuenta.
const CUENTAS_ALUMNO_LEGACY = Array.from({ length: 9 }, (_, i) => `alumno${pad(i + 7)}@noctium.local`);

const PARAMETROS: Record<string, string> = {
  // Turnos y calendario
  duracion_turno_estandar_minutos: "60",
  horario_operativo_desde: "08:00",
  horario_operativo_hasta: "20:00",
  granularidad_turno_minutos: "30",
  anticipacion_maxima_dias: "30",
  dias_operativos: "LUNES,MARTES,MIERCOLES,JUEVES,VIERNES",
  // Sesión
  sesion_inactividad_minutos: "30",
  sesion_aviso_anticipado_minutos: "5",
  sesion_duracion_maxima_horas: "8",
  // Login
  login_max_intentos: "5",
  login_ventana_minutos: "15",
  // Listados
  paginacion_limite_default: "10",
  // Validaciones de identidad y contraseña
  dni_longitud_min: "7",
  dni_longitud_max: "8",
  password_longitud_minima: "8",
  // Autorregistro (HU-B-08)
  registro_max_por_ip_hora: "5",
  reenvio_codigo_max_por_hora: "3",
  reenvio_codigo_espera_segundos: "60",
  codigo_verificacion_expiracion_minutos: "10",
  codigo_verificacion_max_intentos: "5",
  terminos_version_vigente: "1.0",
};

type TurnoSeed = {
  id: string;
  semana: number; // 0 = semana en curso, 1 = siguiente
  dia: number; // 0 = lunes
  hora: number;
  duracion: 1 | 2 | 3; // horas (se guarda en minutos)
  materia: string;
  profesor: number | null; // índice en PROFESORES
  aula: string | null;
  alumno: number | null; // índice en ALUMNOS
};

const TURNOS: TurnoSeed[] = [
  // --- Semana en curso ---
  { id: "seed-turno-01", semana: 0, dia: 0, hora: 8, duracion: 1, materia: "Matemática", profesor: 0, aula: "Aula 1", alumno: 0 },
  { id: "seed-turno-02", semana: 0, dia: 0, hora: 10, duracion: 2, materia: "Programación I", profesor: 1, aula: "Aula 2", alumno: 1 },
  { id: "seed-turno-03", semana: 0, dia: 0, hora: 16, duracion: 2, materia: "Inglés Técnico", profesor: 3, aula: "Aula 1", alumno: 2 },
  { id: "seed-turno-04", semana: 0, dia: 1, hora: 14, duracion: 3, materia: "Bases de Datos", profesor: 1, aula: "Aula 10", alumno: 3 },
  { id: "seed-turno-05", semana: 0, dia: 2, hora: 9, duracion: 2, materia: "Física", profesor: 0, aula: "Aula 2", alumno: 4 },
  { id: "seed-turno-06", semana: 0, dia: 3, hora: 15, duracion: 2, materia: "Química", profesor: 2, aula: "Laboratorio", alumno: 5 },
  // --- Semana siguiente ---
  { id: "seed-turno-07", semana: 1, dia: 0, hora: 12, duracion: 2, materia: "Bases de Datos", profesor: 1, aula: "Aula 11", alumno: 6 },
  { id: "seed-turno-08", semana: 1, dia: 1, hora: 8, duracion: 3, materia: "Química", profesor: 2, aula: "Laboratorio", alumno: 7 },
  { id: "seed-turno-09", semana: 1, dia: 2, hora: 14, duracion: 1, materia: "Inglés Técnico", profesor: 3, aula: "Aula 1", alumno: 8 },
  { id: "seed-turno-10", semana: 1, dia: 4, hora: 14, duracion: 2, materia: "Matemática", profesor: 0, aula: "Aula 10", alumno: 9 },
  // --- PENDIENTE: solo materia + fecha + hora (HU-C-01 "continuar configuración") ---
  { id: "seed-turno-11", semana: 1, dia: 3, hora: 10, duracion: 2, materia: "Programación I", profesor: null, aula: null, alumno: null },
];

// ------------------------------------------------------------
// Validación en memoria: el seed no debe generar datos que la propia
// lógica de negocio de la app rechazaría.
// ------------------------------------------------------------

function validarDatos(): void {
  const errores: string[] = [];
  const agendados = TURNOS.filter((t) => t.profesor !== null);

  for (const p of PROFESORES) {
    const ord = [...p.horarios].sort((a, b) => a.dia - b.dia || a.desde - b.desde);
    for (let i = 1; i < ord.length; i++) {
      const a = ord[i - 1];
      const b = ord[i];
      if (a.dia === b.dia && b.desde < a.hasta) {
        errores.push(`Horarios superpuestos en ${p.apellido}`);
      }
    }
    for (const h of p.horarios) {
      if (h.desde < 8 || h.hasta > 20 || h.desde >= h.hasta || h.dia < 0 || h.dia > 4) {
        errores.push(`Horario fuera de rango en ${p.apellido}`);
      }
    }
    // Mismas reglas que el formulario de contacto (HU-D-02): al menos uno,
    // teléfono de 8-15 dígitos, email válido.
    const contacto = ContactoSchema.safeParse({ telefono: p.telefono, email: p.email });
    if (!contacto.success) {
      errores.push(`${p.apellido}: contacto inválido (${contacto.error.issues.map((i) => i.message).join(", ")})`);
    }
  }

  // Cada materia activa debe tener al menos un profesor ACTIVO que la dicte.
  const materiasCubiertas = new Set(
    PROFESORES.filter((p) => p.activo).flatMap((p) => p.materias),
  );
  for (const m of MATERIAS.filter((x) => x.activa)) {
    if (!materiasCubiertas.has(m.nombre)) errores.push(`Materia sin profesor activo: ${m.nombre}`);
  }

  const materiasActivas = new Set(MATERIAS.filter((m) => m.activa).map((m) => m.nombre));
  const aulasActivas = new Set(AULAS.filter((a) => a.activa).map((a) => a.nombre));

  for (const t of TURNOS) {
    if (!materiasActivas.has(t.materia)) errores.push(`${t.id}: materia inactiva`);
  }

  for (const t of agendados) {
    const prof = PROFESORES[t.profesor!];
    const fin = t.hora + t.duracion;
    if (!prof.activo) errores.push(`${t.id}: profesor inactivo`);
    if (!prof.materias.includes(t.materia)) {
      errores.push(`${t.id}: ${prof.apellido} no dicta ${t.materia}`);
    }
    const dentro = prof.horarios.some(
      (h) => h.dia === t.dia && t.hora >= h.desde && fin <= h.hasta,
    );
    if (!dentro) errores.push(`${t.id}: fuera del horario de ${prof.apellido}`);
    if (t.alumno === null || t.aula === null) {
      errores.push(`${t.id}: agendado sin alumno o aula`);
    } else {
      if (!ALUMNOS[t.alumno].activo) errores.push(`${t.id}: alumno inactivo`);
      if (!aulasActivas.has(t.aula)) errores.push(`${t.id}: aula inactiva`);
    }
  }

  for (let i = 0; i < agendados.length; i++) {
    for (let j = i + 1; j < agendados.length; j++) {
      const a = agendados[i];
      const b = agendados[j];
      if (a.semana !== b.semana || a.dia !== b.dia) continue;
      const solapan = a.hora < b.hora + b.duracion && b.hora < a.hora + a.duracion;
      if (solapan && a.profesor === b.profesor) errores.push(`${a.id}/${b.id}: mismo profesor`);
      if (solapan && a.aula === b.aula) errores.push(`${a.id}/${b.id}: misma aula`);
      if (solapan && a.alumno === b.alumno) errores.push(`${a.id}/${b.id}: mismo alumno`);
    }
  }

  if (errores.length > 0) {
    throw new Error(`Datos del seed inválidos:\n - ${errores.join("\n - ")}`);
  }
}

// ------------------------------------------------------------
// Seed
// ------------------------------------------------------------

async function main() {
  validarDatos();
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_COST);

  async function upsertUsuario(email: string, rol: RolUsuario, activo = true) {
    const u = await prisma.usuario.upsert({
      where: { emailUsuario: email },
      update: { passwordHashUsuario: passwordHash, rolUsuario: rol, activoUsuario: activo },
      create: {
        emailUsuario: email,
        passwordHashUsuario: passwordHash,
        rolUsuario: rol,
        activoUsuario: activo,
      },
    });
    return u.idUsuario;
  }

  // 1) Usuarios ------------------------------------------------
  const gerenteId = await upsertUsuario("gerente@noctium.local", "GERENTE");
  const mesaEntradaId = await upsertUsuario("mesa.entrada@noctium.local", "MESA_ENTRADA");

  const usuarioProfesorIds = new Map<number, string>();
  for (let i = 0; i < PROFESORES.length; i++) {
    if (!PROFESORES[i].cuenta) continue;
    usuarioProfesorIds.set(i, await upsertUsuario(`profesor${i + 1}@noctium.local`, "PROFESOR"));
  }

  const alumnoEmails = new Map<number, string>(); // solo alumnos con cuenta
  const usuarioAlumnoIds = new Map<number, string>();
  for (let i = 0; i < ALUMNOS.length; i++) {
    const cuenta = ALUMNOS[i].cuenta;
    if (!cuenta) continue;
    const email = cuenta === "inactiva" ? "alumno.inactivo@noctium.local" : `alumno${pad(i + 1)}@noctium.local`;
    alumnoEmails.set(i, email);
    usuarioAlumnoIds.set(i, await upsertUsuario(email, "ALUMNO", cuenta === "activa"));
  }
  const totalUsuarios = 2 + usuarioProfesorIds.size + usuarioAlumnoIds.size;
  console.log(`✓ ${totalUsuarios} usuarios creados (1 inactivo)`);

  // 2) Formas de pago (catálogo) --------------------------------
  const formaPagoIds: string[] = [];
  for (const nombre of FORMAS_PAGO) {
    const fp = await prisma.formaPago.upsert({
      where: { nombreFormaPago: nombre },
      update: { activaFormaPago: true },
      create: { nombreFormaPago: nombre, activaFormaPago: true },
    });
    formaPagoIds.push(fp.idFormaPago);
  }
  console.log(`✓ ${formaPagoIds.length} formas de pago creadas`);

  // 3) Alumnos -------------------------------------------------
  const alumnoIds: string[] = [];
  for (let i = 0; i < ALUMNOS.length; i++) {
    const a = ALUMNOS[i];
    const n = i + 1;
    // Contacto variado: 0-1 ambos, 2 solo teléfono, 3 solo email (HU-B-02).
    const patron = i % 4;
    const email = alumnoEmails.get(i) ?? `alumno${pad(n)}@example.com`;
    const data = {
      nombreAlumno: a.nombre,
      apellidoAlumno: a.apellido,
      dniAlumno: `4010${String(n).padStart(4, "0")}`,
      fechaNacimientoAlumno: new Date(
        Date.UTC(1996 + (i % 10), i % 12, 3 + ((i * 2) % 25)),
      ),
      generoAlumno: a.genero,
      telefonoAlumno: patron === 3 ? null : `+54 11 5550-${1000 + n}`,
      emailAlumno: patron === 2 ? null : email,
      direccionAlumno: i % 3 === 0 ? null : `Calle ${100 + n * 7}, CABA`,
      // Algunos alumnos quedan "Sin preferencia" (formaPagoPreferidaId = null).
      formaPagoPreferidaId: i % 6 === 5 ? null : formaPagoIds[i % formaPagoIds.length],
      activoAlumno: a.activo,
      usuarioId: usuarioAlumnoIds.get(i) ?? null,
      creadoPorUsuarioId: mesaEntradaId,
    };
    const alumno = await prisma.alumno.upsert({
      where: { dniAlumno: data.dniAlumno },
      update: data,
      create: data,
    });
    alumnoIds.push(alumno.idAlumno);
  }

  // Limpieza de cuentas creadas por versiones previas del seed (ya sin ficha).
  await prisma.usuario.deleteMany({
    where: { emailUsuario: { in: CUENTAS_ALUMNO_LEGACY }, alumno: null },
  });

  const alumnosActivos = ALUMNOS.filter((a) => a.activo).length;
  console.log(
    `✓ ${alumnoIds.length} alumnos creados (${alumnosActivos} activos, ${alumnoIds.length - alumnosActivos} inactivo, ${ALUMNOS.filter((a) => !a.cuenta).length} sin cuenta)`,
  );

  // 4) Profesores ----------------------------------------------
  const profesorIds: string[] = [];
  for (let i = 0; i < PROFESORES.length; i++) {
    const p = PROFESORES[i];
    // Se guarda normalizado, igual que lo guarda HU-D-02 ("+54 11 5560-0001"
    // -> "+541155600001"); validarDatos() ya garantizó que parsea.
    const contacto = ContactoSchema.parse({ telefono: p.telefono, email: p.email });
    const data = {
      nombreProfesor: p.nombre,
      apellidoProfesor: p.apellido,
      dniProfesor: p.dni,
      fechaNacimientoProfesor: new Date(Date.UTC(p.nacimiento[0], p.nacimiento[1] - 1, p.nacimiento[2])),
      generoProfesor: p.genero,
      telefonoProfesor: contacto.telefono ?? null,
      emailProfesor: contacto.email ?? null,
      direccionProfesor: p.direccion,
      activoProfesor: p.activo,
      usuarioId: usuarioProfesorIds.get(i) ?? null,
      creadoPorUsuarioId: gerenteId,
    };
    const prof = await prisma.profesor.upsert({
      where: { dniProfesor: p.dni },
      update: data,
      create: data,
    });
    profesorIds.push(prof.idProfesor);
  }
  console.log(`✓ ${profesorIds.length} profesores creados (${PROFESORES.filter((p) => !p.activo).length} inactivo)`);

  // 5) Materias ------------------------------------------------
  const materiaIds = new Map<string, string>();
  for (const m of MATERIAS) {
    const mat = await prisma.materia.upsert({
      where: { nombreMateria: m.nombre },
      update: {
        codigoMateria: m.codigo,
        activaMateria: m.activa,
        creadoPorUsuarioId: gerenteId,
        nombreNormalizadaMateria: normalizarTexto(m.nombre),
      },
      create: {
        nombreMateria: m.nombre,
        codigoMateria: m.codigo,
        activaMateria: m.activa,
        creadoPorUsuarioId: gerenteId,
        nombreNormalizadaMateria: normalizarTexto(m.nombre),
      },
    });
    materiaIds.set(m.nombre, mat.idMateria);
  }
  console.log(
    `✓ ${materiaIds.size} materias creadas (${MATERIAS.filter((m) => !m.codigo).length} sin código, ${MATERIAS.filter((m) => !m.activa).length} inactiva)`,
  );

  // 6) Aulas ---------------------------------------------------
  const aulaIds = new Map<string, string>();
  for (const a of AULAS) {
    const aula = await prisma.aula.upsert({
      where: { nombreAula: a.nombre },
      update: { capacidadAula: a.capacidad, activaAula: a.activa, creadoPorUsuarioId: gerenteId },
      create: {
        nombreAula: a.nombre,
        capacidadAula: a.capacidad,
        activaAula: a.activa,
        creadoPorUsuarioId: gerenteId,
      },
    });
    aulaIds.set(a.nombre, aula.idAula);
  }
  console.log(`✓ ${aulaIds.size} aulas creadas (${AULAS.filter((a) => !a.activa).length} inactiva)`);

  // 7) ProfesorMateria + HorarioProfesor -----------------------
  let totalHorarios = 0;
  let totalAsociaciones = 0;
  for (let i = 0; i < PROFESORES.length; i++) {
    const p = PROFESORES[i];
    const profesorId = profesorIds[i];

    await prisma.profesorMateria.createMany({
      data: p.materias.map((nombre) => ({ profesorId, materiaId: materiaIds.get(nombre)! })),
      skipDuplicates: true,
    });
    totalAsociaciones += p.materias.length;

    await prisma.horarioProfesor.deleteMany({ where: { profesorId } });
    await prisma.horarioProfesor.createMany({
      data: p.horarios.map((h) => ({
        profesorId,
        diaSemanaHorario: DIAS[h.dia],
        horaDesdeHorario: hora(h.desde),
        horaHastaHorario: hora(h.hasta),
        creadoPorUsuarioId: gerenteId,
      })),
    });
    totalHorarios += p.horarios.length;
  }
  console.log(`✓ ${totalAsociaciones} asociaciones profesor-materia y ${totalHorarios} horarios de atención creados`);

  // 8) Turnos + TurnoAlumno ------------------------------------
  for (const t of TURNOS) {
    const agendado = t.profesor !== null;
    const data = {
      fechaTurno: fechaRelativa(t.semana, t.dia),
      horaInicioTurno: hora(t.hora),
      duracionMinutosTurno: t.duracion * 60,
      estadoTurno: agendado ? ("AGENDADO" as const) : ("PENDIENTE" as const),
      materiaId: materiaIds.get(t.materia)!,
      profesorId: agendado ? profesorIds[t.profesor!] : null,
      aulaId: t.aula ? aulaIds.get(t.aula)! : null,
      creadoPorUsuarioId: mesaEntradaId,
    };
    await prisma.turno.upsert({
      where: { idTurno: t.id },
      update: data,
      create: { idTurno: t.id, ...data },
    });

    // Exactamente un alumno por turno agendado; ninguno para el pendiente.
    await prisma.turnoAlumno.deleteMany({ where: { turnoId: t.id } });
    if (t.alumno !== null) {
      await prisma.turnoAlumno.create({
        data: { turnoId: t.id, alumnoId: alumnoIds[t.alumno] },
      });
    }
  }
  const agendados = TURNOS.filter((t) => t.profesor !== null).length;
  console.log(`✓ ${TURNOS.length} turnos creados (${agendados} AGENDADO, ${TURNOS.length - agendados} PENDIENTE)`);
  console.log(`✓ ${agendados} inscripciones alumno-turno creadas`);

  // 9) Parámetros del sistema ----------------------------------
  for (const [clave, valor] of Object.entries(PARAMETROS)) {
    await prisma.parametroSistema.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });
  }
  console.log(`✓ ${Object.keys(PARAMETROS).length} parámetros del sistema creados`);

  // 10) RolPermiso (HU-A-02) ------------------------------------
  // Matriz RBAC: se puebla incremental por módulo. El ping de renovación de
  // sesión está habilitado para los 4 roles (docs/specs/spec_modulo_A.md,
  // nota de sincronización HU-A-02). "materias:crear" es la primera acción
  // real de un módulo de negocio (HU-L-01) — exclusiva de Gerente
  // (spec_modulo_L.md §2.1). "alumnos:crear" (HU-B-01) es exclusiva de Mesa
  // de Entrada (spec_modulo_B.md §2.1).
  const ROLES: RolUsuario[] = ["MESA_ENTRADA", "PROFESOR", "GERENTE", "ALUMNO"];
  for (const rol of ROLES) {
    await prisma.rolPermiso.upsert({
      where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: "sesion:ping" } },
      update: {},
      create: { rolPermiso: rol, accionPermiso: "sesion:ping" },
    });
  }
  await prisma.rolPermiso.upsert({
    where: { rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "materias:crear" } },
    update: {},
    create: { rolPermiso: "GERENTE", accionPermiso: "materias:crear" },
  });
  await prisma.rolPermiso.upsert({
    where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "alumnos:crear" } },
    update: {},
    create: { rolPermiso: "MESA_ENTRADA", accionPermiso: "alumnos:crear" },
  });
  for (const rol of ["MESA_ENTRADA", "GERENTE", "PROFESOR"] as const) {
    await prisma.rolPermiso.upsert({
      where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: "turnos:leer" } },
      update: {},
      create: { rolPermiso: rol, accionPermiso: "turnos:leer" },
    });
  }
  // materias:leer (HU-L-02, spec_modulo_L.md §2.2): todo rol que necesite
  // consultar el catálogo al operar otro módulo — Gerente, Mesa de Entrada,
  // Profesor. Alumno queda afuera en este sprint (sin HU que lo requiera
  // todavía), mismo criterio que turnos:leer arriba.
  for (const rol of ["MESA_ENTRADA", "GERENTE", "PROFESOR"] as const) {
    await prisma.rolPermiso.upsert({
      where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: "materias:leer" } },
      update: {},
      create: { rolPermiso: rol, accionPermiso: "materias:leer" },
    });
  }
  console.log(
    `✓ ${ROLES.length + 8} permisos RBAC creados`,
  );

  // profesores:crear (HU-D-01): exclusivo de Gerente, no de los 4 roles.
  await prisma.rolPermiso.upsert({
    where: {
      rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "profesores:crear" },
    },
    update: {},
    create: { rolPermiso: "GERENTE", accionPermiso: "profesores:crear" },
  });
  console.log(`✓ 1 permiso RBAC creado (profesores:crear para GERENTE)`);

  // profesores:editar (HU-D-02, contacto; también lo usan HU-D-03/04):
  // exclusivo de Gerente. La migración 20260923015526_profesor_contacto_modificado_por
  // también lo inserta, para bases que no corran el seed.
  await prisma.rolPermiso.upsert({
    where: {
      rolPermiso_accionPermiso: { rolPermiso: "GERENTE", accionPermiso: "profesores:editar" },
    },
    update: {},
    create: { rolPermiso: "GERENTE", accionPermiso: "profesores:editar" },
  });
  console.log(`✓ 1 permiso RBAC creado (profesores:editar para GERENTE)`);

  // alumnos:editar (HU-B-02, contacto): exclusivo de Mesa de Entrada, mismo
  // criterio que alumnos:crear (HU-B-01). La migración
  // <timestamp>_alumnos_editar_permiso también lo inserta, para bases que
  // no corran el seed (mismo patrón que profesores:editar arriba).
  await prisma.rolPermiso.upsert({
    where: {
      rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADA", accionPermiso: "alumnos:editar" },
    },
    update: {},
    create: { rolPermiso: "MESA_ENTRADA", accionPermiso: "alumnos:editar" },
  });
  console.log(`✓ 1 permiso RBAC creado (alumnos:editar para MESA_ENTRADA)`);

  console.log(`\nSeed completo. Contraseña de todos los usuarios: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
