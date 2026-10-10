import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearUsuarioDePrueba, unico } from "@/server/testing/fabricas";
import { actualizarContactoAlumno, crearAlumno, modificarAlumno } from "@/server/alumnos/alumno.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): alta del alumno con cuenta y
// email sincronizado (HU-A-06 con HU-B-01, B-02 y B-06; spec_modulo_B.md
// §2.9, §2.2, §2.5 y §3.11; spec_modulo_A.md §2.6.1, §3.11 y §3.12).

describe.skipIf(!basePgHabilitada)("alumno con cuenta de acceso, con PostgreSQL real", () => {
  let db: PrismaClient;
  let registrante: string;
  const IP = "10.4.5.6";
  let secuencia = 0;
  /**
   * DNI de 7 u 8 dígitos sin repetir dentro de la corrida. Empieza con 9 para
   * ordenarse después de los del seed (4010…): la base descartable es
   * compartida y los fixtures de E-04 y E-09 eligen «el primer alumno activo
   * por DNI».
   */
  const dni = (digitos = 8) => `9${`${Date.now() % 10 ** (digitos - 4)}${String(++secuencia % 1000).padStart(3, "0")}`.padStart(digitos - 1, "0").slice(-(digitos - 1))}`;
  const email = (prefijo = "alumno") => `${unico(prefijo)}@prueba.local`;
  const identidad = (doc = dni()) => ({ nombre: "Ana", apellido: "Gómez", dni: doc, fecha_nacimiento: new Date("2005-05-10T00:00:00.000Z") });
  const SIN_CAMBIOS = { nombre: false, apellido: false, dni: false, fecha_nacimiento: false, genero: false, telefono: false, email: false, forma_pago_id: false };
  const consola = vi.spyOn(console, "log");
  const consolaError = vi.spyOn(console, "error");

  beforeAll(async () => {
    db = clientePg();
    registrante = (await crearUsuarioDePrueba(db)).idUsuario;
  });
  afterEach(() => {
    consola.mockClear();
    consolaError.mockClear();
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("con email: ficha y cuenta juntas, rol ALUMNO, marca, hash del DNI y CUENTA_CREADA sin datos sensibles", async () => {
    const doc = dni(7);
    const correo = email();
    const alumno = await crearAlumno({ ...identidad(doc), email: correo, telefono: "0387154123456" }, registrante, IP);

    expect(alumno.cuenta).toEqual({ creada: true, debe_cambiar_password: true });
    const ficha = await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } });
    expect(ficha).toMatchObject({ emailAlumno: correo, telefonoAlumno: "0387154123456", activoAlumno: true });
    const cuenta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: ficha.usuarioId! } });
    expect(cuenta).toMatchObject({ emailUsuario: correo, rolUsuario: "ALUMNO", activoUsuario: true, debeCambiarPasswordUsuario: true });
    expect(cuenta.passwordHashUsuario).not.toContain(doc);
    expect(await bcrypt.compare(doc, cuenta.passwordHashUsuario)).toBe(true);

    const eventos = await db.eventoSeguridad.findMany({ where: { usuarioId: cuenta.idUsuario } });
    expect(eventos).toEqual([expect.objectContaining({ tipoEvento: "CUENTA_CREADA", emailEvento: correo, ipEvento: IP })]);
    expect(JSON.stringify(eventos)).not.toContain(doc);
    for (const llamada of [...consola.mock.calls, ...consolaError.mock.calls]) expect(JSON.stringify(llamada)).not.toContain(doc);
  });

  it("sin email: el alta de Sprint 1, ficha «Sin cuenta»", async () => {
    const alumno = await crearAlumno(identidad(), registrante, IP);
    expect(alumno.cuenta).toEqual({ creada: false });
    expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } })).usuarioId).toBeNull();
  });

  it("email de otra cuenta: EMAIL_YA_ASOCIADO y no se crea la ficha", async () => {
    const correo = email();
    await crearAlumno({ ...identidad(), email: correo }, registrante, IP);
    const doc = dni();
    await expect(crearAlumno({ ...identidad(doc), email: correo.toUpperCase() }, registrante, IP)).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
      message: "Ese email ya está asociado a otra cuenta",
    });
    expect(await db.alumno.count({ where: { dniAlumno: doc } })).toBe(0);
  });

  it("dos altas simultáneas con el mismo email: una gana, la otra EMAIL_YA_ASOCIADO y su ficha no se crea", async () => {
    const correo = email("simultaneo");
    const docs = [dni(), dni()];
    const resultados = await Promise.allSettled(docs.map((doc) => crearAlumno({ ...identidad(doc), email: correo }, registrante, IP)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    expect(await db.alumno.count({ where: { dniAlumno: { in: docs } } })).toBe(1);
    expect(await db.usuario.count({ where: { emailUsuario: correo } })).toBe(1);
  });

  it("dos altas simultáneas con el mismo DNI: una gana, la otra DNI_DUPLICADO y sin cuenta huérfana", async () => {
    const doc = dni();
    const correos = [email("dni"), email("dni")];
    const resultados = await Promise.allSettled(correos.map((correo) => crearAlumno({ ...identidad(doc), email: correo }, registrante, IP)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "DNI_DUPLICADO" });
    expect(await db.usuario.count({ where: { emailUsuario: { in: correos } } })).toBe(1);
  });

  it("B-02 y B-06: el email nuevo cambia también la cuenta, sin revocar sesiones; mismo email no se revalida", async () => {
    const alumno = await crearAlumno({ ...identidad(), email: email() }, registrante, IP);
    const nuevo = email("nuevo");
    await actualizarContactoAlumno(alumno.idAlumno, { email: nuevo }, { telefono: true, email: true }, registrante);
    const cuenta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: alumno.usuarioId! } });
    expect(cuenta.emailUsuario).toBe(nuevo);
    expect(cuenta.sesionesValidasDesdeUsuario).toBeNull();
    expect(cuenta.debeCambiarPasswordUsuario).toBe(true);

    const { version } = await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } });
    const otro = email("otro");
    await expect(modificarAlumno(alumno.idAlumno, { email: otro, version }, { ...SIN_CAMBIOS, email: true }, registrante)).resolves.toMatchObject({
      campos_modificados: ["email"],
    });
    expect((await db.usuario.findUniqueOrThrow({ where: { idUsuario: alumno.usuarioId! } })).emailUsuario).toBe(otro);
    expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } })).emailAlumno).toBe(otro);

    await expect(
      actualizarContactoAlumno(alumno.idAlumno, { email: otro, telefono: "0387154123456" }, { telefono: true, email: true }, registrante),
    ).resolves.toMatchObject({ email: otro, telefono: "0387154123456" });
  });

  it("email de otra cuenta en la edición: EMAIL_YA_ASOCIADO y ni la ficha ni la cuenta cambian", async () => {
    const ocupado = email("ocupado");
    await crearAlumno({ ...identidad(), email: ocupado }, registrante, IP);
    const correo = email();
    const alumno = await crearAlumno({ ...identidad(), email: correo }, registrante, IP);
    await expect(
      actualizarContactoAlumno(alumno.idAlumno, { email: ocupado }, { telefono: true, email: true }, registrante),
    ).rejects.toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } })).emailAlumno).toBe(correo);
    expect((await db.usuario.findUniqueOrThrow({ where: { idUsuario: alumno.usuarioId! } })).emailUsuario).toBe(correo);
  });

  it("una ficha con cuenta no puede quedarse sin email (EMAIL_REQUERIDO)", async () => {
    const correo = email();
    const alumno = await crearAlumno({ ...identidad(), email: correo, telefono: "0387154123456" }, registrante, IP);
    await expect(
      actualizarContactoAlumno(alumno.idAlumno, { telefono: "0387154123456" }, { telefono: true, email: true }, registrante),
    ).rejects.toMatchObject({ code: "EMAIL_REQUERIDO", status: 400 });
    expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } })).emailAlumno).toBe(correo);
  });

  it("ficha inactiva con cuenta: el email cambia en las dos", async () => {
    const alumno = await crearAlumno({ ...identidad(), email: email() }, registrante, IP);
    await db.alumno.update({ where: { idAlumno: alumno.idAlumno }, data: { activoAlumno: false } });
    await db.usuario.update({ where: { idUsuario: alumno.usuarioId! }, data: { activoUsuario: false } });
    const nuevo = email("inactiva");
    await actualizarContactoAlumno(alumno.idAlumno, { email: nuevo }, { telefono: true, email: true }, registrante);
    expect((await db.usuario.findUniqueOrThrow({ where: { idUsuario: alumno.usuarioId! } })).emailUsuario).toBe(nuevo);
  });

  it("ficha anterior sin cuenta: cargarle un email no crea la cuenta (criterio 8)", async () => {
    const alumno = await crearAlumno(identidad(), registrante, IP);
    const correo = email("sincuenta");
    await actualizarContactoAlumno(alumno.idAlumno, { email: correo }, { telefono: true, email: true }, registrante);
    expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumno.idAlumno } })).usuarioId).toBeNull();
    expect(await db.usuario.count({ where: { emailUsuario: correo } })).toBe(0);
  });
});
