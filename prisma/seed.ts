// ============================================================
// Noctium — Seed de desarrollo (Sprint 1)
//
// Ejecutar con:  npx prisma db seed
// (o directo:    npx tsx prisma/seed.ts)
// `npx prisma migrate reset` también lo corre (prisma.config.ts → migrations.seed).
// Solo validar los datos, sin conectarse a la base:
//                SEED_SOLO_VALIDAR=1 npx tsx prisma/seed.ts
//
// CREDENCIALES: todos los usuarios usan la contraseña  Password123!
//
//   gerente@noctium.local            GERENTE
//   mesa.entrada@noctium.local       MESA_ENTRADA
//   profesor1..4@noctium.local       PROFESOR
//   alumno01..06@noctium.local       ALUMNO
//   alumno.inactivo@noctium.local    ALUMNO con activoUsuario = false
//                                    (probar "La cuenta está inactiva", HU-A-01)
// Los alumnos con cuenta tienen aceptados los términos vigentes ("1.0").
//
// Alumnos (HU-B-04): 40 fichas, 39 activas. Contacto variado (ambos, solo
// teléfono, solo email), normalizado igual que HU-B-02.
//
// Fichas SIN cuenta (HU-B-01 / HU-B-08): alumnos 07..15 y 18..40, el alumno
// inactivo 17 y el profesor inactivo. Sirven para probar el autorregistro con
// vinculación por código (HU-B-08 c4); varían en si tienen o no email
// verificable (c5). En dev el código NO se manda por mail: emailSenderConsola
// lo imprime en la consola de `next dev` ("[EMAIL] Para: ...").
//
// Ejemplos INACTIVOS (para probar filtros de listados): alumno 17,
// profesores 5 y "Sosa", materia "Historia de la Ciencia" y "Aula 12".
//
// Listado de profesores (HU-D-05): 22 profesores (2 páginas de 20 — el
// por_pagina default de ListarProfesoresQuerySchema, igual que alumnos, aulas
// y materias; paginacion_limite_default = 10 solo lo usa el listado de
// turnos), con apellidos con tilde y en minúscula/mayúscula (orden
// case/acento-insensitivo), "Avila/Ávila, Pedro" y dos "Pérez, Juan"
// (desempate por DNI), uno sin contacto, uno sin materias, uno con 4 materias
// y 3 intervalos el mismo día.
//
// Turnos (HU-C-*): 27, con fechas en DÍAS OPERATIVOS relativos a la fecha en
// que se corre el seed (0 = próximo día operativo después de hoy):
//  - 25 futuros en los próximos 11 días operativos (3 por día en los primeros
//    8): 3 PENDIENTE (sin profesor ni aula), 3 DISPONIBLE sin inscriptos,
//    parciales (ej. 6/20 en Aula 2, 12/30 en Aula 10) y 2 COMPLETO (Aula 1
//    10/10, Laboratorio 15/15). Giménez (profesor1) tiene 7 (+1 pasado).
//  - 2 en el PASADO a propósito (1 y 2 días operativos antes de hoy,
//    DISPONIBLE con inscriptos) para que el calendario muestre historial.
//  El cupo es la capacidad del aula; ningún turno usa "Sala individual" ni
//  "Sala grupal". Como el día de la semana de cada fecha depende de cuándo se
//  corre el seed, los profesores con turnos tienen una franja común todos los
//  días operativos, y validarDatos() valida contra el día REAL de la fecha.
//
// Es idempotente: se puede correr N veces sin duplicar datos.
//  - Usuarios / alumnos / profesores / materias / aulas / formas de pago /
//    parámetros: upsert por clave única.
//  - HorarioProfesor (sin clave única): se borra y recrea por profesor.
//  - Turnos: ids fijos ("seed-turno-XX"). Se borran todos los "seed-turno-*"
//    (con sus inscripciones y reservas, en cascada) y se recrean: así, al
//    re-correr el seed otro día, los turnos se "mueven" a las fechas nuevas
//    sin chocar a mitad de camino con la exclusión de reservas_turno.
//  - No toca datos que no sean del seed (ej. el alumno de prueba manual).
//  - No siembra tablas de runtime (TokenRevocado, IntentoLoginFallido,
//    IntentoRegistro, EventoSeguridad, CodigoVerificacion).
// ============================================================

import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type DiaSemana,
  type EstadoTurno,
  type Genero,
  type RolUsuario,
} from "@prisma/client";
import { normalizarTexto } from "../src/lib/normalizar-texto";
import { clavesOrdenProfesor } from "../src/lib/profesor-listado";
import { ContactoSchema } from "../src/server/shared/contacto.schema";
import { crearIdentidadAlumnoSchema } from "../src/server/alumnos/alumno.schema";
import { DURACIONES_PERMITIDAS_TURNO_MIN } from "../src/server/turnos/turno.schema";
import {
  DIAS_SEMANA,
  diaSemanaDeFecha,
  horaAMinutos,
  intervalosSeSuperponen,
  validarIntervaloHorario,
  type DiaSemanaValor,
} from "../src/lib/horario-atencion";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";
const BCRYPT_COST = 12;

// ------------------------------------------------------------
// Helpers de fecha/hora (todo en UTC para columnas @db.Date / @db.Time)
// ------------------------------------------------------------

const DIAS: DiaSemana[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

/** Fecha calendario de hoy (hora local) como valor @db.Date. */
function fechaDeHoy(ahora: Date): Date {
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

/** Suma días calendario a un @db.Date. */
function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

/** "HH:mm" como valor @db.Time (HorarioProfesor HU-D-04, Turno). */
function horaTime(hhmm: string): Date {
  const minutos = horaAMinutos(hhmm);
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutos / 60), minutos % 60, 0));
}

