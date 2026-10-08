// ============================================================
// Noctium — Seed de desarrollo (Sprint 1 y 2 + seed base del Sprint 3)
//
// Ejecutar con:  npx prisma db seed
// (o directo:    npx tsx prisma/seed.ts)
// `npx prisma migrate reset` también lo corre (prisma.config.ts → migrations.seed).
// Solo validar los datos, sin conectarse a la base:
//                SEED_SOLO_VALIDAR=1 npx tsx prisma/seed.ts
// Validar como si hoy fuera otra fecha (solo junto con SEED_SOLO_VALIDAR):
//                SEED_SOLO_VALIDAR=1 SEED_FECHA_HOY=2026-10-15 npx tsx prisma/seed.ts
//
// SPRINT 3 (PR-0.md §2.16): este archivo es el SEED BASE — catálogos, formas
// de pago, tarifas, parámetros, datos del centro, cuentas, fichas y clases.
// NO crea inscripciones, pagos, comprobantes, cajas ni clases dictadas: esos
// datos los crea el seed de escenarios llamando a los servicios de dominio
// (etapa 2 del PR 0), para que cumplan las mismas reglas que la aplicación.
// Las clases confirmadas quedan DISPONIBLE (con profesor, aula y cupo) y sin
// inscriptos: una clase llega a COMPLETO por sus inscripciones. El campo
// `alumnos` de TURNOS es el plan de inscriptos para ese seed de escenarios;
// validarDatos() lo sigue verificando. El historial de Indicadores (turnos
// pasados con inscriptos y pagos) deja de sembrarse acá: lo agregan como
// fixtures las HU de presentación (PR-0.md §2.16).
//
// La base se regenera con `npx prisma migrate reset` (decisión del PO): las
// migraciones del Sprint 3 exigen tablas de negocio vacías.
//
// DEMO INCREMENTO 2: los fixtures del guion de la demo están marcados con
// "// DEMO INCREMENTO 2 — Paso N" (ver DEMO y TURNOS) y validarDatos()
// verifica que cada caso siga apareciendo como se espera.
//
// CREDENCIALES: todos los usuarios usan la contraseña  Password123!
//
//   gerente@noctium.local            GERENTE (con ficha de gerente)
//   gerente2@noctium.local           GERENTE (con ficha de gerente)
//   mesa.entrada@noctium.local       MESA_ENTRADA (con ficha de mesa de entrada)
//   mesa.entrada2@noctium.local      MESA_ENTRADA (con ficha de mesa de entrada)
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
// Listado de profesores (HU-D-05): 24 profesores (2 páginas de 20 — el
// por_pagina default de ListarProfesoresQuerySchema, igual que alumnos, aulas
// y materias; paginacion_limite_default = 10 solo lo usa el listado de
// turnos), con apellidos con tilde y en minúscula/mayúscula (orden
// case/acento-insensitivo), "Avila/Ávila, Pedro" y dos "Pérez, Juan"
// (desempate por DNI), uno sin contacto, uno sin materias, uno con 4 materias
// y 3 intervalos el mismo día. El 24.º ("Zárate, Valeria", demo del
// Incremento 2) ordena último: solo agrega una fila al final de la página 2.
//
// HU-D-07 (modificar materias del profesor), solo agregados:
//  - Giménez (profesor1) suma 8 turnos futuros de Matemática (seed-turno-28..35,
//    días operativos 8 a 15): 11 en total que bloquean quitarle Matemática, para
//    paginar de a 10 el modal «Ver turnos».
//  - "Herrera, Mariana" (activa, sin cuenta) tiene asociada "Historia de la
//    Ciencia", que está INACTIVA: el selector la muestra tildada con "Inactiva".
//  - seed-turno-36: PENDIENTE de Castro + Química CON profesor asignado (sin
//    aula ni alumnos): no bloquea quitar Química, pero suma pendientes_afectados.
//
// Turnos (HU-C-*): 27 (+9 de HU-D-07, ver arriba, +2 de la demo del
// Incremento 2, ver DEMO), con fechas en DÍAS OPERATIVOS relativos a la fecha en
// que se corre el seed (0 = próximo día operativo después de hoy):
//  - 25 futuros en los próximos 11 días operativos (3 por día en los primeros
//    8): 3 PENDIENTE (sin profesor ni aula) y el resto DISPONIBLE. El plan de
//    inscriptos (`alumnos`) lleva algunos a parciales (ej. 6/20 en Aula 2) y
//    2 a COMPLETO (Aula 1 10/10, Laboratorio 15/15) cuando el seed de
//    escenarios los inscriba. Giménez (profesor1) tiene 7 (+1 pasado).
//  - 2 en el PASADO a propósito (1 y 2 días operativos antes de hoy,
//    DISPONIBLE) para que el calendario muestre historial.
//  El cupo es la capacidad del aula; ningún turno usa "Sala individual" ni
//  "Sala grupal". Como el día de la semana de cada fecha depende de cuándo se
//  corre el seed, los profesores con turnos tienen una franja común todos los
//  días operativos, y validarDatos() valida contra el día REAL de la fecha.
//
// Tarifas (HU-L-06): todas las materias nacen con tarifa (solo al crearlas:
// una segunda corrida no pisa los cambios de HU-L-06/L-07).
//
// Es idempotente: se puede correr N veces sin duplicar datos.
//  - Usuarios / alumnos / profesores / materias / aulas: upsert por clave única.
//  - Formas de pago: por el id fijo del catálogo migrado (formapago-*); la
//    rama de actualización no cambia nombre, estado ni esEfectivo (HU-I-07).
//  - Parámetros: los técnicos se actualizan; los que edita HU-N-01 y los datos
//    del centro solo se crean si faltan.
//  - Fichas de mesa de entrada y de gerente: por DNI, solo se crean si faltan.
//  - HorarioProfesor (sin clave única): se borra y recrea por profesor.
//  - Turnos: ids fijos ("seed-turno-XX"), solo se crean si faltan (no se
//    borran ni se mueven: conservan la fecha de la primera corrida y lo que
//    les hayan agregado las HU o el seed de escenarios).
//  - No toca datos que no sean del seed (ej. el alumno de prueba manual).
//  - No siembra tablas de runtime (TokenRevocado, IntentoLoginFallido,
//    IntentoRegistro, EventoSeguridad, CodigoVerificacion, TokenRecuperacion,
//    SolicitudRecuperacion).
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

/** Fecha calendario del centro como valor @db.Date, independiente del TZ del contenedor. */
function fechaDeHoy(ahora: Date): Date {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);
  return new Date(Date.UTC(valor("year"), valor("month") - 1, valor("day")));
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

// Catálogo de formas de pago por id ESTABLE (el de la migración
// 20260921210000), nunca por el nombre, que HU-I-07 puede cambiar. Solo
// «Efectivo» suma en el arqueo de caja (esEfectivo, PR-0.md §2.5). «Mercado
// Pago» es un cobro de mostrador ya realizado por ese medio, sin integración.
const FORMAS_PAGO: { id: string; nombre: string; esEfectivo: boolean }[] = [
  { id: "formapago-efectivo", nombre: "Efectivo", esEfectivo: true },
  { id: "formapago-transferencia", nombre: "Transferencia", esEfectivo: false },
  { id: "formapago-debito", nombre: "Débito", esEfectivo: false },
  { id: "formapago-mercado-pago", nombre: "Mercado Pago", esEfectivo: false },
];

