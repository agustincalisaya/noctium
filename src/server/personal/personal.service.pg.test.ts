import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearUsuarioDePrueba, unico } from "@/server/testing/fabricas";
import {
  crearIntegrante,
  listarPersonal,
  modificarIntegrante,
  obtenerDetalleIntegrante,
  verificarDisponibilidadIntegrante,
} from "@/server/personal/personal.service";

// PostgreSQL real (`npm run test:pg -- src/server/personal`): alta y
// modificación del personal de mesa de entrada con su cuenta (spec_modulo_F.md
// §2.1, §2.2, §3.1 a §3.3, §3.6 y §3.8; HU-F-01 y HU-A-06 c1, c2 y c6).

describe.skipIf(!basePgHabilitada)("personal de mesa de entrada, con PostgreSQL real", () => {
  let db: PrismaClient;
  let gerente: string;
  const IP = "10.7.8.9";
  let secuencia = 0;
  /** DNI de 8 dígitos sin repetir en la corrida; empieza con 9 para no chocar con el seed. */
  const dni = () => `9${`${Date.now() % 10_000}${String(++secuencia % 1000).padStart(3, "0")}`.padStart(7, "0").slice(-7)}`;
  const email = (prefijo = "integrante") => `${unico(prefijo)}@prueba.local`;
  const alta = (doc = dni(), correo = email()) => ({
    nombre: "Lucía",
    apellido: "Fernández",
    dni: doc,
    fechaNacimiento: new Date(Date.UTC(1990, 3, 12)),
    email: correo,
  });
  const consola = vi.spyOn(console, "log");
  const consolaError = vi.spyOn(console, "error");

  beforeAll(async () => {
    db = clientePg();
    gerente = (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario;
  });
  afterEach(() => {
    consola.mockClear();
    consolaError.mockClear();
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const ficha = (id: string) => db.fichaMesaEntrada.findUniqueOrThrow({ where: { idFichaMesaEntrada: id } });
  const cuentaDe = async (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: (await ficha(id)).usuarioId! } });

  it("alta: ficha activa y cuenta MESA_ENTRADA juntas, con la marca, el hash del DNI y la auditoría", async () => {
    const doc = dni();
    const correo = email();
    const creado = await crearIntegrante({ ...alta(doc, correo), apellido: "Álvarez", telefono: "01145551234" }, gerente, IP);

    expect(creado).toMatchObject({
      dni: doc,
      email: correo,
      activo: true,
      cuenta: { estado: "ACTIVA", email: correo, rol: "MESA_ENTRADA", debe_cambiar_password: true },
    });
    expect(await ficha(creado.id)).toMatchObject({
      activoFichaMesaEntrada: true,
      version: 0,
      creadoPorUsuarioId: gerente,
      modificadoPorUsuarioId: null,
      apellidoNormalizadoFichaMesaEntrada: "alvarez",
      nombreNormalizadoFichaMesaEntrada: "lucia",
      emailFichaMesaEntrada: correo,
    });
    const cuenta = await cuentaDe(creado.id);
    expect(cuenta).toMatchObject({ emailUsuario: correo, rolUsuario: "MESA_ENTRADA", activoUsuario: true, debeCambiarPasswordUsuario: true });
    expect(cuenta.passwordHashUsuario).not.toContain(doc);
    expect(await bcrypt.compare(doc, cuenta.passwordHashUsuario)).toBe(true);
  });

  it("la contraseña inicial no aparece en ningún resultado, evento ni log", async () => {
    const doc = dni();
    const creado = await crearIntegrante(alta(doc), gerente, IP);
    const resto = { ...creado, dni: undefined };
    expect(JSON.stringify(resto)).not.toContain(doc);
    expect(JSON.stringify(resto)).not.toMatch(/"(password\w*|hash\w*)":/i);

    const detalle = { ...(await obtenerDetalleIntegrante(creado.id)), dni: undefined };
    expect(JSON.stringify(detalle)).not.toContain(doc);

    const eventos = await db.eventoSeguridad.findMany({ where: { usuarioId: (await ficha(creado.id)).usuarioId! } });
    expect(eventos).toEqual([expect.objectContaining({ tipoEvento: "CUENTA_CREADA", ipEvento: IP })]);
    expect(JSON.stringify(eventos)).not.toContain(doc);
    for (const llamada of [...consola.mock.calls, ...consolaError.mock.calls]) expect(JSON.stringify(llamada)).not.toContain(doc);
  });

  it("alta atómica: si la cuenta falla (email en uso), no queda la ficha", async () => {
    const correo = email("ocupado");
    await crearUsuarioDePrueba(db, { email: correo, rol: "ALUMNO" });
    const doc = dni();
    await expect(crearIntegrante(alta(doc, correo.toUpperCase()), gerente, IP)).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
      message: "Ese email ya está asociado a otra cuenta",
    });
    expect(await db.fichaMesaEntrada.count({ where: { dniFichaMesaEntrada: doc } })).toBe(0);
  });

  it("alta atómica: si la ficha falla (DNI ganado por otra alta), no queda su cuenta; una sola gana", async () => {
    const doc = dni();
    const correos = [email("dni"), email("dni")];
    const resultados = await Promise.allSettled(correos.map((correo) => crearIntegrante(alta(doc, correo), gerente, IP)));

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
      code: "DNI_DUPLICADO",
      message: "Ya existe un integrante de mesa de entrada con ese DNI",
    });
    expect(await db.fichaMesaEntrada.count({ where: { dniFichaMesaEntrada: doc } })).toBe(1);
    expect(await db.usuario.count({ where: { emailUsuario: { in: correos } } })).toBe(1);
  });

  it("dos altas simultáneas con el mismo email: una gana y la otra no deja ficha", async () => {
    const correo = email("simultaneo");
    const docs = [dni(), dni()];
    const resultados = await Promise.allSettled(docs.map((doc) => crearIntegrante(alta(doc, correo), gerente, IP)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    expect(await db.fichaMesaEntrada.count({ where: { dniFichaMesaEntrada: { in: docs } } })).toBe(1);
  });

  it("el DNI de una ficha inactiva sigue reservado", async () => {
    const doc = dni();
    const creado = await crearIntegrante(alta(doc), gerente, IP);
    await db.fichaMesaEntrada.update({ where: { idFichaMesaEntrada: creado.id }, data: { activoFichaMesaEntrada: false } });
    await expect(crearIntegrante(alta(doc), gerente, IP)).rejects.toMatchObject({ code: "DNI_DUPLICADO" });
  });

  it("modificación: solo lo que cambia, version + 1, modificadoPor y última modificación en el detalle", async () => {
    const creado = await crearIntegrante({ ...alta(), telefono: "01145551234" }, gerente, IP);
    expect((await obtenerDetalleIntegrante(creado.id)).modificadoEl).toBeNull();

    const r = await modificarIntegrante(creado.id, { nombre: "Ana María", telefono: null, version: 0 }, gerente);
    expect(r).toEqual({ id: creado.id, campos_modificados: ["nombre", "telefono"], version: 1 });
    expect(await ficha(creado.id)).toMatchObject({
      nombreFichaMesaEntrada: "Ana María",
      nombreNormalizadoFichaMesaEntrada: "ana maria",
      telefonoFichaMesaEntrada: null,
      version: 1,
      modificadoPorUsuarioId: gerente,
    });
    expect((await obtenerDetalleIntegrante(creado.id)).modificadoEl).toBeInstanceOf(Date);

    // Sin cambios: no escribe ni sube la versión.
    expect(await modificarIntegrante(creado.id, { nombre: "Ana María", version: 1 }, gerente)).toEqual({
      id: creado.id,
      campos_modificados: [],
      version: 1,
    });
    expect((await ficha(creado.id)).version).toBe(1);
  });

  it("modificación simultánea con la misma version: una gana y la otra CONFLICTO_EDICION_CONCURRENTE", async () => {
    const creado = await crearIntegrante(alta(), gerente, IP);
    const resultados = await Promise.allSettled([
      modificarIntegrante(creado.id, { nombre: "Primera", version: 0 }, gerente),
      modificarIntegrante(creado.id, { nombre: "Segunda", version: 0 }, gerente),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
      code: "CONFLICTO_EDICION_CONCURRENTE",
      status: 409,
    });
    expect((await ficha(creado.id)).version).toBe(1);
  });

  it("la unicidad excluye la propia ficha: su DNI y su email están disponibles para ella, no para otra", async () => {
    const propia = await crearIntegrante(alta(), gerente, IP);
    const otra = await crearIntegrante(alta(), gerente, IP);

    expect(await verificarDisponibilidadIntegrante({ dni: propia.dni, email: propia.email, excluirId: propia.id })).toEqual({
      dni_disponible: true,
      email_disponible: true,
    });
    expect(await verificarDisponibilidadIntegrante({ dni: propia.dni, email: propia.email.toUpperCase() })).toEqual({
      dni_disponible: false,
      email_disponible: false,
    });

    await expect(modificarIntegrante(otra.id, { dni: propia.dni, version: 0 }, gerente)).rejects.toMatchObject({ code: "DNI_DUPLICADO" });
    await expect(modificarIntegrante(otra.id, { email: propia.email, version: 0 }, gerente)).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
    });
    // Ni la ficha ni la cuenta cambiaron.
    expect(await ficha(otra.id)).toMatchObject({ dniFichaMesaEntrada: otra.dni, emailFichaMesaEntrada: otra.email, version: 0 });
    expect((await cuentaDe(otra.id)).emailUsuario).toBe(otra.email);
  });

  it("el cambio de email sincroniza la cuenta sin revocar sesiones; cambiar el DNI no toca la contraseña", async () => {
    const doc = dni();
    const creado = await crearIntegrante(alta(doc), gerente, IP);
    const antes = await cuentaDe(creado.id);

    const nuevoEmail = email("nuevo");
    const nuevoDni = dni();
    await modificarIntegrante(creado.id, { email: nuevoEmail, dni: nuevoDni, version: 0 }, gerente);

    expect((await ficha(creado.id)).emailFichaMesaEntrada).toBe(nuevoEmail);
    const despues = await cuentaDe(creado.id);
    expect(despues).toMatchObject({
      idUsuario: antes.idUsuario,
      emailUsuario: nuevoEmail,
      sesionesValidasDesdeUsuario: null,
      debeCambiarPasswordUsuario: true,
      passwordHashUsuario: antes.passwordHashUsuario,
    });
    expect(await bcrypt.compare(doc, despues.passwordHashUsuario)).toBe(true);
  });

  it("una ficha inactiva se puede modificar y no se reactiva", async () => {
    const creado = await crearIntegrante(alta(), gerente, IP);
    await db.fichaMesaEntrada.update({ where: { idFichaMesaEntrada: creado.id }, data: { activoFichaMesaEntrada: false } });
    const nuevoEmail = email("inactiva");
    await modificarIntegrante(creado.id, { email: nuevoEmail, telefono: "01145559999", version: 0 }, gerente);
    expect(await ficha(creado.id)).toMatchObject({ activoFichaMesaEntrada: false, emailFichaMesaEntrada: nuevoEmail, version: 1 });
    expect((await cuentaDe(creado.id)).emailUsuario).toBe(nuevoEmail);
  });

  it("listado: incluye activas e inactivas, ordenado por apellido, nombre y DNI", async () => {
    const sufijo = unico("orden").toLowerCase().replace(/[^a-z]/g, "");
    const a = await crearIntegrante({ ...alta(), apellido: `Zeta${sufijo}`, nombre: "Beto" }, gerente, IP);
    const b = await crearIntegrante({ ...alta(), apellido: `zeta${sufijo}`, nombre: "Ana" }, gerente, IP);
    await db.fichaMesaEntrada.update({ where: { idFichaMesaEntrada: a.id }, data: { activoFichaMesaEntrada: false } });

    const { items, total } = await listarPersonal(db);
    expect(total).toBe(items.length);
    const propios = items.filter((i) => i.id === a.id || i.id === b.id);
    expect(propios.map((i) => [i.nombre, i.activo])).toEqual([
      ["Ana", true],
      ["Beto", false],
    ]);
  });

  it("detalle inexistente: INTEGRANTE_NO_ENCONTRADO", async () => {
    await expect(obtenerDetalleIntegrante("no-existe", db)).rejects.toMatchObject({ code: "INTEGRANTE_NO_ENCONTRADO" });
    await expect(modificarIntegrante("no-existe", { version: 0 }, gerente)).rejects.toMatchObject({ code: "INTEGRANTE_NO_ENCONTRADO" });
    await expect(verificarDisponibilidadIntegrante({ dni: dni(), excluirId: "no-existe" }, db)).rejects.toMatchObject({
      code: "INTEGRANTE_NO_ENCONTRADO",
    });
  });
});
