import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearUsuarioDePrueba, unico } from "@/server/testing/fabricas";

// PostgreSQL real (`npm run test:pg -- src/server/gerentes`): alta y
// modificación de gerentes con su cuenta (spec_modulo_G.md §2.1, §2.2, §2.4,
// §3.1 a §3.3, §3.6 a §3.8; HU-G-01 y HU-A-06 c1, c2 y c6). DEC-44 se
// comprueba además con la ruta REAL (`withPermission` contra la base): solo se
// simulan la cookie y el wrapper `auth` de NextAuth, como en
// alumno.estado.permisos.pg.test.ts. Nunca se tocan los gerentes del seed.

const sesion = vi.hoisted(() => ({ actual: null as null | { id: string; rol: string; iat: number } }));
vi.mock("@/auth", () => {
  const actual = () => (sesion.actual ? { user: { id: sesion.actual.id, rol: sesion.actual.rol } } : null);
  return {
    auth: (manejador?: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
      typeof manejador === "function"
        ? (req: NextRequest, ctx: unknown) => manejador(Object.assign(req, { auth: actual() }), ctx)
        : Promise.resolve(actual()),
    // El `iat_sesion` de la sesión simulada es fijo: el de cuando «inició sesión».
    decodificarToken: async () => (sesion.actual ? { iat_sesion: sesion.actual.iat } : null),
    obtenerIp: () => "10.7.8.9",
  };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token-de-prueba" }) }) }));

const { crearGerente, listarGerentes, modificarGerente, obtenerDetalleGerente, verificarDisponibilidadGerente } =
  await import("@/server/gerentes/gerente.service");

type Manejador = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const rutaFicha = await import("@/app/api/gerentes/[id]/route");
const rutaColeccion = await import("@/app/api/gerentes/route");

describe.skipIf(!basePgHabilitada)("gerentes, con PostgreSQL real", () => {
  let db: PrismaClient;
  let gerente: string;
  const IP = "10.7.8.9";
  let secuencia = 0;
  /** DNI de 8 dígitos sin repetir en la corrida; empieza con 7 para no chocar con el seed ni con la fixture (8806400x). */
  const dni = () => `7${`${Date.now() % 10_000}${String(++secuencia % 1000).padStart(3, "0")}`.padStart(7, "0").slice(-7)}`;
  const email = (prefijo = "gerente") => `${unico(prefijo)}@prueba.local`;
  const alta = (doc = dni(), correo = email()) => ({
    nombre: "Marcos",
    apellido: "Ibarra",
    dni: doc,
    fechaNacimiento: new Date(Date.UTC(1985, 2, 20)),
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
    sesion.actual = null;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const ficha = (id: string) => db.fichaGerente.findUniqueOrThrow({ where: { idFichaGerente: id } });
  const cuentaDe = async (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: (await ficha(id)).usuarioId! } });

  it("alta: ficha activa y cuenta GERENTE juntas, con la marca, el hash del DNI y la auditoría", async () => {
    const doc = dni();
    const correo = email();
    const creado = await crearGerente({ ...alta(doc, correo), apellido: "Núñez", telefono: "01145551234" }, gerente, IP);

    expect(creado).toMatchObject({
      dni: doc,
      email: correo,
      activo: true,
      cuenta: { estado: "ACTIVA", email: correo, rol: "GERENTE", debe_cambiar_password: true },
    });
    expect(await ficha(creado.id)).toMatchObject({
      activoFichaGerente: true,
      version: 0,
      creadoPorUsuarioId: gerente,
      modificadoPorUsuarioId: null,
      apellidoNormalizadoFichaGerente: "nunez",
      nombreNormalizadoFichaGerente: "marcos",
      emailFichaGerente: correo,
    });
    const cuenta = await cuentaDe(creado.id);
    expect(cuenta).toMatchObject({ emailUsuario: correo, rolUsuario: "GERENTE", activoUsuario: true, debeCambiarPasswordUsuario: true });
    expect(cuenta.passwordHashUsuario).not.toContain(doc);
    expect(await bcrypt.compare(doc, cuenta.passwordHashUsuario)).toBe(true);
  });

  it("la contraseña inicial no aparece en ningún resultado, evento ni log", async () => {
    const doc = dni();
    const creado = await crearGerente(alta(doc), gerente, IP);
    const resto = { ...creado, dni: undefined };
    expect(JSON.stringify(resto)).not.toContain(doc);
    expect(JSON.stringify(resto)).not.toMatch(/"(password\w*|hash\w*)":/i);

    const detalle = { ...(await obtenerDetalleGerente(creado.id, gerente)), dni: undefined };
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
    await expect(crearGerente(alta(doc, correo.toUpperCase()), gerente, IP)).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
      message: "Ese email ya está asociado a otra cuenta",
    });
    expect(await db.fichaGerente.count({ where: { dniFichaGerente: doc } })).toBe(0);
  });

  it("alta atómica: si la ficha falla (DNI ganado por otra alta), no queda su cuenta; una sola gana", async () => {
    const doc = dni();
    const correos = [email("dni"), email("dni")];
    const resultados = await Promise.allSettled(correos.map((correo) => crearGerente(alta(doc, correo), gerente, IP)));

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
      code: "DNI_DUPLICADO",
      message: "Ya existe un gerente registrado con ese DNI",
    });
    expect(await db.fichaGerente.count({ where: { dniFichaGerente: doc } })).toBe(1);
    expect(await db.usuario.count({ where: { emailUsuario: { in: correos } } })).toBe(1);
  });

  it("dos altas simultáneas con el mismo email: una gana y la otra no deja ficha", async () => {
    const correo = email("simultaneo");
    const docs = [dni(), dni()];
    const resultados = await Promise.allSettled(docs.map((doc) => crearGerente(alta(doc, correo), gerente, IP)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    expect(await db.fichaGerente.count({ where: { dniFichaGerente: { in: docs } } })).toBe(1);
  });

  it("el DNI de una ficha inactiva sigue reservado; el de otra tabla no cuenta", async () => {
    const doc = dni();
    const creado = await crearGerente(alta(doc), gerente, IP);
    await db.fichaGerente.update({ where: { idFichaGerente: creado.id }, data: { activoFichaGerente: false } });
    await expect(crearGerente(alta(doc), gerente, IP)).rejects.toMatchObject({ code: "DNI_DUPLICADO" });

    // Regla 3.2: la unicidad se acota a FichaGerente (un alumno con el mismo DNI no la bloquea).
    const otroDni = dni();
    await db.alumno.create({
      data: {
        nombreAlumno: "Alumno", apellidoAlumno: "Prueba", nombreNormalizadoAlumno: "alumno", apellidoNormalizadoAlumno: "prueba",
        dniAlumno: otroDni, fechaNacimientoAlumno: new Date(Date.UTC(2000, 0, 1)),
      },
    });
    await expect(crearGerente(alta(otroDni), gerente, IP)).resolves.toMatchObject({ dni: otroDni });
  });

  it("modificación: solo lo que cambia, version + 1, modificadoPor y última modificación en el detalle", async () => {
    const creado = await crearGerente({ ...alta(), telefono: "01145551234" }, gerente, IP);
    expect((await obtenerDetalleGerente(creado.id, gerente)).modificadoEl).toBeNull();

    const r = await modificarGerente(creado.id, { nombre: "Ana María", telefono: null, version: 0 }, gerente);
    expect(r).toEqual({ id: creado.id, campos_modificados: ["nombre", "telefono"], version: 1 });
    expect(await ficha(creado.id)).toMatchObject({
      nombreFichaGerente: "Ana María",
      nombreNormalizadoFichaGerente: "ana maria",
      telefonoFichaGerente: null,
      version: 1,
      modificadoPorUsuarioId: gerente,
    });
    expect((await obtenerDetalleGerente(creado.id, gerente)).modificadoEl).toBeInstanceOf(Date);

    // Sin cambios: no escribe ni sube la versión.
    expect(await modificarGerente(creado.id, { nombre: "Ana María", version: 1 }, gerente)).toEqual({
      id: creado.id,
      campos_modificados: [],
      version: 1,
    });
    expect((await ficha(creado.id)).version).toBe(1);
  });

  it("modificación simultánea con la misma version: una gana y la otra CONFLICTO_EDICION_CONCURRENTE", async () => {
    const creado = await crearGerente(alta(), gerente, IP);
    const resultados = await Promise.allSettled([
      modificarGerente(creado.id, { nombre: "Primera", version: 0 }, gerente),
      modificarGerente(creado.id, { nombre: "Segunda", version: 0 }, gerente),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
      code: "CONFLICTO_EDICION_CONCURRENTE",
      status: 409,
    });
    expect((await ficha(creado.id)).version).toBe(1);
  });

  it("la unicidad excluye la propia ficha: su DNI y su email están disponibles para ella, no para otra", async () => {
    const propia = await crearGerente(alta(), gerente, IP);
    const otra = await crearGerente(alta(), gerente, IP);

    expect(await verificarDisponibilidadGerente({ dni: propia.dni, email: propia.email, excluirId: propia.id })).toEqual({
      dni_disponible: true,
      email_disponible: true,
    });
    expect(await verificarDisponibilidadGerente({ dni: propia.dni, email: propia.email.toUpperCase() })).toEqual({
      dni_disponible: false,
      email_disponible: false,
    });

    // Reenviar el propio email y DNI no es un cambio.
    expect(await modificarGerente(propia.id, { dni: propia.dni, email: propia.email, version: 0 }, gerente)).toMatchObject({
      campos_modificados: [],
    });
    await expect(modificarGerente(otra.id, { dni: propia.dni, version: 0 }, gerente)).rejects.toMatchObject({ code: "DNI_DUPLICADO" });
    await expect(modificarGerente(otra.id, { email: propia.email, version: 0 }, gerente)).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
    });
    // Ni la ficha ni la cuenta cambiaron.
    expect(await ficha(otra.id)).toMatchObject({ dniFichaGerente: otra.dni, emailFichaGerente: otra.email, version: 0 });
    expect((await cuentaDe(otra.id)).emailUsuario).toBe(otra.email);
  });

  it("el cambio de email sincroniza la cuenta sin revocar sesiones; cambiar el DNI no toca la contraseña", async () => {
    const doc = dni();
    const creado = await crearGerente(alta(doc), gerente, IP);
    const antes = await cuentaDe(creado.id);

    const nuevoEmail = email("nuevo");
    const nuevoDni = dni();
    await modificarGerente(creado.id, { email: nuevoEmail, dni: nuevoDni, version: 0 }, gerente);

    expect((await ficha(creado.id)).emailFichaGerente).toBe(nuevoEmail);
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
    const creado = await crearGerente(alta(), gerente, IP);
    await db.fichaGerente.update({ where: { idFichaGerente: creado.id }, data: { activoFichaGerente: false } });
    const nuevoEmail = email("inactiva");
    await modificarGerente(creado.id, { email: nuevoEmail, telefono: "01145559999", version: 0 }, gerente);
    expect(await ficha(creado.id)).toMatchObject({ activoFichaGerente: false, emailFichaGerente: nuevoEmail, version: 1 });
    expect((await cuentaDe(creado.id)).emailUsuario).toBe(nuevoEmail);
  });

  it("detalle: esVos solo para la ficha del gerente autenticado", async () => {
    const creado = await crearGerente(alta(), gerente, IP);
    const propio = (await ficha(creado.id)).usuarioId!;
    expect((await obtenerDetalleGerente(creado.id, propio, db)).esVos).toBe(true);
    expect((await obtenerDetalleGerente(creado.id, gerente, db)).esVos).toBe(false);
  });

  it("listado mínimo: activas e inactivas, ordenado por apellido, nombre y DNI, con total", async () => {
    const sufijo = unico("orden").toLowerCase().replace(/[^a-z]/g, "");
    const a = await crearGerente({ ...alta(), apellido: `Zeta${sufijo}`, nombre: "Beto" }, gerente, IP);
    const b = await crearGerente({ ...alta(), apellido: `zeta${sufijo}`, nombre: "Ana" }, gerente, IP);
    await db.fichaGerente.update({ where: { idFichaGerente: a.id }, data: { activoFichaGerente: false } });

    const { items, total } = await listarGerentes(db);
    expect(total).toBe(items.length);
    expect(total).toBe(await db.fichaGerente.count());
    const propios = items.filter((i) => i.id === a.id || i.id === b.id);
    expect(propios.map((i) => [i.nombre, i.activo])).toEqual([
      ["Ana", true],
      ["Beto", false],
    ]);
  });

  it("detalle inexistente: GERENTE_NO_ENCONTRADO", async () => {
    await expect(obtenerDetalleGerente("no-existe", gerente, db)).rejects.toMatchObject({ code: "GERENTE_NO_ENCONTRADO" });
    await expect(modificarGerente("no-existe", { version: 0 }, gerente)).rejects.toMatchObject({ code: "GERENTE_NO_ENCONTRADO" });
    await expect(verificarDisponibilidadGerente({ dni: dni(), excluirId: "no-existe" }, db)).rejects.toMatchObject({
      code: "GERENTE_NO_ENCONTRADO",
    });
  });

  describe("ruta real con withPermission", () => {
    async function llamar(
      manejador: Manejador,
      metodo: "GET" | "PATCH",
      id: string,
      cuerpo?: unknown,
    ): Promise<{ status: number; cuerpo: { data: unknown; error: { code: string } | null } }> {
      const respuesta = await manejador(
        new NextRequest(`http://localhost/api/gerentes/${id}`, {
          method: metodo,
          ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
        }),
        { params: Promise.resolve({ id }) },
      );
      return { status: respuesta.status, cuerpo: await respuesta.json() };
    }

    it("DEC-44: el gerente cambia su propio email y su misma sesión sigue válida", async () => {
      const creado = await crearGerente(alta(), gerente, IP);
      const usuarioId = (await ficha(creado.id)).usuarioId!;
      // Ya pasó por /primer-ingreso: sin la marca (el cambio de contraseña es de A).
      await db.usuario.update({ where: { idUsuario: usuarioId }, data: { debeCambiarPasswordUsuario: false } });
      // Sesión iniciada antes del cambio.
      sesion.actual = { id: usuarioId, rol: "GERENTE", iat: Math.floor(Date.now() / 1000) - 60 };

      const nuevoEmail = email("propio");
      const patch = await llamar(rutaFicha.PATCH as unknown as Manejador, "PATCH", creado.id, { email: nuevoEmail, version: 0 });
      expect(patch).toEqual({ status: 200, cuerpo: { data: { id: creado.id, campos_modificados: ["email"], version: 1 }, error: null } });

      const cuenta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId } });
      expect(cuenta).toMatchObject({ emailUsuario: nuevoEmail, sesionesValidasDesdeUsuario: null, activoUsuario: true });

      // La misma sesión sigue respondiendo 200, y la ficha se reconoce como propia.
      const detalle = await llamar(rutaFicha.GET as unknown as Manejador, "GET", creado.id);
      expect(detalle.status).toBe(200);
      expect(detalle.cuerpo.data).toMatchObject({ email: nuevoEmail, esVos: true, cuenta: { email: nuevoEmail } });
    });

    it("solo GERENTE: los otros roles reciben 403 SIN_PERMISO y nada cambia; sin sesión, 401", async () => {
      const creado = await crearGerente(alta(), gerente, IP);
      for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"] as const) {
        const usuario = await crearUsuarioDePrueba(db, { rol });
        sesion.actual = { id: usuario.idUsuario, rol, iat: Math.floor(Date.now() / 1000) };
        expect((await llamar(rutaFicha.GET as unknown as Manejador, "GET", creado.id)).cuerpo.error, rol).toMatchObject({ code: "SIN_PERMISO" });
        const patch = await llamar(rutaFicha.PATCH as unknown as Manejador, "PATCH", creado.id, { nombre: "Otro", version: 0 });
        expect(patch.status, rol).toBe(403);
        const listado = await (rutaColeccion.GET as unknown as Manejador)(new NextRequest("http://localhost/api/gerentes"), {
          params: Promise.resolve({ id: "" }),
        });
        expect(listado.status, rol).toBe(403);
      }
      sesion.actual = null;
      expect((await llamar(rutaFicha.GET as unknown as Manejador, "GET", creado.id)).status).toBe(401);
      expect(await ficha(creado.id)).toMatchObject({ nombreFichaGerente: "Marcos", version: 0 });
    });

    it("las migraciones dejan gerentes:* solo para GERENTE", async () => {
      const filas = await db.rolPermiso.findMany({
        where: { accionPermiso: { startsWith: "gerentes:" } },
        select: { rolPermiso: true, accionPermiso: true },
      });
      expect(filas.map((f) => `${f.accionPermiso} <- ${f.rolPermiso}`).sort()).toEqual([
        "gerentes:cambiar_estado <- GERENTE",
        "gerentes:crear <- GERENTE",
        "gerentes:editar <- GERENTE",
        "gerentes:leer <- GERENTE",
      ]);
    });
  });
});