// Códigos alfanuméricos sin guion (regla de HU-L-01, P-L8). Tarifa por hora en
// pesos (HU-L-06): se carga solo al crear la materia; con las duraciones
// permitidas (60/120/180) el precio de la clase siempre es entero.
const MATERIAS: { nombre: string; codigo: string | null; activa: boolean; tarifa: number }[] = [
  { nombre: "Matemática", codigo: "MAT101", activa: true, tarifa: 12000 },
  { nombre: "Física", codigo: "FIS101", activa: true, tarifa: 12000 },
  { nombre: "Programación I", codigo: "PRG101", activa: true, tarifa: 13000 },
  { nombre: "Bases de Datos", codigo: "BDD201", activa: true, tarifa: 11000 },
  { nombre: "Química", codigo: null, activa: true, tarifa: 10500 }, // sin código: se muestra "—"
  { nombre: "Inglés Técnico", codigo: null, activa: true, tarifa: 9000 },
  { nombre: "Historia de la Ciencia", codigo: "HIS101", activa: false, tarifa: 9500 },
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
  {
    // HU-D-07 AC1: activa con una materia INACTIVA asociada ("Historia de la
    // Ciencia"): el modo edición la muestra tildada con la etiqueta "Inactiva".
    // Se agrega al final para no cambiar el índice de los demás profesores.
    nombre: "Mariana",
    apellido: "Herrera",
    dni: "32200022",
    nacimiento: [1984, 8, 21],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0122",
    email: "mariana.herrera@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Química", "Historia de la Ciencia"],
    horarios: [],
  },
  {
    // DEMO INCREMENTO 2 — Pasos 1 y 2: profesora dedicada a la demo (ver
    // DEMO). Su franja del martes 18-20 no la usa ningún otro turno del seed,
    // salvo el conflicto puesto a propósito (seed-turno-demo-p1). La franja
    // 10-12 de todos los días ocupa el Laboratorio en el Paso 2.
    // Se agrega al final para no cambiar el índice de los demás profesores.
    nombre: "Valeria",
    apellido: "Zárate",
    dni: "32200023",
    nacimiento: [1987, 4, 9],
    genero: "FEMENINO",
    telefono: "+54 11 5560-0123",
    email: "valeria.zarate@example.com",
    direccion: null,
    cuenta: false,
    activo: true,
    materias: ["Física"],
    horarios: [
      { dia: 0, desde: "10:00", hasta: "12:00" },
      { dia: 1, desde: "10:00", hasta: "12:00" },
      { dia: 1, desde: "18:00", hasta: "20:00" },
      { dia: 2, desde: "10:00", hasta: "12:00" },
      { dia: 3, desde: "10:00", hasta: "12:00" },
      { dia: 4, desde: "10:00", hasta: "12:00" },
    ],
  },
];

/** Índice de la profesora de la demo del Incremento 2 (Zárate). */
const PROFESOR_DEMO = PROFESORES.findIndex((p) => p.dni === "32200023");

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

// Cuentas internas de prueba con su ficha (PR-0.md §2.7, HU-F y HU-G): al
// menos 2 de mesa de entrada (varias cajas abiertas, cierre por ausencia) y 2
// de gerente («al menos un gerente activo», HU-G-05). El email de la ficha es
// el de la cuenta. DNI único por tipo de ficha.
type PersonalSeed = {
  email: string;
  rol: "MESA_ENTRADA" | "GERENTE";
  nombre: string;
  apellido: string;
  dni: string;
  nacimiento: [number, number, number];
  genero: Genero | null;
  telefono: string | null;
};

const PERSONAL: PersonalSeed[] = [
  { email: "mesa.entrada@noctium.local", rol: "MESA_ENTRADA", nombre: "Marta", apellido: "Ruiz", dni: "25100001", nacimiento: [1985, 5, 14], genero: "FEMENINO", telefono: "+54 11 5570-0001" },
  { email: "mesa.entrada2@noctium.local", rol: "MESA_ENTRADA", nombre: "Pablo", apellido: "Ferreyra", dni: "25100002", nacimiento: [1990, 9, 3], genero: "MASCULINO", telefono: null },
  { email: "gerente@noctium.local", rol: "GERENTE", nombre: "Silvia", apellido: "Paredes", dni: "24100001", nacimiento: [1975, 2, 21], genero: "FEMENINO", telefono: "+54 11 5580-0001" },
  { email: "gerente2@noctium.local", rol: "GERENTE", nombre: "Roberto", apellido: "Quiroga", dni: "24100002", nacimiento: [1978, 11, 8], genero: "MASCULINO", telefono: null },
];