const minutosDe = (h: { desde: string; hasta: string }) => ({
  inicio: horaAMinutos(h.desde),
  fin: horaAMinutos(h.hasta),
});

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
  // Capacidad chica: el cupo de un turno es la capacidad de su aula
  // (spec_modulo_C.md Revisión 3). Quedan en el catálogo (selector de aulas),
  // pero ningún turno del seed las usa: la demo muestra cupos grupales.
  { nombre: "Sala individual", capacidad: 1, activa: true },
  { nombre: "Sala grupal", capacidad: 3, activa: true },
];

// dia: 0 = lunes; desde/hasta "HH:mm" (HU-D-04). Deben respetar los días,
// la franja y la granularidad de PARAMETROS — validarDatos() lo verifica con
// las mismas reglas que la app (validarIntervaloHorario).
type HorarioSeed = { dia: number; desde: string; hasta: string };

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
    // Franja común de turnos: 08-12 todos los días operativos.
    horarios: [
      { dia: 0, desde: "08:00", hasta: "12:00" },
      { dia: 1, desde: "08:00", hasta: "12:00" },
      { dia: 2, desde: "08:00", hasta: "12:00" },
      { dia: 3, desde: "08:00", hasta: "12:00" },
      { dia: 4, desde: "08:00", hasta: "12:00" },
      { dia: 4, desde: "14:00", hasta: "18:00" },
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
    // Franja común de turnos: 10-12 y 12-14 todos los días operativos.
    horarios: [
      // Intervalos contiguos (10-12 y 12-14): no deben considerarse superpuestos.
      { dia: 0, desde: "10:00", hasta: "12:00" },
      { dia: 0, desde: "12:00", hasta: "14:00" },
      { dia: 1, desde: "10:00", hasta: "14:00" },
      { dia: 1, desde: "14:00", hasta: "18:00" },
      { dia: 2, desde: "10:00", hasta: "14:00" },
      { dia: 3, desde: "10:00", hasta: "14:00" },
      { dia: 4, desde: "10:00", hasta: "14:00" },
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
    // Franja común de turnos: 14-18 todos los días operativos.
    horarios: [
      { dia: 0, desde: "14:00", hasta: "18:00" },
      { dia: 1, desde: "08:00", hasta: "12:00" },
      { dia: 1, desde: "14:00", hasta: "18:00" },
      { dia: 2, desde: "14:00", hasta: "18:00" },
      { dia: 3, desde: "14:00", hasta: "18:00" },
      { dia: 4, desde: "08:00", hasta: "12:00" },
      { dia: 4, desde: "14:00", hasta: "18:00" },
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
    // Franja común de turnos: 16-18 todos los días operativos.
    horarios: [
      { dia: 0, desde: "16:00", hasta: "20:00" },
      { dia: 1, desde: "16:00", hasta: "20:00" },
      { dia: 2, desde: "14:00", hasta: "18:00" },
      { dia: 3, desde: "16:00", hasta: "20:00" },
      { dia: 4, desde: "09:30", hasta: "11:00" },
      { dia: 4, desde: "16:00", hasta: "20:00" },
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
      { dia: 1, desde: "10:00", hasta: "12:00" },
      { dia: 3, desde: "08:00", hasta: "12:00" },
    ],
  },
  // --- Listado de profesores (HU-D-05): fichas sin cuenta ---
  {
    nombre: "Lucía",
    apellido: "Álvarez", // con tilde inicial: va entre las "A", no al final
    dni: "32200001",
    nacimiento: [1984, 2, 14],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0101",
    email: "lucia.alvarez@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Física"],
    horarios: [{ dia: 1, desde: "10:00", hasta: "12:00" }],
  },
  {
    // "Ávila, Pedro" y "Avila, Pedro": misma clave normalizada, desempata el
    // DNI (32200004 primero).
    nombre: "Pedro",
    apellido: "Ávila",
    dni: "32200009",
    nacimiento: [1980, 6, 1],
    genero: "MASCULINO",
    telefono: null,
    email: "pedro.avila.2@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Matemática"],
    horarios: [],
  },
  {
    nombre: "Pedro",
    apellido: "Avila",
    dni: "32200004",
    nacimiento: [1978, 9, 10],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0104",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Física"],
    horarios: [],
  },
  {
    nombre: "Diego",
    apellido: "benítez", // minúscula: va entre las "B", no después de la "Z"
    dni: "32200010",
    nacimiento: [1990, 4, 22],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0110",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Química"],
    horarios: [{ dia: 3, desde: "08:00", hasta: "10:00" }],
  },
  {
    // 4 materias ("Física, Matemática +2") y 3 intervalos el lunes, cargados
    // desordenados: el detalle los muestra por hora de inicio. Franja común
    // de turnos: 15-17 todos los días operativos.
    nombre: "Julián",
    apellido: "Castro",
    dni: "32200011",
    nacimiento: [1986, 12, 5],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0111",
    email: "julian.castro@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Matemática", "Física", "Química", "Programación I"],
    horarios: [
      { dia: 0, desde: "15:00", hasta: "17:00" },
      { dia: 0, desde: "08:00", hasta: "10:00" },
      { dia: 0, desde: "11:00", hasta: "12:00" },
      { dia: 1, desde: "15:00", hasta: "17:00" },
      { dia: 2, desde: "09:00", hasta: "10:30" },
      { dia: 2, desde: "15:00", hasta: "17:00" },
      { dia: 3, desde: "15:00", hasta: "17:00" },
      { dia: 4, desde: "15:00", hasta: "17:00" },
    ],
  },
  {
    nombre: "Tomás",
    apellido: "de la Fuente",
    dni: "32200012",
    nacimiento: [1983, 3, 30],
    genero: "MASCULINO",
    telefono: null,
    email: "tomas.delafuente@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Bases de Datos"],
    horarios: [],
  },
  {
    // Dos "Pérez, Juan" idénticos: desempata el DNI (33300001 primero).
    nombre: "Juan",
    apellido: "Pérez",
    dni: "33300002",
    nacimiento: [1975, 8, 8],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0302",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Programación I"],
    horarios: [],
  },
  {
    nombre: "Juan",
    apellido: "Pérez",
    dni: "33300001",
    nacimiento: [1981, 1, 19],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0301",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Bases de Datos"],
    horarios: [],
  },
  {
    // Ficha sin contacto (HU-D-01 sin HU-D-02): el listado muestra "—".
    nombre: "Rocío",
    apellido: "Ibarra",
    dni: "32200013",
    nacimiento: [1992, 10, 11],
    genero: "FEMENINO",
    telefono: null,
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Inglés Técnico"],
    horarios: [],
  },
  {
    // Sin materias asociadas: el listado muestra "—".
    nombre: "Emilia",
    apellido: "Quiroga",
    dni: "32200014",
    nacimiento: [1989, 7, 7],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0114",
    email: "emilia.quiroga@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: [],
    horarios: [],
  },
  {
    nombre: "Andrea",
    apellido: "Núñez",
    dni: "32200015",
    nacimiento: [1987, 5, 25],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0115",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Matemática", "Química"],
    horarios: [{ dia: 4, desde: "10:00", hasta: "12:00" }],
  },
  {
    nombre: "Ramiro",
    apellido: "Sosa",
    dni: "32200016",
    nacimiento: [1968, 11, 3],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0116",
    email: null,
    direccion: null,
    cuenta: false,
    activo: false, // inactivo
    materias: ["Bases de Datos"],
    horarios: [],
  },
  {
    // Valores largos: el listado los recorta, el detalle los muestra completos.
    nombre: "María José",
    apellido: "Fernández de la Torre y Villanueva",
    dni: "32200017",
    nacimiento: [1982, 2, 28],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0117",
    email: "mariajose.fernandezdelatorreyvillanueva@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Inglés Técnico", "Programación I", "Bases de Datos"],
    horarios: [],
  },
  {
    nombre: "Esteban",
    apellido: "Luna",
    dni: "32200018",
    nacimiento: [1991, 9, 15],
    genero: null,
    telefono: "+54 11 5560-0118",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Física"],
    horarios: [],
  },
  {
    nombre: "Gabriela",
    apellido: "OLMEDO", // mayúsculas: ordena igual que "Olmedo"
    dni: "32200019",
    nacimiento: [1985, 6, 18],
    genero: "FEMENINO",
    telefono: null,
    email: "gabriela.olmedo@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Química"],
    horarios: [],
  },
  {
    nombre: "Hernán",
    apellido: "Toledo",
    dni: "32200020",
    nacimiento: [1979, 12, 12],
    genero: "MASCULINO",
    telefono: "+54 11 5560-0120",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Matemática"],
    horarios: [],
  },
  {
    nombre: "Paula",
    apellido: "Ybáñez",
    dni: "32200021",
    nacimiento: [1993, 3, 3],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0121",
    email: null,
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Inglés Técnico"],
    horarios: [],
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
  // --- Fichas sin cuenta para llenar turnos grupales (demo). Se agregan al
  // final para no cambiar el DNI de las anteriores (se deriva del índice). ---
  { nombre: "Emilia", apellido: "Acosta", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Santiago", apellido: "Gómez", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Catalina", apellido: "Ibáñez", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Thiago", apellido: "Medina", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Renata", apellido: "Suárez", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Ignacio", apellido: "Vázquez", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Abril", apellido: "Rojas", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Maximiliano", apellido: "Ortiz", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Milagros", apellido: "Giménez", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Emiliano", apellido: "Figueroa", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Zoe", apellido: "Aguirre", genero: "OTRO", cuenta: null, activo: true },
  { nombre: "Gonzalo", apellido: "Ramírez", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Delfina", apellido: "Navarro", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Franco", apellido: "Peralta", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Ailén", apellido: "Cabrera", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Lautaro", apellido: "Domínguez", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Josefina", apellido: "Morales", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Valentín", apellido: "Ríos", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Micaela", apellido: "Luna", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Bautista", apellido: "Sosa", genero: "PREFIERO_NO_INDICARLO", cuenta: null, activo: true },
  { nombre: "Antonella", apellido: "Quiroga", genero: "FEMENINO", cuenta: null, activo: true },
  { nombre: "Ezequiel", apellido: "Muñoz", genero: "MASCULINO", cuenta: null, activo: true },
  { nombre: "Guadalupe", apellido: "Ledesma", genero: null, cuenta: null, activo: true },
];

