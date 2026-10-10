import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearUsuarioDePrueba, unico } from "@/server/testing/fabricas";
import { actualizarContactoProfesor, crearProfesor, modificarProfesor } from "@/server/profesores/profesor.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): alta del profesor con cuenta y
// email sincronizado (HU-A-06 con HU-D-01, D-02 y D-06; spec_modulo_D.md
// §2.9.1, §2.9.2, §3.12 y §3.13; spec_modulo_A.md §2.6.1, §3.11 y §3.12).

describe.skipIf(!basePgHabilitada)("profesor con cuenta de acceso, con PostgreSQL real", () => {
  let db: PrismaClient;
  let registrante: string;
  const IP = "10.7.8.9";
  let secuencia = 0;
  /**
   * DNI de 7 u 8 dígitos sin repetir dentro de la corrida. Empieza con 9 para
   * no chocar con los del seed: la base descartable es compartida.
   */
  const dni = (digitos = 8) => `9${`${Date.now() % 10 ** (digitos - 4)}${String(++secuencia % 1000).padStart(3, "0")}`.padStart(digitos - 1, "0").slice(-(digitos - 1))}`;
  const email = (prefijo = "profesor") => `${unico(prefijo)}@prueba.local`;
  const identidad = (doc = dni()) => ({ nombre: "Ana", apellido: "Gómez", dni: doc, fechaNacimiento: new Date(Date.UTC(1980, 4, 10)) });
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

  const ficha = (id: string) => db.profesor.findUniqueOrThrow({ where: { idProfesor: id } });
  const cuentaDe = async (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: (await ficha(id)).usuarioId! } });

  it("con email: ficha y cuenta juntas, rol PROFESOR, marca, hash del DNI y CUENTA_CREADA sin datos sensibles", async () => {
    const doc = dni(7);
    const correo = email();
    const creado = await crearProfesor({ ...identidad(doc), email: correo }, registrante, IP);

    expect(creado).toMatchObject({ email: correo, telefono: null, cuenta: { creada: true, debe_cambiar_password: true } });
    const cuenta = await cuentaDe(creado.id);
    expect(cuenta).toMatchObject({ emailUsuario: correo, rolUsuario: "PROFESOR", activoUsuario: true, debeCambiarPasswordUsuario: true });
    expect(cuenta.passwordHashUsuario).not.toContain(doc);
    expect(await bcrypt.compare(doc, cuenta.passwordHashUsuario)).toBe(true);

    const eventos = await db.eventoSeguridad.findMany({ where: { usuarioId: cuenta.idUsuario } });
    expect(eventos).toEqual([expect.objectContaining({ tipoEvento: "CUENTA_CREADA", emailEvento: correo, ipEvento: IP })]);
    expect(JSON.stringify(eventos)).not.toContain(doc);
    for (const llamada of [...consola.mock.calls, ...consolaError.mock.calls]) expect(JSON.stringify(llamada)).not.toContain(doc);
  });

  it("sin email: el alta de Sprint 1 y 2, ficha «Sin cuenta»", async () => {
    const creado = await crearProfesor(identidad(), registrante, IP);
    expect(creado.cuenta).toEqual({ creada: false });
    expect((await ficha(creado.id)).usuarioId).toBeNull();
  });

  it("email de otra cuenta: EMAIL_YA_ASOCIADO y no se crea la ficha", async () => {
    const correo = email();
    await crearProfesor({ ...identidad(), email: correo }, registrante, IP);
    const doc = dni();
    await expect(crearProfesor({ ...identidad(doc), email: correo.toUpperCase() }, registrante, IP)).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
      message: "Ese email ya está asociado a otra cuenta",
    });
    expect(await db.profesor.count({ where: { dniProfesor: doc } })).toBe(0);
  });

  it("dos altas simultáneas con el mismo email: una gana, la otra EMAIL_YA_ASOCIADO y su ficha no se crea", async () => {
    const correo = email("simultaneo");
    const docs = [dni(), dni()];
    const resultados = await Promise.allSettled(docs.map((doc) => crearProfesor({ ...identidad(doc), email: correo }, registrante, IP)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    expect(await db.profesor.count({ where: { dniProfesor: { in: docs } } })).toBe(1);
    expect(await db.usuario.count({ where: { emailUsuario: correo } })).toBe(1);
  });

  it("dos altas simultáneas con el mismo DNI: una gana, la otra DNI_DUPLICADO y sin cuenta huérfana", async () => {
    const doc = dni();
    const correos = [email("dni"), email("dni")];
    const resultados = await Promise.allSettled(correos.map((correo) => crearProfesor({ ...identidad(doc), email: correo }, registrante, IP)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "DNI_DUPLICADO" });
    expect(await db.usuario.count({ where: { emailUsuario: { in: correos } } })).toBe(1);
  });

  it("D-02 y D-06: el email nuevo cambia también la cuenta, sin revocar sesiones; mismo email no se revalida", async () => {
    const creado = await crearProfesor({ ...identidad(), email: email() }, registrante, IP);
    const nuevo = email("nuevo");
    await actualizarContactoProfesor(creado.id, { email: nuevo }, registrante);
    let cuenta = await cuentaDe(creado.id);
    expect(cuenta).toMatchObject({ emailUsuario: nuevo, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: true });

    const otro = email("otro");
    const { version } = await ficha(creado.id);
    await expect(modificarProfesor(creado.id, { email: otro, version }, registrante)).resolves.toMatchObject({ campos_modificados: ["email"] });
    cuenta = await cuentaDe(creado.id);
    expect(cuenta.emailUsuario).toBe(otro);
    expect((await ficha(creado.id)).emailProfesor).toBe(otro);

    await expect(actualizarContactoProfesor(creado.id, { email: otro, telefono: "0387154123456" }, registrante)).resolves.toMatchObject({
      email: otro,
      telefono: "0387154123456",
    });
  });

  it("email de otra cuenta en la edición: EMAIL_YA_ASOCIADO y ni la ficha ni la cuenta cambian", async () => {
    const ocupado = email("ocupado");
    await crearProfesor({ ...identidad(), email: ocupado }, registrante, IP);
    const correo = email();
    const creado = await crearProfesor({ ...identidad(), email: correo }, registrante, IP);
    const { version } = await ficha(creado.id);
    await expect(modificarProfesor(creado.id, { email: ocupado, version }, registrante)).rejects.toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    expect((await ficha(creado.id)).emailProfesor).toBe(correo);
    expect((await cuentaDe(creado.id)).emailUsuario).toBe(correo);
  });

  it("una ficha con cuenta no puede quedarse sin email (CONTACTO_REQUERIDO en el campo email)", async () => {
    const correo = email();
    const creado = await crearProfesor({ ...identidad(), email: correo, telefono: "0387154123456" }, registrante, IP);
    const { version } = await ficha(creado.id);
    await expect(modificarProfesor(creado.id, { email: null, version }, registrante)).rejects.toMatchObject({
      code: "CONTACTO_REQUERIDO",
      detalles: { campo: "email" },
    });
    expect((await ficha(creado.id)).emailProfesor).toBe(correo);
  });

  it("ficha inactiva con cuenta: el email cambia en las dos", async () => {
    const creado = await crearProfesor({ ...identidad(), email: email() }, registrante, IP);
    await db.profesor.update({ where: { idProfesor: creado.id }, data: { activoProfesor: false } });
    const nuevo = email("inactiva");
    await actualizarContactoProfesor(creado.id, { email: nuevo }, registrante);
    expect((await cuentaDe(creado.id)).emailUsuario).toBe(nuevo);
  });

  it("ficha anterior sin cuenta: cargarle un email no crea la cuenta (criterio 8)", async () => {
    const creado = await crearProfesor(identidad(), registrante, IP);
    const correo = email("sincuenta");
    await actualizarContactoProfesor(creado.id, { email: correo }, registrante);
    expect((await ficha(creado.id)).usuarioId).toBeNull();
    expect(await db.usuario.count({ where: { emailUsuario: correo } })).toBe(0);
  });
});