const PARAMETROS: Record<string, string> = {
  // Turnos y calendario (la duración del turno la elige Mesa de Entradas entre
  // DURACIONES_PERMITIDAS_TURNO_MIN — spec_modulo_C.md Revisión 4 — no es un parámetro)
  horario_operativo_desde: "08:00",
  horario_operativo_hasta: "20:00",
  granularidad_turno_minutos: "30",
  anticipacion_maxima_dias: "30",
  generacion_maxima_meses: "6",
  generacion_maxima_turnos: "40",
  nota_minima: "1",
  nota_maxima: "10",
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

// Parámetros que edita HU-N-01 y datos fijos del centro (comprobantes e
// impresiones, HU-I-11/I-12). La migración 20261008120100_sprint3_modelo ya
// los inserta; el seed los crea solo si faltan y NUNCA los pisa (rama de
// actualización vacía), para conservar los cambios hechos desde la pantalla.
// `generacion_maxima_dias` lo inserta 20260928150100 y no lo lee el código ni
// lo siembra este archivo (lo reemplazó generacion_maxima_meses, HU-C-17).
const PARAMETROS_CONFIGURABLES: Record<string, string> = {
  plazo_pago_horas: "24",
  cancelacion_anticipacion_horas: "24",
  umbral_presentismo: "75",
  centro_nombre: "Instituto Noctium",
  centro_domicilio: "Av. Siempreviva 742",
  centro_telefono: "351-4000000",
};

const PARAMETROS_HORARIO = {
  diasOperativos: PARAMETROS.dias_operativos!
    .split(",")
    .filter((dia): dia is DiaSemanaValor => (DIAS_SEMANA as readonly string[]).includes(dia)),
  apertura: PARAMETROS.horario_operativo_desde!,
  cierre: PARAMETROS.horario_operativo_hasta!,
  granularidadMinutos: Number(PARAMETROS.granularidad_turno_minutos),
};

// Matriz RBAC (HU-A-02): una fila [rol, acción] por permiso sembrado. Desde el
// Sprint 3 TODA la matriz está también en migraciones (la última es
// 20261008120200_sprint3_permisos): una base sin seed queda con exactamente
// estas filas. Tabla cerrada de acciones del sprint: PR-0.md §2.9.1.
const PERMISOS: [RolUsuario, string][] = [
  // Ping de renovación de sesión: los 4 roles (spec_modulo_A.md, nota de
  // sincronización HU-A-02).
  ["MESA_ENTRADA", "sesion:ping"],
  ["PROFESOR", "sesion:ping"],
  ["GERENTE", "sesion:ping"],
  ["ALUMNO", "sesion:ping"],
  // materias:crear (HU-L-01, spec_modulo_L.md §2.1): exclusiva de Gerente.
  ["GERENTE", "materias:crear"],
  ["GERENTE", "materias:editar"],
  // materias:leer (HU-L-02, spec_modulo_L.md §2.2): todo rol que consulte el
  // catálogo al operar otro módulo. Alumno queda afuera en este sprint.
  ["MESA_ENTRADA", "materias:leer"],
  ["GERENTE", "materias:leer"],
  ["PROFESOR", "materias:leer"],
  // aulas:crear (HU-K-01) y aulas:leer (HU-K-02 §4.3): exclusivas de Gerente
  // por decisión de producto del backlog oficial.
  ["GERENTE", "aulas:crear"],
  ["GERENTE", "aulas:editar"],
  ["GERENTE", "aulas:leer"],
  // Tarifas (HU-L-06/L-07): el Gerente las cambia (y con eso las ve); Mesa
  // de Entrada solo las ve. El Profesor tiene materias:leer y NO ve precios.
  ["GERENTE", "materias:cambiar_tarifa"],
  ["MESA_ENTRADA", "materias:ver_tarifa"],
  // Alumnos (HU-B-01 alta, HU-B-02 contacto, HU-B-04 listado/detalle):
  // crear/editar exclusivos de Mesa de Entrada (spec_modulo_B.md §2.1). Turnos
  // consume Alumno vía servicio público, no por estos permisos. Sprint 3:
  // el Gerente consulta alumnos (convención 8 d) y el Profesor pierde
  // alumnos:leer (convención 8 g: su acceso al historial es acotado, ver
  // PERMISOS_REVOCADOS). Baja y reactivación (HU-B-07): solo Mesa de Entrada.
  ["MESA_ENTRADA", "alumnos:crear"],
  ["MESA_ENTRADA", "alumnos:editar"],
  ["MESA_ENTRADA", "alumnos:leer"],
  ["GERENTE", "alumnos:leer"],
  ["MESA_ENTRADA", "alumnos:cambiar_estado"],
  // Profesores (HU-D-01..07): crear/editar exclusivos de Mesa de Entrada (ver
  // ACCIONES_SOLO_MESA_ENTRADA). Sprint 3 (HU-D-08): el Gerente consulta y
  // desactiva/reactiva; los datos y las materias los sigue editando Mesa.
  ["MESA_ENTRADA", "profesores:crear"],
  ["MESA_ENTRADA", "profesores:editar"],
  ["MESA_ENTRADA", "profesores:leer"],
  ["GERENTE", "profesores:leer"],
  ["GERENTE", "profesores:cambiar_estado"],
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
  ["MESA_ENTRADA", "turnos:cancelar"],
  ["MESA_ENTRADA", "turnos:reprogramar"],
  ["MESA_ENTRADA", "turnos:priorizar"],
  ["ALUMNO", "turnos:leer_propios"],
  ["ALUMNO", "turnos:solicitar_propio"],
  ["GERENTE", "formas_pago:crear"],
  ["GERENTE", "formas_pago:leer"],
  ["MESA_ENTRADA", "formas_pago:leer"],
  ["MESA_ENTRADA", "pagos:crear"],
  ["MESA_ENTRADA", "pagos:leer"],
  ["GERENTE", "pagos:leer"],
  ["MESA_ENTRADA", "clases:registrar"],
  ["PROFESOR", "clases:registrar"],
  ["MESA_ENTRADA", "examenes:registrar"],
  ["PROFESOR", "examenes:registrar"],
  ["MESA_ENTRADA", "historial:leer"],
  ["GERENTE", "historial:leer"],
  ["PROFESOR", "historial:leer"],
  ["GERENTE", "indicadores:leer"],
  // calendario:leer (HU-J-01, spec_modulo_J.md §2): agenda semanal de solo
  // lectura; el Profesor solo ve la suya (lo resuelve el servicio del
  // módulo J, no el permiso).
  ["MESA_ENTRADA", "calendario:leer"],
  ["GERENTE", "calendario:leer"],
  ["PROFESOR", "calendario:leer"],
  // --- Sprint 3: resto de la tabla cerrada (PR-0.md §2.9.1) ---
  // Cuenta propia (HU-A-06): junto con sesion:ping, la única acción que admite
  // una cuenta con «Debe cambiar la contraseña».
  ["MESA_ENTRADA", "cuenta:cambiar_password"],
  ["GERENTE", "cuenta:cambiar_password"],
  ["PROFESOR", "cuenta:cambiar_password"],
  ["ALUMNO", "cuenta:cambiar_password"],
  // Historial académico (HU-E-04, E-07, E-10, E-11; el alcance del Profesor
  // lo dan los helpers del módulo E) y «Mi historial» (HU-E-08).
  ["MESA_ENTRADA", "observaciones:registrar"],
  ["PROFESOR", "observaciones:registrar"],
  ["MESA_ENTRADA", "indicaciones:registrar"],
  ["PROFESOR", "indicaciones:registrar"],
  ["MESA_ENTRADA", "examenes:corregir"],
  ["PROFESOR", "examenes:corregir"],
  ["MESA_ENTRADA", "clases:corregir"],
  ["PROFESOR", "clases:corregir"],
  ["ALUMNO", "historial:leer_propio"],
  // Inscripciones y reservas (HU-C-14, HU-C-26).
  ["ALUMNO", "turnos:cancelar_propia"],
  ["MESA_ENTRADA", "reservas:leer"],
  // Pagos y comprobantes (HU-I-05, I-06, I-11). Mesa corrige con alcance
  // acotado (puedeCorregirPago); el Gerente no registra pagos.
  ["MESA_ENTRADA", "pagos:corregir"],
  ["GERENTE", "pagos:corregir"],
  ["ALUMNO", "pagos:leer_propios"],
  ["MESA_ENTRADA", "comprobantes:leer"],
  ["GERENTE", "comprobantes:leer"],
  ["ALUMNO", "comprobantes:leer_propios"],
  // Cajas (HU-I-12): Mesa, solo su propia caja; el Gerente ve todas y hace el
  // cierre por ausencia, pero no abre cajas ni registra movimientos.
  ["MESA_ENTRADA", "cajas:abrir"],
  ["MESA_ENTRADA", "cajas:movimiento"],
  ["MESA_ENTRADA", "cajas:cerrar"],
  ["MESA_ENTRADA", "cajas:leer"],
  ["GERENTE", "cajas:leer_todas"],
  ["GERENTE", "cajas:cerrar_ausencia"],
  // Formas de pago (HU-I-07; desactivar incluye reactivar).
  ["GERENTE", "formas_pago:editar"],
  ["GERENTE", "formas_pago:desactivar"],
  // Personal de mesa de entrada (HU-F), gerentes (HU-G) y configuración (HU-N-01).
  ["GERENTE", "personal:crear"],
  ["GERENTE", "personal:editar"],
  ["GERENTE", "personal:leer"],
  ["GERENTE", "personal:cambiar_estado"],
  ["GERENTE", "gerentes:crear"],
  ["GERENTE", "gerentes:editar"],
  ["GERENTE", "gerentes:leer"],
  ["GERENTE", "gerentes:cambiar_estado"],
  ["GERENTE", "configuracion:leer"],
  ["GERENTE", "configuracion:editar"],
];

// Acciones que migraciones viejas dieron a otros roles y son exclusivas de
// Mesa de Entrada: el seed borra esas filas (ver paso 10 de main()). Sprint 3
// (convención 8 d): profesores:leer ya NO está acá, porque el Gerente la tiene.
const ACCIONES_SOLO_MESA_ENTRADA = ["profesores:crear", "profesores:editar"] as const;

// Filas que un rol tuvo y perdió (también las borra la migración de permisos
// del Sprint 3). El upsert con update: {} no las quitaría de una base vieja.
const PERMISOS_REVOCADOS: [RolUsuario, string][] = [
  // Convención 8 g: el Profesor accede al historial solo con el alcance acotado.
  ["PROFESOR", "alumnos:leer"],
];

type TurnoSeed = {
  id: string;
  prioridad?: "ALTA" | "URGENTE";
  cancelado?: boolean;
  // PENDIENTE con profesor ya elegido y sin aula (HU-D-07: lo cuenta
  // `pendientes_afectados`). Sin este flag, PENDIENTE = sin profesor.
  pendiente?: boolean;
  // La fecha se fija con UNO de estos tres campos (validarDatos lo exige):
  // Días OPERATIVOS (dias_operativos) relativos a hoy: 0 = próximo día
  // operativo después de hoy, 1 = el siguiente, ...; -1 = último día
  // operativo antes de hoy (turnos pasados, historial del calendario).
  diaOperativo?: number;
  // n-ésima ocurrencia (1 = la primera) de ese día de la semana después de
  // hoy: para chocar con una franja recurrente de la generación masiva.
  semanal?: { dia: DiaSemana; ocurrencia: number };
  // Fecha absoluta (historial de Indicadores, ver planificarHistorico).
  fecha?: Date;
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
  // DEMO INCREMENTO 2 — Paso 2: seed-turno-01 ocupa 08-10 de la franja 08-12
  // de Giménez, así que el paso «Fecha y horario» marca 08:00-09:30 como
  // ocupados y ofrece 10:00, 10:30 y 11:00 (duración 1 h).
  { id: "seed-turno-01", diaOperativo: 0, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(0, 9) }, // COMPLETO 10/10
  // DEMO INCREMENTO 2 — Paso 2: ocupa el Aula 2 de 10 a 12 (no se ofrece a las 10:00).
  { id: "seed-turno-02", diaOperativo: 0, hora: "10:00", duracionMin: 120, materia: "Programación I", profesor: 1, aula: "Aula 2", alumnos: rango(17, 22), prioridad: "ALTA" },
  // DEMO INCREMENTO 2 — Paso 2: ocupa el Laboratorio de 10 a 12 (no se ofrece a las 10:00).
  { id: "seed-turno-demo-p2", diaOperativo: 0, hora: "10:00", duracionMin: 120, materia: "Física", profesor: PROFESOR_DEMO, aula: "Laboratorio", alumnos: rango(35, 38) }, // 4/15
  // DEMO INCREMENTO 2 — Paso 5: Inglés Técnico es la única materia que
  // alumno04 (González, Mateo) no tiene; este turno tiene lugar y él no
  // choca con nada a esa hora. En vivo: Inglés Técnico → Acuña → este horario.
  { id: "seed-turno-03", diaOperativo: 0, hora: "16:00", duracionMin: 120, materia: "Inglés Técnico", profesor: 3, aula: "Aula 10", alumnos: rango(23, 34) }, // 12/30
  // Día operativo 1
  { id: "seed-turno-04", diaOperativo: 1, hora: "14:00", duracionMin: 120, materia: "Química", profesor: 2, aula: "Laboratorio", alumnos: rango(0, 14) }, // COMPLETO 15/15
  { id: "seed-turno-05", diaOperativo: 1, hora: "10:00", duracionMin: 120, materia: "Física", profesor: 0, aula: "Aula 2", alumnos: [] }, // sin inscriptos
  { id: "seed-turno-06", diaOperativo: 1, hora: "12:00", duracionMin: 60, materia: "Bases de Datos", profesor: 1, aula: "Aula 1", alumnos: rango(17, 20) },
  // Día operativo 2
  { id: "seed-turno-07", diaOperativo: 2, hora: "08:00", duracionMin: 60, materia: "Física", profesor: 0, aula: "Aula 1", alumnos: rango(20, 24) },
  { id: "seed-turno-08", diaOperativo: 2, hora: "12:00", duracionMin: 120, materia: "Bases de Datos", profesor: 1, aula: "Aula 11", alumnos: rango(0, 7) },
  { id: "seed-turno-09", diaOperativo: 2, hora: "15:00", duracionMin: 120, materia: "Matemática", profesor: 9, aula: "Aula 2", alumnos: rango(0, 1), cancelado: true }, // CANCELADO futuro con inscriptos que tienen cuenta (ALUMNOS[0..1]): lo ven en "Mis turnos" (HU-C-13 v2)
  // Día operativo 3
  { id: "seed-turno-10", diaOperativo: 3, hora: "10:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 10", alumnos: rango(25, 36), prioridad: "URGENTE" }, // 12/30
  { id: "seed-turno-11", diaOperativo: 3, hora: "14:00", duracionMin: 120, materia: "Química", profesor: null, aula: null, alumnos: [] }, // PENDIENTE
  { id: "seed-turno-13", diaOperativo: 3, hora: "16:00", duracionMin: 120, materia: "Programación I", profesor: 3, aula: "Laboratorio", alumnos: rango(1, 6) },
  // Día operativo 4
  // DEMO INCREMENTO 2 — Paso 4: turno con inscriptos y SIN ningún pago. En vivo:
  // Física · Giménez · día operativo 4, 08:00 · Aula 2 (6/20) → «Registrar pago»
  // → alumna «Fernández, Sofía» (se precarga su forma preferida, Efectivo).
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
  // --- HU-D-07: Giménez + Matemática llega a 11 turnos futuros que bloquean
  // (3 de arriba + estos 8), para paginar de a 10 el modal «Ver turnos». ---
  { id: "seed-turno-28", diaOperativo: 8, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(20, 29) }, // COMPLETO 10/10
  { id: "seed-turno-29", diaOperativo: 9, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(0, 2) },
  { id: "seed-turno-30", diaOperativo: 10, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: [] },
  { id: "seed-turno-31", diaOperativo: 11, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(5, 9) },
  { id: "seed-turno-32", diaOperativo: 12, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: [] },
  { id: "seed-turno-33", diaOperativo: 13, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(10, 12) },
  { id: "seed-turno-34", diaOperativo: 14, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: [] },
  { id: "seed-turno-35", diaOperativo: 15, hora: "08:00", duracionMin: 120, materia: "Matemática", profesor: 0, aula: "Aula 1", alumnos: rango(30, 31) },
  // HU-D-07: PENDIENTE con profesor asignado (Castro, 15-17 todos los días), sin aula ni alumnos.
  { id: "seed-turno-36", diaOperativo: 9, hora: "15:00", duracionMin: 60, materia: "Química", profesor: 9, aula: null, alumnos: [], pendiente: true },
  // DEMO INCREMENTO 2 — Paso 1: el ÚNICO turno del seed en el Aula 11 un martes
  // de 18 a 20 (el segundo martes después de hoy). Al generar Física · Zárate ·
  // franja martes 18-20 · 2 h · 18:00 · Aula 11 · desde hoy hasta dentro de un
  // mes, la vista previa marca esa fecha «Aula ocupada» y el resto OK. Se
  // corrige cambiando el aula a «Aula 10» (libre todos los martes 18-20).
  { id: "seed-turno-demo-p1", semanal: { dia: "MARTES", ocurrencia: 2 }, hora: "18:00", duracionMin: 120, materia: "Programación I", profesor: 3, aula: "Aula 11", alumnos: rango(30, 34) }, // 5/35
];

// ------------------------------------------------------------
// DEMO INCREMENTO 2 (guion de 6 pasos). validarDatos() verifica cada caso.
// ------------------------------------------------------------

const DEMO = {
  // Paso 1 — Generar varios turnos con un conflicto de aula en UNA fecha.
  paso1: {
    profesor: PROFESOR_DEMO, materia: "Física", dia: "MARTES" as DiaSemana,
    hora: "18:00", duracionMin: 120, aula: "Aula 11", aulaLibre: "Aula 10",
    conflicto: "seed-turno-demo-p1", semanasRevisadas: 5,
  },
  // Paso 2 — Turno individual: Giménez + Matemática, primer día operativo,
  // duración 1 h, inicio 10:00 → aulas ocupadas: Aula 2 y Laboratorio.
  paso2: { profesor: 0, materia: "Matemática", diaOperativo: 0, hora: "10:00", duracionMin: 60, aulasOcupadas: ["Aula 2", "Laboratorio"] },
  // Paso 4 — Registrar pago en un turno con inscriptos y sin pagos.
  paso4: { turno: "seed-turno-14", alumno: 0 }, // Fernández, Sofía
  // Paso 5 — alumno04@noctium.local (González, Mateo) solicita Inglés Técnico.
  paso5: { alumno: 3, turno: "seed-turno-03" },
} as const;

/** Cupo máximo de un turno de seed: la capacidad de su aula, o null sin aula. */
function capacidadDeAula(nombre: string | null) {
  return nombre === null ? null : AULAS.find((a) => a.nombre === nombre)?.capacidad ?? null;
}

/**
 * Estado que tendrá la clase con su plan de inscriptos: PENDIENTE sin
 * profesor; si no, COMPLETO cuando los inscriptos llenan el cupo. Lo usa
 * validarDatos() para el plan del seed de escenarios.
 */
function estadoDeTurno(t: TurnoSeed): EstadoTurno {
  if (t.cancelado) return "CANCELADO";
  if (t.profesor === null || t.pendiente) return "PENDIENTE";
  const cupo = capacidadDeAula(t.aula);
  return cupo !== null && t.alumnos.length >= cupo ? "COMPLETO" : "DISPONIBLE";
}

/**
 * Estado con el que el seed BASE guarda la clase: todavía sin inscriptos, así
 * que una clase confirmada queda DISPONIBLE; llega a COMPLETO cuando el seed
 * de escenarios la llena con crearInscripcion (PR-0.md §2.0, «Seed»).
 */
function estadoSeedBase(t: TurnoSeed): EstadoTurno {
  const estado = estadoDeTurno(t);
  return estado === "COMPLETO" ? "DISPONIBLE" : estado;
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

/** n-ésima ocurrencia (1 = la primera) del día `dia` estrictamente después de `hoy`. */
function fechaSemanal(hoy: Date, dia: DiaSemana, ocurrencia: number): Date {
  let fecha = hoy;
  for (let restantes = ocurrencia; restantes > 0; ) {
    fecha = sumarDias(fecha, 1);
    if (diaSemanaDeFecha(fecha) === dia) restantes--;
  }
  return fecha;
}

/** Fecha de un turno de seed según el campo que la fija (ver TurnoSeed). */
function fechaDeTurno(hoy: Date, t: TurnoSeed): Date {
  if (t.fecha) return t.fecha;
  if (t.semanal) return fechaSemanal(hoy, t.semanal.dia, t.semanal.ocurrencia);
  return fechaOperativa(hoy, t.diaOperativo ?? 0);
}

/** Fechas (@db.Date) de todos los turnos: se calculan una vez y las usan validación e insert. */
function calcularFechasTurnos(hoy: Date, turnos: readonly TurnoSeed[]): Map<string, Date> {
  return new Map(turnos.map((t) => [t.id, fechaDeTurno(hoy, t)]));
}

// ------------------------------------------------------------
// Validación en memoria: el seed no debe generar datos que la propia
// lógica de negocio de la app rechazaría.
// ------------------------------------------------------------

function validarDatos(hoy: Date, turnos: readonly TurnoSeed[], fechas: Map<string, Date>): void {
  const errores: string[] = [];
  // Un PENDIENTE con profesor (HU-D-07) no reserva recursos: no entra acá.
  const agendados = turnos.filter((t) => t.profesor !== null && !t.pendiente);

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

  // Fichas del personal: misma identidad que un alta (nombre, apellido, DNI,
  // nacimiento) y contacto válido; DNI único por tipo de ficha y una ficha
  // por cuenta.
  for (const p of PERSONAL) {
    const identidad = identidadAlumno.safeParse({
      nombre: p.nombre,
      apellido: p.apellido,
      dni: p.dni,
      fecha_nacimiento: new Date(Date.UTC(...p.nacimiento)).toISOString().slice(0, 10),
      genero: p.genero ?? undefined,
    });
    if (!identidad.success) {
      errores.push(`Ficha ${p.email}: identidad inválida (${identidad.error.issues.map((x) => x.message).join(", ")})`);
    }
    if (!ContactoSchema.safeParse({ telefono: p.telefono, email: p.email }).success) {
      errores.push(`Ficha ${p.email}: contacto inválido`);
    }
  }
  if (new Set(PERSONAL.map((p) => p.email)).size !== PERSONAL.length) errores.push("Fichas del personal con email repetido");
  for (const rol of ["MESA_ENTRADA", "GERENTE"] as const) {
    const delRol = PERSONAL.filter((p) => p.rol === rol);
    if (delRol.length < 2) errores.push(`Se necesitan al menos 2 cuentas de ${rol} con ficha (PR-0.md §2.7)`);
    if (new Set(delRol.map((p) => p.dni)).size !== delRol.length) errores.push(`DNI repetido en fichas de ${rol}`);
  }

  // Tarifas (HU-L-06): enteras y positivas, así precioClase() da un entero.
  for (const m of MATERIAS) {
    if (!Number.isSafeInteger(m.tarifa) || m.tarifa <= 0) errores.push(`Materia ${m.nombre}: tarifa inválida`);
    if (m.codigo !== null && !/^[A-Za-z0-9]+$/.test(m.codigo)) errores.push(`Materia ${m.nombre}: código con caracteres no alfanuméricos`);
  }
  if (FORMAS_PAGO.filter((f) => f.esEfectivo).length !== 1) errores.push("Exactamente una forma de pago debe ser efectivo");

  const materiasActivas = new Set(MATERIAS.filter((m) => m.activa).map((m) => m.nombre));
  const aulasActivas = new Set(AULAS.filter((a) => a.activa).map((a) => a.nombre));
  const apertura = horaAMinutos(PARAMETROS_HORARIO.apertura);
  const cierre = horaAMinutos(PARAMETROS_HORARIO.cierre);
  const fechaMaxima = sumarDias(hoy, Number(PARAMETROS.anticipacion_maxima_dias));
  const intervaloDe = (t: TurnoSeed) => {
    const inicio = horaAMinutos(t.hora);
    return { inicio, fin: inicio + t.duracionMin };
  };

  if (new Set(turnos.map((t) => t.id)).size !== turnos.length) errores.push("Ids de turno repetidos");

  // Mismas reglas que validarConfiguracionTurno() (HU-C-01), salvo
  // FECHA_PASADA: los diaOperativo < 0 y el historial de Indicadores son
  // pasados a propósito.
  for (const t of turnos) {
    if ([t.diaOperativo, t.semanal, t.fecha].filter((x) => x !== undefined).length !== 1) {
      errores.push(`${t.id}: la fecha se fija con exactamente uno de diaOperativo, semanal o fecha`);
    }
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

    if (t.pendiente) {
      // PENDIENTE con profesor (HU-D-07): mismas reglas de profesor que un
      // agendado (activo, dicta la materia, dentro de su horario y libre),
      // pero sin aula ni alumnos todavía.
      const prof = t.profesor === null ? null : PROFESORES[t.profesor];
      if (!prof) errores.push(`${t.id}: PENDIENTE con profesor sin profesor`);
      else {
        if (!prof.activo) errores.push(`${t.id}: profesor inactivo`);
        if (!prof.materias.includes(t.materia)) errores.push(`${t.id}: ${prof.apellido} no dicta ${t.materia}`);
        const dentroPendiente = prof.horarios.some(
          (h) => DIAS[h.dia] === dia && inicio >= horaAMinutos(h.desde) && fin <= horaAMinutos(h.hasta),
        );
        if (!dentroPendiente) errores.push(`${t.id}: fuera del horario de ${prof.apellido} (${dia} ${t.hora})`);
        const ocupado = agendados.some(
          (o) =>
            o.profesor === t.profesor &&
            fechas.get(o.id)!.getTime() === fecha.getTime() &&
            intervalosSeSuperponen(intervaloDe(o), { inicio, fin }),
        );
        if (ocupado) errores.push(`${t.id}: ${prof.apellido} ya tiene un turno en ese horario`);
      }
      if (t.aula !== null || t.alumnos.length > 0) errores.push(`${t.id}: PENDIENTE con aula o alumnos`);
      continue;
    }

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

  const turnoPorId = new Map(turnos.map((t) => [t.id, t]));

  // DEMO INCREMENTO 2: cada paso del guion tiene que seguir funcionando.
  const mismaFecha = (o: TurnoSeed, fecha: Date) => fechas.get(o.id)!.getTime() === fecha.getTime();
  const intervaloDemo = (hora: string, duracionMin: number) => ({ inicio: horaAMinutos(hora), fin: horaAMinutos(hora) + duracionMin });
  const ocupan = (fecha: Date, intervalo: { inicio: number; fin: number }, filtro: (o: TurnoSeed) => boolean) =>
    agendados.filter((o) => mismaFecha(o, fecha) && filtro(o) && intervalosSeSuperponen(intervaloDe(o), intervalo));

  // Paso 1: en los próximos martes, UNA sola fecha con el aula ocupada, el
  // profesor libre en todas y el aula alternativa libre en todas.
  {
    const p1 = DEMO.paso1;
    const prof = PROFESORES[p1.profesor];
    const intervalo = intervaloDemo(p1.hora, p1.duracionMin);
    const enFranja = prof?.horarios.some(
      (h) => DIAS[h.dia] === p1.dia && intervalo.inicio >= horaAMinutos(h.desde) && intervalo.fin <= horaAMinutos(h.hasta),
    );
    if (!prof?.activo || !prof.materias.includes(p1.materia) || !enFranja) {
      errores.push(`DEMO Paso 1: ${prof?.apellido} no dicta ${p1.materia} en una franja ${p1.dia} ${p1.hora}`);
    }
    const conflictivas: string[] = [];
    for (let k = 1; k <= p1.semanasRevisadas; k++) {
      const fecha = fechaSemanal(hoy, p1.dia, k);
      if (ocupan(fecha, intervalo, (o) => o.aula === p1.aula).length > 0) conflictivas.push(fecha.toISOString().slice(0, 10));
      if (ocupan(fecha, intervalo, (o) => o.profesor === p1.profesor).length > 0) errores.push(`DEMO Paso 1: ${prof?.apellido} ocupado el ${fecha.toISOString().slice(0, 10)}`);
      if (ocupan(fecha, intervalo, (o) => o.aula === p1.aulaLibre).length > 0) errores.push(`DEMO Paso 1: ${p1.aulaLibre} ocupada el ${fecha.toISOString().slice(0, 10)}`);
    }
    const fechaConflicto = fechas.get(p1.conflicto)?.toISOString().slice(0, 10);
    if (conflictivas.length !== 1 || conflictivas[0] !== fechaConflicto) {
      errores.push(`DEMO Paso 1: se esperaba un único conflicto en ${p1.aula} (${fechaConflicto}), hay [${conflictivas.join(", ")}]`);
    }
  }

  // Paso 2: franja del profesor parcialmente ocupada ese día, el horario
  // elegido libre, y exactamente esas aulas ocupadas a esa hora.
  {
    const p2 = DEMO.paso2;
    const prof = PROFESORES[p2.profesor];
    const fecha = fechaOperativa(hoy, p2.diaOperativo);
    const intervalo = intervaloDemo(p2.hora, p2.duracionMin);
    const franja = prof.horarios.find(
      (h) => DIAS[h.dia] === diaSemanaDeFecha(fecha) && intervalo.inicio >= horaAMinutos(h.desde) && intervalo.fin <= horaAMinutos(h.hasta),
    );
    if (!prof.materias.includes(p2.materia) || !franja) {
      errores.push(`DEMO Paso 2: ${prof.apellido} no dicta ${p2.materia} a las ${p2.hora}`);
    } else if (ocupan(fecha, minutosDe(franja), (o) => o.profesor === p2.profesor).length === 0) {
      errores.push(`DEMO Paso 2: la franja de ${prof.apellido} está totalmente libre (no se ve ningún ocupado)`);
    }
    if (ocupan(fecha, intervalo, (o) => o.profesor === p2.profesor).length > 0) errores.push(`DEMO Paso 2: ${prof.apellido} ocupado a las ${p2.hora}`);
    const aulasOcupadas = new Set(ocupan(fecha, intervalo, () => true).map((o) => o.aula));
    const esperadas = new Set<string | null>(p2.aulasOcupadas);
    if (aulasOcupadas.size !== esperadas.size || [...aulasOcupadas].some((a) => !esperadas.has(a))) {
      errores.push(`DEMO Paso 2: aulas ocupadas a las ${p2.hora}: [${[...aulasOcupadas].join(", ")}]`);
    }
  }

  // Paso 4: turno futuro con el alumno en el plan de inscriptos (el seed base
  // no crea pagos, así que nunca tiene uno).
  {
    const t = turnoPorId.get(DEMO.paso4.turno);
    if (!t || !agendados.includes(t) || !t.alumnos.includes(DEMO.paso4.alumno) || fechas.get(t.id)! <= hoy) {
      errores.push("DEMO Paso 4: el turno debe ser futuro, agendado y con el alumno inscripto");
    }
  }

  // Paso 5: alumno con cuenta activa, turno DISPONIBLE con lugar dentro de la
  // anticipación, de una materia que no cursa y sin choque horario.
  {
    const { alumno, turno } = DEMO.paso5;
    const t = turnoPorId.get(turno);
    const fecha = fechas.get(turno);
    if (ALUMNOS[alumno]?.cuenta !== "activa" || !ALUMNOS[alumno].activo) errores.push("DEMO Paso 5: el alumno necesita cuenta activa");
    if (!t || !fecha || estadoDeTurno(t) !== "DISPONIBLE" || t.alumnos.length >= capacidadDeAula(t.aula)! || fecha <= hoy || fecha > fechaMaxima) {
      errores.push("DEMO Paso 5: el turno debe ser DISPONIBLE, con lugar y dentro de anticipacion_maxima_dias");
    } else {
      if (turnos.some((o) => o.materia === t.materia && o.alumnos.includes(alumno))) errores.push(`DEMO Paso 5: el alumno ya cursa ${t.materia}`);
      if (ocupan(fecha, intervaloDe(t), (o) => o.alumnos.includes(alumno)).length > 0) errores.push("DEMO Paso 5: el alumno tiene otro turno a esa hora");
    }
  }

  // Paso 6 (historial de Indicadores): ya no lo siembra el seed base; lo
  // agregan las HU de presentación como fixtures (PR-0.md §2.16).

  if (errores.length > 0) {
    throw new Error(`Datos del seed inválidos:\n - ${errores.join("\n - ")}`);
  }
}

// ------------------------------------------------------------
// Seed
// ------------------------------------------------------------

async function main() {
  const soloValidar = process.env.SEED_SOLO_VALIDAR === "1";
  const fechaForzada = process.env.SEED_FECHA_HOY;
  if (fechaForzada && !soloValidar) throw new Error("SEED_FECHA_HOY solo se admite junto con SEED_SOLO_VALIDAR=1");
  const hoy = fechaForzada ? new Date(`${fechaForzada}T00:00:00.000Z`) : fechaDeHoy(new Date());
  const turnosSeed = TURNOS;
  const fechasTurnos = calcularFechasTurnos(hoy, turnosSeed);
  validarDatos(hoy, turnosSeed, fechasTurnos);
  if (soloValidar) {
    console.log(`✓ Datos del seed válidos (${ALUMNOS.length} alumnos, ${turnosSeed.length} turnos, ${PERSONAL.length} fichas del personal). No se escribió en la base.`);
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
  // Cuentas internas (PERSONAL): gerente@ y mesa.entrada@ siguen siendo las
  // que figuran como autoras de los datos del seed.
  const usuarioPersonalIds = new Map<string, string>();
  for (const p of PERSONAL) usuarioPersonalIds.set(p.email, await upsertUsuario(p.email, p.rol));
  const gerenteId = usuarioPersonalIds.get("gerente@noctium.local")!;
  const mesaEntradaId = usuarioPersonalIds.get("mesa.entrada@noctium.local")!;

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
  const totalUsuarios = usuarioPersonalIds.size + usuarioProfesorIds.size + usuarioAlumnoIds.size;
  console.log(`✓ ${totalUsuarios} usuarios creados (1 inactivo)`);

  // 1b) Fichas del personal (PR-0.md §2.7): una por cuenta interna, con el
  // email de la cuenta. Solo se crean si faltan (por DNI): una segunda corrida
  // no pisa lo que cambien HU-F-03/F-05 ni HU-G-03/G-05.
  for (const p of PERSONAL) {
    const identidad = {
      usuarioId: usuarioPersonalIds.get(p.email)!,
      nacimiento: new Date(Date.UTC(p.nacimiento[0], p.nacimiento[1] - 1, p.nacimiento[2])),
      telefono: p.telefono === null ? null : ContactoSchema.parse({ telefono: p.telefono, email: p.email }).telefono ?? null,
    };
    if (p.rol === "MESA_ENTRADA") {
      await prisma.fichaMesaEntrada.upsert({
        where: { dniFichaMesaEntrada: p.dni },
        update: {},
        create: {
          usuarioId: identidad.usuarioId,
          nombreFichaMesaEntrada: p.nombre,
          apellidoFichaMesaEntrada: p.apellido,
          nombreNormalizadoFichaMesaEntrada: normalizarTexto(p.nombre),
          apellidoNormalizadoFichaMesaEntrada: normalizarTexto(p.apellido),
          dniFichaMesaEntrada: p.dni,
          fechaNacimientoFichaMesaEntrada: identidad.nacimiento,
          generoFichaMesaEntrada: p.genero,
          telefonoFichaMesaEntrada: identidad.telefono,
          emailFichaMesaEntrada: p.email,
          creadoPorUsuarioId: gerenteId,
        },
      });
    } else {
      await prisma.fichaGerente.upsert({
        where: { dniFichaGerente: p.dni },
        update: {},
        create: {
          usuarioId: identidad.usuarioId,
          nombreFichaGerente: p.nombre,
          apellidoFichaGerente: p.apellido,
          nombreNormalizadoFichaGerente: normalizarTexto(p.nombre),
          apellidoNormalizadoFichaGerente: normalizarTexto(p.apellido),
          dniFichaGerente: p.dni,
          fechaNacimientoFichaGerente: identidad.nacimiento,
          generoFichaGerente: p.genero,
          telefonoFichaGerente: identidad.telefono,
          emailFichaGerente: p.email,
          creadoPorUsuarioId: gerenteId,
        },
      });
    }
  }
  console.log(
    `✓ ${PERSONAL.filter((p) => p.rol === "MESA_ENTRADA").length} fichas de mesa de entrada y ${PERSONAL.filter((p) => p.rol === "GERENTE").length} de gerente creadas`,
  );

  // 2) Formas de pago (catálogo) --------------------------------
  // Por id estable del catálogo migrado. La rama de actualización está vacía:
  // conserva nombre, activaFormaPago y esEfectivo que haya cambiado HU-I-07.
  // Con la base recién migrada las cuatro ya existen; la creación solo cubre
  // una base donde falte alguna (sin duplicar por nombre).
  const formaPagoIds: string[] = [];
  for (const fp of FORMAS_PAGO) {
    const forma = await prisma.formaPago.upsert({
      where: { idFormaPago: fp.id },
      update: {},
      create: {
        idFormaPago: fp.id,
        nombreFormaPago: fp.nombre,
        nombreNormalizadaFormaPago: normalizarTexto(fp.nombre),
        activaFormaPago: true,
        esEfectivo: fp.esEfectivo,
        creadoPorUsuarioId: gerenteId,
      },
    });
    formaPagoIds.push(forma.idFormaPago);
  }
  console.log(`✓ ${formaPagoIds.length} formas de pago (${FORMAS_PAGO.filter((f) => f.esEfectivo).length} de efectivo)`);

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

  // Seis altas ficticias en meses distintos para la HU-H-02 original (alumnos
  // nuevos por mes). Desde spec_modulo_H.md Revisión 2 ese indicador ya no
  // existe; se conservan como fichas. No se reescribe la fecha de alta de una
  // ficha existente al resembrar.
  for (let mesAtras = 1; mesAtras <= 6; mesAtras++) {
    const creadoEn = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - mesAtras, 12, 12));
    const nombre = `Demo${mesAtras}`;
    const apellido = "Historico";
    await prisma.alumno.upsert({
      where: { dniAlumno: `9900000${mesAtras}` },
      update: {},
      create: {
        nombreAlumno: nombre, apellidoAlumno: apellido,
        nombreNormalizadoAlumno: normalizarTexto(nombre),
        apellidoNormalizadoAlumno: normalizarTexto(apellido),
        dniAlumno: `9900000${mesAtras}`,
        fechaNacimientoAlumno: new Date(Date.UTC(2000, mesAtras - 1, 12)),
        emailAlumno: `historico${mesAtras}@noctium.local`,
        formaPagoPreferidaId: formaPagoIds[0],
        creadoPorUsuarioId: mesaEntradaId,
        createdAtAlumno: creadoEn,
      },
    });
  }

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
        // Solo al crear (la rama update no la toca): HU-L-06/L-07 la cambian
        // con su historial. El seed no crea HistorialTarifa inicial (spec L 2.7).
        tarifaHoraMateria: m.tarifa,
      },
    });
    materiaIds.set(m.nombre, mat.idMateria);
  }
  console.log(
    `✓ ${materiaIds.size} materias creadas con tarifa (${MATERIAS.filter((m) => !m.codigo).length} sin código, ${MATERIAS.filter((m) => !m.activa).length} inactiva)`,
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

  // 8) Turnos (clases de prueba) --------------------------------
  // Seed base del Sprint 3 (PR-0.md §2.0 «Seed» y §2.16): solo las clases,
  // sin inscripciones, pagos, clases dictadas ni exámenes; esos datos los crea
  // el seed de escenarios llamando a los servicios de dominio. Cada clase se
  // crea solo si falta (ids fijos "seed-turno-XX"): no se borra ni se mueve
  // al resembrar, así conserva su fecha de la primera corrida y todo lo que le
  // hayan agregado después (las inscripciones y los pagos son hechos que no se
  // borran, Regla N.° 1). Para empezar de cero: `npx prisma migrate reset`.
  //
  // El trigger turno_sincronizar_reservas reserva profesor y aula al insertar
  // un turno DISPONIBLE; los alumnos se reservan al inscribirlos (solo las
  // inscripciones VIGENTE, desde 20261008120100_sprint3_modelo).
  let turnosCreados = 0;
  for (const t of turnosSeed) {
    const existente = await prisma.turno.findUnique({ where: { idTurno: t.id }, select: { idTurno: true } });
    if (existente) continue;
    await prisma.turno.create({
      data: {
        idTurno: t.id,
        fechaTurno: fechasTurnos.get(t.id)!,
        horaInicioTurno: horaTime(t.hora),
        duracionMinutosTurno: t.duracionMin,
        cupoMaximoTurno: capacidadDeAula(t.aula),
        estadoTurno: estadoSeedBase(t),
        prioridadTurno: t.prioridad ?? "NORMAL",
        materiaId: materiaIds.get(t.materia)!,
        profesorId: t.profesor !== null ? profesorIds[t.profesor] : null,
        aulaId: t.aula ? aulaIds.get(t.aula)! : null,
        creadoPorUsuarioId: mesaEntradaId,
      },
    });
    turnosCreados++;
  }
  const porEstado = (estado: EstadoTurno) => turnosSeed.filter((t) => estadoSeedBase(t) === estado).length;
  const pasados = turnosSeed.filter((t) => fechasTurnos.get(t.id)! < hoy).length;
  console.log(
    `✓ ${turnosSeed.length} turnos (${turnosCreados} creados en esta corrida; ${porEstado("DISPONIBLE")} DISPONIBLE, ${porEstado("PENDIENTE")} PENDIENTE, ${porEstado("CANCELADO")} CANCELADO; ${pasados} en el pasado), sin inscripciones`,
  );

  // 9) Parámetros del sistema ----------------------------------
  for (const [clave, valor] of Object.entries(PARAMETROS)) {
    await prisma.parametroSistema.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });
  }
  // Parámetros de HU-N-01 y datos del centro: solo si faltan (no se pisan).
  for (const [clave, valor] of Object.entries(PARAMETROS_CONFIGURABLES)) {
    await prisma.parametroSistema.upsert({
      where: { clave },
      update: {},
      create: { clave, valor },
    });
  }
  console.log(
    `✓ ${Object.keys(PARAMETROS).length} parámetros del sistema y ${Object.keys(PARAMETROS_CONFIGURABLES).length} parámetros configurables / datos del centro`,
  );

  // 10) RolPermiso (HU-A-02) ------------------------------------
  // Matriz RBAC completa (ver PERMISOS; la misma que dejan las migraciones).
  // Las acciones exclusivas de Mesa de Entrada que alguna migración insertó
  // también para otros roles (profesores:crear/editar, p. ej. GERENTE en
  // 20260923015526_profesor_contacto_modificado_por) y las filas revocadas
  // (PERMISOS_REVOCADOS) dejan filas viejas en bases existentes: se borran
  // acá, porque el upsert con update: {} no las tocaría.
  for (const accion of ACCIONES_SOLO_MESA_ENTRADA) {
    await prisma.rolPermiso.deleteMany({
      where: { rolPermiso: { not: "MESA_ENTRADA" }, accionPermiso: accion },
    });
  }
  for (const [rol, accion] of PERMISOS_REVOCADOS) {
    await prisma.rolPermiso.deleteMany({ where: { rolPermiso: rol, accionPermiso: accion } });
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