/** DNI de la ficha i (se deriva del índice: no reordenar ALUMNOS). */
const dniAlumno = (i: number) => `4010${String(i + 1).padStart(4, "0")}`;

/**
 * Contacto de la ficha i, tal como se tipearía en el formulario (HU-B-02).
 * Varía: 0-1 ambos, 2 solo teléfono, 3 solo email. Se guarda normalizado.
 */
function contactoCrudoAlumno(i: number, emailCuenta: string | undefined) {
  const n = i + 1;
  const patron = i % 4;
  return {
    telefono: patron === 3 ? null : `+54 11 5550-${1000 + n}`,
    email: patron === 2 ? null : (emailCuenta ?? `alumno${pad(n)}@example.com`),
  };
}

/** Email de la cuenta del alumno i, o undefined si es una ficha sin cuenta. */
function emailCuentaAlumno(i: number): string | undefined {
  const cuenta = ALUMNOS[i].cuenta;
  if (!cuenta) return undefined;
  return cuenta === "inactiva" ? "alumno.inactivo@noctium.local" : `alumno${pad(i + 1)}@noctium.local`;
}

/** Fecha de nacimiento de la ficha i como @db.Date. */
const nacimientoAlumno = (i: number) => new Date(Date.UTC(1996 + (i % 10), i % 12, 3 + ((i * 2) % 25)));

// Aceptación de términos de los alumnos con cuenta (HU-B-08 c7).
const TERMINOS_ACEPTADOS_EN = new Date(Date.UTC(2026, 8, 1, 12, 0, 0));

// Cuentas de alumno que creaba una versión previa del seed (todos los alumnos
// tenían cuenta). Ya no corresponden: esas fichas ahora no tienen cuenta.
const CUENTAS_ALUMNO_LEGACY = Array.from({ length: 9 }, (_, i) => `alumno${pad(i + 7)}@noctium.local`);

const PARAMETROS: Record<string, string> = {
  // Turnos y calendario (la duración del turno la elige Mesa de Entradas entre
  // DURACIONES_PERMITIDAS_TURNO_MIN — spec_modulo_C.md Revisión 4 — no es un parámetro)
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

const PARAMETROS_HORARIO = {
  diasOperativos: PARAMETROS.dias_operativos!
    .split(",")
    .filter((dia): dia is DiaSemanaValor => (DIAS_SEMANA as readonly string[]).includes(dia)),
  apertura: PARAMETROS.horario_operativo_desde!,
  cierre: PARAMETROS.horario_operativo_hasta!,
  granularidadMinutos: Number(PARAMETROS.granularidad_turno_minutos),
};

// Matriz RBAC (HU-A-02): una fila [rol, acción] por permiso sembrado. Varias
// migraciones también insertan algunas, para bases que no corran el seed.
const PERMISOS: [RolUsuario, string][] = [
  // Ping de renovación de sesión: los 4 roles (spec_modulo_A.md, nota de
  // sincronización HU-A-02).
  ["MESA_ENTRADA", "sesion:ping"],
  ["PROFESOR", "sesion:ping"],
  ["GERENTE", "sesion:ping"],
  ["ALUMNO", "sesion:ping"],
  // materias:crear (HU-L-01, spec_modulo_L.md §2.1): exclusiva de Gerente.
  ["GERENTE", "materias:crear"],
  // materias:leer (HU-L-02, spec_modulo_L.md §2.2): todo rol que consulte el
  // catálogo al operar otro módulo. Alumno queda afuera en este sprint.
  ["MESA_ENTRADA", "materias:leer"],
  ["GERENTE", "materias:leer"],
  ["PROFESOR", "materias:leer"],
  // aulas:crear (HU-K-01) y aulas:leer (HU-K-02 §4.3): exclusivas de Gerente
  // por decisión de producto del backlog oficial.
  ["GERENTE", "aulas:crear"],
  ["GERENTE", "aulas:leer"],
  // Alumnos (HU-B-01 alta, HU-B-02 contacto, HU-B-04 listado/detalle):
  // exclusivos de Mesa de Entrada (spec_modulo_B.md §2.1). Turnos consume
  // Alumno vía servicio público, no por estos permisos.
  ["MESA_ENTRADA", "alumnos:crear"],
  ["MESA_ENTRADA", "alumnos:editar"],
  ["MESA_ENTRADA", "alumnos:leer"],
  // Profesores (HU-D-01..05): exclusivos de Mesa de Entrada
  // (ver ACCIONES_SOLO_MESA_ENTRADA).
  ["MESA_ENTRADA", "profesores:crear"],
  ["MESA_ENTRADA", "profesores:editar"],
  ["MESA_ENTRADA", "profesores:leer"],
  // turnos:leer: Mesa de Entrada, Gerente y Profesor.
  ["MESA_ENTRADA", "turnos:leer"],
  ["GERENTE", "turnos:leer"],
  ["PROFESOR", "turnos:leer"],
  // turnos:crear (HU-C-03), asignar_participantes (HU-C-04) y asignar_aula
  // (HU-C-15, también en la migración 20260924150000): exclusivos de Mesa de
  // Entrada.
  ["MESA_ENTRADA", "turnos:crear"],
  ["MESA_ENTRADA", "turnos:asignar_participantes"],
  ["MESA_ENTRADA", "turnos:asignar_aula"],
  // calendario:leer (HU-J-01, spec_modulo_J.md §2): agenda semanal de solo
  // lectura; el Profesor solo ve la suya (lo resuelve el servicio del
  // módulo J, no el permiso).
  ["MESA_ENTRADA", "calendario:leer"],
  ["GERENTE", "calendario:leer"],
  ["PROFESOR", "calendario:leer"],
];

// Acciones que migraciones viejas dieron a otros roles y hoy son exclusivas de
// Mesa de Entrada: el seed borra esas filas (ver paso 10 de main()).
const ACCIONES_SOLO_MESA_ENTRADA = ["profesores:crear", "profesores:editar", "profesores:leer"] as const;

type TurnoSeed = {
  id: string;
  // Días OPERATIVOS (dias_operativos) relativos a hoy: 0 = próximo día
  // operativo después de hoy, 1 = el siguiente, ...; -1 = último día
  // operativo antes de hoy (turnos pasados, historial del calendario).
  diaOperativo: number;
  hora: string; // "HH:mm"
  duracionMin: number; // uno de DURACIONES_PERMITIDAS_TURNO_MIN
  materia: string;
  profesor: number | null; // índice en PROFESORES; null = PENDIENTE
  aula: string | null;
  alumnos: number[]; // índices en ALUMNOS
  // Sin cupo propio: cupoMaximoTurno = capacidad del aula (Revisión 3); el
  // estado sale de inscriptos vs. cupo (estadoDeTurno).
};

/** Índices a..b (ambos incluidos) de ALUMNOS. */
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Profesores: 0 Giménez (08-12), 1 Rossi (10-12 / 12-14), 2 Vega (14-18),
// 3 Acuña (16-18), 9 Castro (15-17) — franjas comunes a todos los días
// operativos (ver PROFESORES). ALUMNOS[16] (Bruno Paz) es inactivo.
const TURNOS: TurnoSeed[] = [
  // Día operativo 0
  { id: "seed-turno-01", diaOperativo: 0, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(0, 9) }, // COMPLETO 10/10
  { id: "seed-turno-02", diaOperativo: 0, hora: "10:00", duracionMin: 120, materia: "Programación I", profesor: 1, aula: "Aula 2", alumnos: rango(17, 22) },
  { id: "seed-turno-03", diaOperativo: 0, hora: "16:00", duracionMin: 120, materia: "Inglés Técnico", profesor: 3, aula: "Aula 10", alumnos: rango(23, 34) }, // 12/30
  // Día operativo 1
  { id: "seed-turno-04", diaOperativo: 1, hora: "14:00", duracionMin: 120, materia: "Química", profesor: 2, aula: "Laboratorio", alumnos: rango(0, 14) }, // COMPLETO 15/15
  { id: "seed-turno-05", diaOperativo: 1, hora: "10:00", duracionMin: 120, materia: "Física", profesor: 0, aula: "Aula 2", alumnos: [] }, // sin inscriptos
  { id: "seed-turno-06", diaOperativo: 1, hora: "12:00", duracionMin: 60, materia: "Bases de Datos", profesor: 1, aula: "Aula 1", alumnos: rango(17, 20) },
  // Día operativo 2
  { id: "seed-turno-07", diaOperativo: 2, hora: "08:00", duracionMin: 60, materia: "Física", profesor: 0, aula: "Aula 1", alumnos: rango(20, 24) },
  { id: "seed-turno-08", diaOperativo: 2, hora: "12:00", duracionMin: 120, materia: "Bases de Datos", profesor: 1, aula: "Aula 11", alumnos: rango(0, 7) },
  { id: "seed-turno-09", diaOperativo: 2, hora: "15:00", duracionMin: 120, materia: "Matemática", profesor: 9, aula: "Aula 2", alumnos: [] }, // sin inscriptos
  // Día operativo 3
  { id: "seed-turno-10", diaOperativo: 3, hora: "10:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 10", alumnos: rango(25, 36) }, // 12/30
  { id: "seed-turno-11", diaOperativo: 3, hora: "14:00", duracionMin: 120, materia: "Química", profesor: null, aula: null, alumnos: [] }, // PENDIENTE
  { id: "seed-turno-13", diaOperativo: 3, hora: "16:00", duracionMin: 120, materia: "Programación I", profesor: 3, aula: "Laboratorio", alumnos: rango(1, 6) },
  // Día operativo 4
  { id: "seed-turno-14", diaOperativo: 4, hora: "08:00", duracionMin: 120, materia: "Física", profesor: 0, aula: "Aula 2", alumnos: rango(0, 5) }, // 6/20
  { id: "seed-turno-15", diaOperativo: 4, hora: "10:00", duracionMin: 120, materia: "Programación I", profesor: 1, aula: "Aula 11", alumnos: rango(17, 29) },
  { id: "seed-turno-16", diaOperativo: 4, hora: "14:00", duracionMin: 180, materia: "Química", profesor: 2, aula: "Aula 10", alumnos: rango(30, 39) },
  // Día operativo 5
  { id: "seed-turno-17", diaOperativo: 5, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: [] }, // sin inscriptos
  { id: "seed-turno-18", diaOperativo: 5, hora: "16:00", duracionMin: 60, materia: "Inglés Técnico", profesor: null, aula: null, alumnos: [] }, // PENDIENTE (Acuña 16-18)
  { id: "seed-turno-19", diaOperativo: 5, hora: "15:00", duracionMin: 120, materia: "Física", profesor: 9, aula: "Laboratorio", alumnos: rango(2, 9) },
  // Día operativo 6
  { id: "seed-turno-20", diaOperativo: 6, hora: "12:00", duracionMin: 120, materia: "Programación I", profesor: 1, aula: "Aula 2", alumnos: rango(7, 15) },
  { id: "seed-turno-21", diaOperativo: 6, hora: "14:00", duracionMin: 120, materia: "Matemática", profesor: 2, aula: "Aula 1", alumnos: rango(17, 24) },
  { id: "seed-turno-22", diaOperativo: 6, hora: "16:00", duracionMin: 120, materia: "Inglés Técnico", profesor: 3, aula: "Aula 11", alumnos: rango(25, 39) },
  // Día operativo 7
  { id: "seed-turno-23", diaOperativo: 7, hora: "10:00", duracionMin: 120, materia: "Física", profesor: 0, aula: "Aula 10", alumnos: rango(17, 34) },
  { id: "seed-turno-24", diaOperativo: 7, hora: "12:00", duracionMin: 60, materia: "Bases de Datos", profesor: 1, aula: "Aula 1", alumnos: rango(1, 3) },
  { id: "seed-turno-25", diaOperativo: 7, hora: "15:00", duracionMin: 120, materia: "Programación I", profesor: null, aula: null, alumnos: [] }, // PENDIENTE
  // Día operativo 10
  { id: "seed-turno-12", diaOperativo: 10, hora: "10:00", duracionMin: 120, materia: "Bases de Datos", profesor: 1, aula: "Aula 2", alumnos: rango(0, 4) },
  // --- PASADOS a propósito (historial del calendario) ---
  { id: "seed-turno-26", diaOperativo: -1, hora: "10:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 2", alumnos: rango(0, 7) },
  { id: "seed-turno-27", diaOperativo: -2, hora: "16:00", duracionMin: 120, materia: "Programación I", profesor: 3, aula: "Aula 10", alumnos: rango(17, 28) },
];

/** Cupo máximo de un turno de seed: la capacidad de su aula, o null sin aula. */
function capacidadDeAula(nombre: string | null) {
  return nombre === null ? null : AULAS.find((a) => a.nombre === nombre)?.capacidad ?? null;
}

/** PENDIENTE sin profesor; si no, COMPLETO cuando los inscriptos llenan el cupo. */
function estadoDeTurno(t: TurnoSeed): EstadoTurno {
  if (t.profesor === null) return "PENDIENTE";
  const cupo = capacidadDeAula(t.aula);
  return cupo !== null && t.alumnos.length >= cupo ? "COMPLETO" : "DISPONIBLE";
}

/**
 * Fecha del n-ésimo día operativo relativo a `hoy` (ver TurnoSeed.diaOperativo),
 * saltando los días que no están en dias_operativos.
 */
function fechaOperativa(hoy: Date, n: number): Date {
  const paso = n >= 0 ? 1 : -1;
  let restantes = n >= 0 ? n + 1 : -n;
  let fecha = hoy;
  while (restantes > 0) {
    fecha = sumarDias(fecha, paso);
    if (PARAMETROS_HORARIO.diasOperativos.includes(diaSemanaDeFecha(fecha))) restantes--;
  }
  return fecha;
}

/** Fechas (@db.Date) de todos los turnos: se calculan una vez y las usan validación e insert. */
function calcularFechasTurnos(hoy: Date): Map<string, Date> {
  return new Map(TURNOS.map((t) => [t.id, fechaOperativa(hoy, t.diaOperativo)]));
}

// ------------------------------------------------------------
// Validación en memoria: el seed no debe generar datos que la propia
// lógica de negocio de la app rechazaría.
// ------------------------------------------------------------

function validarDatos(hoy: Date, fechas: Map<string, Date>): void {
  const errores: string[] = [];
  const agendados = TURNOS.filter((t) => t.profesor !== null);

  for (const p of PROFESORES) {
    // Mismas reglas que registrarHorarioProfesor() (HU-D-04).
    p.horarios.forEach((h, i) => {
      const error = validarIntervaloHorario(
        { diaSemana: DIAS[h.dia], horaInicio: h.desde, horaFin: h.hasta },
        PARAMETROS_HORARIO,
      );
      if (error) errores.push(`${p.apellido} ${DIAS[h.dia]} ${h.desde}-${h.hasta}: ${error.mensaje}`);
      for (const otro of p.horarios.slice(i + 1)) {
        if (otro.dia === h.dia && intervalosSeSuperponen(minutosDe(h), minutosDe(otro))) {
          errores.push(`Horarios superpuestos en ${p.apellido}`);
        }
      }
    });
    // Mismas reglas que el formulario de contacto (HU-D-02): al menos uno,
    // teléfono de 8-15 dígitos, email válido. Una ficha sin ningún contacto es
    // válida: HU-D-01 no lo pide y HU-D-02 todavía no se cargó (HU-D-05).
    if (p.telefono === null && p.email === null) continue;
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

  // Alumnos: identidad con el mismo schema del alta (HU-B-01) y contacto con
  // el de HU-B-02 — a diferencia de Profesor, toda ficha de alumno lo tiene.
  const identidadAlumno = crearIdentidadAlumnoSchema(
    Number(PARAMETROS.dni_longitud_min),
    Number(PARAMETROS.dni_longitud_max),
  );
  ALUMNOS.forEach((a, i) => {
    const identidad = identidadAlumno.safeParse({
      nombre: a.nombre,
      apellido: a.apellido,
      dni: dniAlumno(i),
      fecha_nacimiento: nacimientoAlumno(i).toISOString().slice(0, 10),
      genero: a.genero ?? undefined,
    });
    if (!identidad.success) {
      errores.push(`Alumno ${a.apellido}: identidad inválida (${identidad.error.issues.map((x) => x.message).join(", ")})`);
    }
    const contacto = ContactoSchema.safeParse(contactoCrudoAlumno(i, emailCuentaAlumno(i)));
    if (!contacto.success) {
      errores.push(`Alumno ${a.apellido}: contacto inválido (${contacto.error.issues.map((x) => x.message).join(", ")})`);
    }
  });

  const materiasActivas = new Set(MATERIAS.filter((m) => m.activa).map((m) => m.nombre));
  const aulasActivas = new Set(AULAS.filter((a) => a.activa).map((a) => a.nombre));
  const apertura = horaAMinutos(PARAMETROS_HORARIO.apertura);
  const cierre = horaAMinutos(PARAMETROS_HORARIO.cierre);
  const fechaMaxima = sumarDias(hoy, Number(PARAMETROS.anticipacion_maxima_dias));
  const intervaloDe = (t: TurnoSeed) => {
    const inicio = horaAMinutos(t.hora);
    return { inicio, fin: inicio + t.duracionMin };
  };

  if (new Set(TURNOS.map((t) => t.id)).size !== TURNOS.length) errores.push("Ids de turno repetidos");

  // Mismas reglas que validarConfiguracionTurno() (HU-C-01), salvo
  // FECHA_PASADA: los diaOperativo < 0 son historial a propósito.
  for (const t of TURNOS) {
    const fecha = fechas.get(t.id)!;
    const dia = diaSemanaDeFecha(fecha);
    const { inicio, fin } = intervaloDe(t);
    if (!materiasActivas.has(t.materia)) errores.push(`${t.id}: materia inactiva`);
    if (fecha > fechaMaxima) errores.push(`${t.id}: supera anticipacion_maxima_dias`);
    if (!PARAMETROS_HORARIO.diasOperativos.includes(dia)) errores.push(`${t.id}: día no operativo`);
    if (inicio % PARAMETROS_HORARIO.granularidadMinutos !== 0) errores.push(`${t.id}: hora no granular`);
    if (!(DURACIONES_PERMITIDAS_TURNO_MIN as readonly number[]).includes(t.duracionMin)) {
      errores.push(`${t.id}: duración ${t.duracionMin} no permitida`);
    }
    if (inicio < apertura || fin > cierre) errores.push(`${t.id}: fuera del horario operativo`);
    if (new Set(t.alumnos).size !== t.alumnos.length) errores.push(`${t.id}: alumno repetido`);

    if (t.profesor === null) {
      if (t.aula !== null || t.alumnos.length > 0) errores.push(`${t.id}: PENDIENTE con aula o alumnos`);
      // Tiene que poder configurarse (HU-C-15): algún profesor activo que
      // dicte la materia, con horario que cubra el turno en el día REAL de la
      // fecha y libre de otros turnos agendados en ese intervalo.
      const configurable = PROFESORES.some(
        (p, idx) =>
          p.activo &&
          p.materias.includes(t.materia) &&
          p.horarios.some(
            (h) => DIAS[h.dia] === dia && inicio >= horaAMinutos(h.desde) && fin <= horaAMinutos(h.hasta),
          ) &&
          !agendados.some(
            (o) =>
              o.profesor === idx &&
              fechas.get(o.id)!.getTime() === fecha.getTime() &&
              intervalosSeSuperponen(intervaloDe(o), { inicio, fin }),
          ),
      );
      if (!configurable) {
        errores.push(`${t.id}: PENDIENTE sin profesor disponible para ${t.materia} (${dia} ${t.hora})`);
      }
      continue;
    }

    // Asignación de profesor, aula y participantes (HU-C-15 / HU-C-04).
    const prof = PROFESORES[t.profesor];
    if (!prof.activo) errores.push(`${t.id}: profesor inactivo`);
    if (!prof.materias.includes(t.materia)) {
      errores.push(`${t.id}: ${prof.apellido} no dicta ${t.materia}`);
    }
    // Contra el día de la semana REAL de la fecha calculada.
    const dentro = prof.horarios.some(
      (h) => DIAS[h.dia] === dia && inicio >= horaAMinutos(h.desde) && fin <= horaAMinutos(h.hasta),
    );
    if (!dentro) errores.push(`${t.id}: fuera del horario de ${prof.apellido} (${dia} ${t.hora})`);
    if (t.aula === null) {
      errores.push(`${t.id}: agendado sin aula`);
    } else if (!AULAS.some((a) => a.nombre === t.aula)) {
      errores.push(`${t.id}: aula inexistente`);
    } else {
      if (!aulasActivas.has(t.aula)) errores.push(`${t.id}: aula inactiva`);
      if (t.aula === "Sala individual" || t.aula === "Sala grupal") errores.push(`${t.id}: usa ${t.aula}`);
      if (t.alumnos.length > capacidadDeAula(t.aula)!) {
        errores.push(`${t.id}: ${t.alumnos.length} inscriptos superan la capacidad de ${t.aula}`);
      }
    }
    for (const i of t.alumnos) {
      if (!ALUMNOS[i]) errores.push(`${t.id}: alumno ${i} inexistente`);
      else if (!ALUMNOS[i].activo) errores.push(`${t.id}: alumno inactivo (${ALUMNOS[i].apellido})`);
    }
  }

  // Superposiciones de recursos entre turnos agendados (lo mismo que impide
  // la exclusión de reservas_turno en la base).
  for (let i = 0; i < agendados.length; i++) {
    for (let j = i + 1; j < agendados.length; j++) {
      const a = agendados[i];
      const b = agendados[j];
      if (fechas.get(a.id)!.getTime() !== fechas.get(b.id)!.getTime()) continue;
      if (!intervalosSeSuperponen(intervaloDe(a), intervaloDe(b))) continue;
      if (a.profesor === b.profesor) errores.push(`${a.id}/${b.id}: mismo profesor`);
      if (a.aula === b.aula) errores.push(`${a.id}/${b.id}: misma aula`);
      const compartidos = a.alumnos.filter((x) => b.alumnos.includes(x));
      if (compartidos.length > 0) errores.push(`${a.id}/${b.id}: alumnos superpuestos (${compartidos.join(", ")})`);
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
  const hoy = fechaDeHoy(new Date());
  const fechasTurnos = calcularFechasTurnos(hoy);
  validarDatos(hoy, fechasTurnos);
  if (process.env.SEED_SOLO_VALIDAR === "1") {
    console.log(`✓ Datos del seed válidos (${ALUMNOS.length} alumnos, ${TURNOS.length} turnos). No se escribió en la base.`);
    return;
  }
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

  const usuarioAlumnoIds = new Map<number, string>();
  for (let i = 0; i < ALUMNOS.length; i++) {
    const email = emailCuentaAlumno(i);
    if (!email) continue;
    usuarioAlumnoIds.set(i, await upsertUsuario(email, "ALUMNO", ALUMNOS[i].cuenta === "activa"));
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
    // Se guarda normalizado, igual que HU-B-02 ("+54 11 5550-1001" ->
    // "+541155501001"); validarDatos() ya garantizó que parsea.
    const contacto = ContactoSchema.parse(contactoCrudoAlumno(i, emailCuentaAlumno(i)));
    const conCuenta = usuarioAlumnoIds.has(i);
    const data = {
      nombreAlumno: a.nombre,
      apellidoAlumno: a.apellido,
      // Orden case/acento-insensitivo del listado (HU-B-04, spec_modulo_B.md
      // §2.4) — mismo criterio que nombreNormalizadaMateria de Materias.
      nombreNormalizadoAlumno: normalizarTexto(a.nombre),
      apellidoNormalizadoAlumno: normalizarTexto(a.apellido),
      dniAlumno: dniAlumno(i),
      fechaNacimientoAlumno: nacimientoAlumno(i),
      generoAlumno: a.genero,
      telefonoAlumno: contacto.telefono ?? null,
      emailAlumno: contacto.email ?? null,
      direccionAlumno: i % 3 === 0 ? null : `Calle ${100 + n * 7}, CABA`,
      // Términos aceptados al crear la cuenta (HU-B-08 c7); null en fichas sin cuenta.
      terminosAceptadosEn: conCuenta ? TERMINOS_ACEPTADOS_EN : null,
      versionTerminosAceptada: conCuenta ? PARAMETROS.terminos_version_vigente! : null,
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
    // -> "+541155600001"); validarDatos() ya garantizó que parsea. Sin ningún
    // contacto (ficha de HU-D-01 sin HU-D-02) no hay nada que normalizar.
    const contacto =
      p.telefono === null && p.email === null
        ? {}
        : ContactoSchema.parse({ telefono: p.telefono, email: p.email });
    const data = {
      nombreProfesor: p.nombre,
      apellidoProfesor: p.apellido,
      // Orden case/acento-insensitivo del listado (HU-D-05).
      ...clavesOrdenProfesor(p),
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
      update: {
        capacidadAula: a.capacidad,
        activaAula: a.activa,
        creadoPorUsuarioId: gerenteId,
        nombreNormalizadaAula: normalizarTexto(a.nombre),
      },
      create: {
        nombreAula: a.nombre,
        capacidadAula: a.capacidad,
        activaAula: a.activa,
        creadoPorUsuarioId: gerenteId,
        nombreNormalizadaAula: normalizarTexto(a.nombre),
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
        horaDesdeHorario: horaTime(h.desde),
        horaHastaHorario: horaTime(h.hasta),
        creadoPorUsuarioId: gerenteId,
      })),
    });
    totalHorarios += p.horarios.length;
  }
  console.log(`✓ ${totalAsociaciones} asociaciones profesor-materia y ${totalHorarios} horarios de atención creados`);

  // 8) Turnos + TurnoAlumno ------------------------------------
  // Borrar y recrear (no upsert): al re-correr otro día las fechas cambian, y
  // mover los turnos de a uno puede chocar transitoriamente con la posición
  // vieja de otro en la exclusión de reservas_turno. El borrado arrastra
  // turno_alumno y reservas_turno (ON DELETE CASCADE) y también limpia ids
  // "seed-turno-*" que ya no existan en TURNOS.
  await prisma.turno.deleteMany({ where: { idTurno: { startsWith: "seed-turno-" } } });
  for (const t of TURNOS) {
    // El trigger turno_sincronizar_reservas reserva profesor y aula al
    // insertar un turno DISPONIBLE/COMPLETO; turno_alumno_sincronizar_reserva
    // reserva a cada alumno al inscribirlo. Ninguno valida cupo, estado ni
    // fecha (solo la exclusión de superposiciones), así que un turno puede
    // crearse directo como COMPLETO o en el pasado y después recibir alumnos.
    await prisma.turno.create({
      data: {
        idTurno: t.id,
        fechaTurno: fechasTurnos.get(t.id)!,
        horaInicioTurno: horaTime(t.hora),
        duracionMinutosTurno: t.duracionMin,
        cupoMaximoTurno: capacidadDeAula(t.aula),
        estadoTurno: estadoDeTurno(t),
        materiaId: materiaIds.get(t.materia)!,
        profesorId: t.profesor !== null ? profesorIds[t.profesor] : null,
        aulaId: t.aula ? aulaIds.get(t.aula)! : null,
        creadoPorUsuarioId: mesaEntradaId,
      },
    });
    if (t.alumnos.length > 0) {
      await prisma.turnoAlumno.createMany({
        data: t.alumnos.map((i) => ({ turnoId: t.id, alumnoId: alumnoIds[i] })),
      });
    }
  }
  const porEstado = (estado: EstadoTurno) => TURNOS.filter((t) => estadoDeTurno(t) === estado).length;
  const pasados = TURNOS.filter((t) => t.diaOperativo < 0).length;
  console.log(
    `✓ ${TURNOS.length} turnos creados (${porEstado("DISPONIBLE")} DISPONIBLE, ${porEstado("COMPLETO")} COMPLETO, ${porEstado("PENDIENTE")} PENDIENTE; ${pasados} en el pasado)`,
  );
  console.log(`✓ ${TURNOS.reduce((total, t) => total + t.alumnos.length, 0)} inscripciones alumno-turno creadas`);

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
  // Matriz RBAC: se puebla incremental por módulo (ver PERMISOS). Las
  // acciones exclusivas de Mesa de Entrada que alguna migración insertó
  // también para otros roles (profesores:crear/editar/leer, p. ej. GERENTE en
  // 20260923200000_profesor_nombre_normalizado_y_leer_permiso) dejan filas
  // viejas en bases existentes: se borran acá, porque el upsert con
  // update: {} no las tocaría.
  for (const accion of ACCIONES_SOLO_MESA_ENTRADA) {
    await prisma.rolPermiso.deleteMany({
      where: { rolPermiso: { not: "MESA_ENTRADA" }, accionPermiso: accion },
    });
  }
  for (const [rol, accion] of PERMISOS) {
    await prisma.rolPermiso.upsert({
      where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: accion } },
      update: {},
      create: { rolPermiso: rol, accionPermiso: accion },
    });
  }
  console.log(`✓ ${PERMISOS.length} permisos RBAC creados (${new Set(PERMISOS.map(([, accion]) => accion)).size} acciones)`);

  console.log(`\nSeed completo. Contraseña de todos los usuarios: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
