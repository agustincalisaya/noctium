import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearFichaGerenteDePrueba, crearUsuarioDePrueba, unico } from "@/server/testing/fabricas";
import { actorUsuario } from "@/server/shared/historial";
import { listarHistorialEstados } from "@/server/shared/historial-estados";
import * as bloqueos from "@/server/shared/bloquear";
import * as transacciones from "@/server/shared/transaccion";
import * as cuentas from "@/server/usuarios/cuenta.service";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import {
  crearGerente,
  desactivarGerente,
  listarGerentes,
  obtenerDetalleGerente,
  reactivarGerente,
} from "@/server/gerentes/gerente.service";

// PostgreSQL real (`npm run test:pg -- src/server/gerentes`): baja y
// reactivación de gerentes con su cuenta (spec_modulo_G.md §2.4 a §2.6, §3.1,
// §3.4 a §3.6; HU-G-05 y HU-A-06 c7), incluida la regla «al menos un gerente
// activo» con concurrencia determinista (técnica de pausa por `bloquear` de
// profesor.estado.pg.test.ts y personal.estado.pg.test.ts).
//
// Aislamiento: la regla cuenta TODAS las fichas de gerente activas con cuenta
// activa de la base, y otros *.pg.test.ts dejan fichas de gerente activas en
// la misma base descartable. Por eso, con escrituras directas y solo en la
// base descartable: `beforeAll` guarda las fichas activas preexistentes y sus
// cuentas activas, `beforeEach` deja inactivas todas las fichas de gerente
// activas (y sus cuentas) para que cada prueba arranque sin gerentes activos,
// y `afterAll` restaura las preexistentes. Si la base tiene un gerente del
// seed base (DNI 24100001 o 24100002), la prueba se corta sin tocar nada.

const DNI_DEL_SEED = ["24100001", "24100002"];

describe.skipIf(!basePgHabilitada)("HU-G-05 baja y reactivación de gerentes, con PostgreSQL real", () => {
  let db: PrismaClient;
  /** Cuenta GERENTE sin ficha: registra las altas y actúa cuando el actor no importa. */
  let registrante: string;
  let preexistentes: { fichas: string[]; cuentas: string[] } = { fichas: [], cuentas: [] };
  let secuencia = 0;
  /** DNI de 8 dígitos sin repetir en la corrida; empieza con 6 para no chocar con el seed, G-01 (7…) ni las fixtures. */
  const dni = () => `6${`${Date.now() % 10_000}${String(++secuencia % 1000).padStart(3, "0")}`.padStart(7, "0").slice(-7)}`;
  /** Apellido solo con letras, único en la corrida (la búsqueda del listado lo encuentra). */
  const apellidoUnico = () => `Baja ${unico("").replace(/[^a-z]/g, "")}`;

  /** Deja inactivas todas las fichas de gerente activas y sus cuentas (escritura directa, base descartable). */
  async function inactivarGerentesActivos() {
    const activas = await db.fichaGerente.findMany({
      where: { activoFichaGerente: true },
      select: { idFichaGerente: true, usuarioId: true },
    });
    const cuentasActivas = activas.flatMap((f) => (f.usuarioId ? [f.usuarioId] : []));
    await db.fichaGerente.updateMany({ where: { idFichaGerente: { in: activas.map((f) => f.idFichaGerente) } }, data: { activoFichaGerente: false } });
    await db.usuario.updateMany({ where: { idUsuario: { in: cuentasActivas } }, data: { activoUsuario: false } });
  }

  beforeAll(async () => {
    db = clientePg();
    const delSeed = await db.fichaGerente.count({ where: { dniFichaGerente: { in: DNI_DEL_SEED } } });
    if (delSeed > 0) throw new Error("La base tiene gerentes del seed base: esta prueba solo corre en la base descartable sin seed.");

    const activas = await db.fichaGerente.findMany({
      where: { activoFichaGerente: true },
      select: { idFichaGerente: true, usuarioId: true },
    });
    const conCuenta = activas.flatMap((f) => (f.usuarioId ? [f.usuarioId] : []));
    const cuentasActivas = await db.usuario.findMany({
      where: { idUsuario: { in: conCuenta }, activoUsuario: true },
      select: { idUsuario: true },
    });
    preexistentes = { fichas: activas.map((f) => f.idFichaGerente), cuentas: cuentasActivas.map((u) => u.idUsuario) };
    registrante = (await crearUsuarioDePrueba(db, { rol: "GERENTE" })).idUsuario;
  });
  beforeEach(async () => {
    await inactivarGerentesActivos();
  });
  afterAll(async () => {
    if (db) {
      // Las fichas de esta prueba quedan inactivas; las preexistentes vuelven como estaban.
      await inactivarGerentesActivos();
      await db.fichaGerente.updateMany({ where: { idFichaGerente: { in: preexistentes.fichas } }, data: { activoFichaGerente: true } });
      await db.usuario.updateMany({ where: { idUsuario: { in: preexistentes.cuentas } }, data: { activoUsuario: true } });
    }
    await db?.$disconnect();
  });

  /** Gerente con cuenta, dado de alta con el servicio (la cuenta nace con la marca de cambio obligatorio). */
  async function gerente(apellido = apellidoUnico()) {
    const creado = await crearGerente(
      { nombre: "Andrés", apellido, dni: dni(), fechaNacimiento: new Date(Date.UTC(1975, 1, 20)), email: `${unico("g05")}@prueba.local` },
      registrante,
    );
    const { usuarioId } = await ficha(creado.id);
    return { id: creado.id, usuarioId: usuarioId!, apellido, actor: actorUsuario(usuarioId!) };
  }
  /** Ficha activa sin cuenta (inserción directa, como la fixture de G-03). */
  async function gerenteSinCuenta() {
    const id = unico("fg");
    await db.fichaGerente.create({
      data: {
        idFichaGerente: id, usuarioId: null, activoFichaGerente: true,
        nombreFichaGerente: "Sin", apellidoFichaGerente: "Cuenta",
        nombreNormalizadoFichaGerente: "sin", apellidoNormalizadoFichaGerente: "cuenta",
        dniFichaGerente: dni(), fechaNacimientoFichaGerente: new Date(Date.UTC(1980, 0, 1)),
        emailFichaGerente: `${unico("sincuenta")}@prueba.local`,
      },
    });
    return id;
  }
  const ficha = (id: string) => db.fichaGerente.findUniqueOrThrow({ where: { idFichaGerente: id } });
  const cuentaDe = async (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: (await ficha(id)).usuarioId! } });
  const historial = (id: string) => listarHistorialEstados("FICHA_GERENTE", id);
  /** Fichas activas con cuenta activa en toda la base. */
  async function gerentesActivosConCuenta() {
    const activas = await db.fichaGerente.findMany({ where: { activoFichaGerente: true, usuarioId: { not: null } }, select: { usuarioId: true } });
    return cuentas.filtrarCuentasActivas(db, activas.map((f) => f.usuarioId!));
  }

  /** Espera a que otra transacción quede esperando un bloqueo de fila. */
  async function esperarTransaccionBloqueada() {
    for (let intento = 0; intento < 100; intento++) {
      const [{ esperando }] = await db.$queryRaw<{ esperando: number }[]>`
        SELECT count(*)::int AS esperando FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (esperando > 0) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("ninguna transacción quedó esperando el bloqueo");
  }
  /** La primera llamada a `bloquear` se detiene con el bloqueo ya tomado hasta `soltar()`. */
  function pausarDespuesDelPrimerBloqueo() {
    let soltar!: () => void, tomado!: () => void;
    const listo = new Promise<void>((r) => { tomado = r; });
    const espera = new Promise<void>((r) => { soltar = r; });
    const original = bloqueos.bloquear;
    let primera = true;
    const espia = vi.spyOn(bloqueos, "bloquear").mockImplementation(async (tx, input) => {
      const resultado = await original(tx, input);
      if (primera) { primera = false; tomado(); await espera; }
      return resultado;
    });
    return { listo, soltar: () => soltar(), restaurar: () => espia.mockRestore() };
  }
  /**
   * La primera llamada a `bloquear` se detiene ANTES de pedir el bloqueo (con
   * los ids ya leídos) hasta `soltar()`; `pedidos` guarda los ids que pidió.
   */
  function pausarAntesDelPrimerBloqueo() {
    let soltar!: () => void, llego!: () => void;
    const listo = new Promise<void>((r) => { llego = r; });
    const espera = new Promise<void>((r) => { soltar = r; });
    const original = bloqueos.bloquear;
    let primera = true;
    const pedidos: (readonly string[])[] = [];
    const espia = vi.spyOn(bloqueos, "bloquear").mockImplementation(async (tx, input) => {
      if (primera) { primera = false; pedidos.push(input.recursos?.fichasGerente ?? []); llego(); await espera; }
      return original(tx, input);
    });
    return { listo, pedidos, soltar: () => soltar(), restaurar: () => espia.mockRestore() };
  }

  it("baja con cuenta: ficha y cuenta inactivas, versión, modificador, sesiones revocadas, marca intacta e historial después del commit", async () => {
    const objetivo = await gerente();
    const actor = await gerente();
    expect((await cuentaDe(objetivo.id)).debeCambiarPasswordUsuario).toBe(true);
    expect(await obtenerDetalleGerente(objetivo.id, actor.usuarioId)).toMatchObject({
      historialEstados: [], motivoObligatorioAlDesactivar: false, esUltimoGerenteActivo: false, esVos: false,
    });

    // Cuando corre la cola de después del commit, la baja ya es visible desde otra conexión.
    const vistoAlEscribirHistorial: boolean[] = [];
    const original = transacciones.despuesDelCommit;
    const espia = vi.spyOn(transacciones, "despuesDelCommit").mockImplementation((tx, tarea) => original(tx, async () => {
      vistoAlEscribirHistorial.push(!(await ficha(objetivo.id)).activoFichaGerente);
      return tarea();
    }));
    try {
      expect(await desactivarGerente(objetivo.id, { version: 0, motivo: "  Dejó el centro " }, actor.actor)).toEqual({
        id: objetivo.id, activo: false, version: 1,
      });
    } finally {
      espia.mockRestore();
    }
    expect(vistoAlEscribirHistorial).toEqual([true]);

    expect(await ficha(objetivo.id)).toMatchObject({ activoFichaGerente: false, version: 1, modificadoPorUsuarioId: actor.usuarioId });
    const cuenta = await cuentaDe(objetivo.id);
    expect(cuenta.activoUsuario).toBe(false);
    expect(cuenta.sesionesValidasDesdeUsuario).not.toBeNull();
    expect(cuenta.debeCambiarPasswordUsuario).toBe(true);
    expect(await historial(objetivo.id)).toEqual([
      expect.objectContaining({ accion: "DESACTIVAR", motivo: "Dejó el centro", actor_tipo: "USUARIO", usuario_id: actor.usuarioId }),
    ]);
    expect(await obtenerDetalleGerente(objetivo.id, actor.usuarioId)).toMatchObject({
      activo: false,
      cuenta: { estado: "INACTIVA" },
      motivoObligatorioAlDesactivar: false,
      esUltimoGerenteActivo: false,
      historialEstados: [
        expect.objectContaining({ accion: "DESACTIVAR", motivo: "Dejó el centro", usuarioId: actor.usuarioId, usuarioNombre: `${actor.apellido}, Andrés` }),
      ],
    });
  });

  it("rollback: si falla la cuenta, la ficha sigue activa, la cuenta intacta y no queda historial", async () => {
    const objetivo = await gerente();
    const actor = await gerente();
    const original = cuentas.desactivarCuenta;
    const fallo = vi.spyOn(cuentas, "desactivarCuenta").mockImplementationOnce(async (tx, usuarioId) => {
      await original(tx, usuarioId);
      throw new Error("fallo inyectado después de la cuenta");
    });
    try {
      await expect(desactivarGerente(objetivo.id, { version: 0 }, actor.actor)).rejects.toThrow("fallo inyectado");
    } finally {
      fallo.mockRestore();
    }
    expect(await ficha(objetivo.id)).toMatchObject({ activoFichaGerente: true, version: 0, modificadoPorUsuarioId: null });
    expect(await cuentaDe(objetivo.id)).toMatchObject({ activoUsuario: true, sesionesValidasDesdeUsuario: null });
    expect(await historial(objetivo.id)).toHaveLength(0);
  });

  it("reactivar: ficha y cuenta activas, umbral de sesiones y marca conservados; varias bajas y reactivaciones se conservan", async () => {
    const objetivo = await gerente();
    const actor = await gerente();
    await desactivarGerente(objetivo.id, { version: 0 }, actor.actor);
    const baja = await cuentaDe(objetivo.id);
    await expect(reactivarGerente(objetivo.id, { version: 0 }, actor.actor)).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
    expect(await reactivarGerente(objetivo.id, { version: 1 }, actor.actor)).toEqual({ id: objetivo.id, activo: true, version: 2 });
    expect(await ficha(objetivo.id)).toMatchObject({ activoFichaGerente: true, version: 2, modificadoPorUsuarioId: actor.usuarioId });
    const alta = await cuentaDe(objetivo.id);
    expect(alta.activoUsuario).toBe(true);
    expect(alta.debeCambiarPasswordUsuario).toBe(true);
    expect(alta.sesionesValidasDesdeUsuario).toEqual(baja.sesionesValidasDesdeUsuario);
    await expect(reactivarGerente(objetivo.id, { version: 2 }, actor.actor)).rejects.toMatchObject({ code: "GERENTE_YA_ACTIVO", status: 409 });

    await desactivarGerente(objetivo.id, { version: 2, motivo: "Licencia" }, actor.actor);
    await expect(desactivarGerente(objetivo.id, { version: 3 }, actor.actor)).rejects.toMatchObject({ code: "GERENTE_YA_INACTIVO", status: 409 });
    await reactivarGerente(objetivo.id, { version: 3 }, actor.actor);
    const filas = await historial(objetivo.id);
    expect(filas.map((h) => h.accion)).toEqual(["REACTIVAR", "DESACTIVAR", "REACTIVAR", "DESACTIVAR"]);
    expect(filas.find((h) => h.motivo === "Licencia")?.accion).toBe("DESACTIVAR");
    expect(filas.filter((h) => h.accion === "REACTIVAR").every((h) => h.motivo === null)).toBe(true);
    expect((await obtenerDetalleGerente(objetivo.id, actor.usuarioId)).historialEstados.map((h) => h.accion)).toEqual(filas.map((h) => h.accion));
  });

  it("autodesactivación: 422 sin cambiar nada (ni ficha, ni cuenta, ni historial) y sin bloquear, incluso con una versión vieja", async () => {
    const propio = await gerente();
    await gerente();
    const antes = { ficha: await ficha(propio.id), cuenta: await cuentaDe(propio.id) };
    const espia = vi.spyOn(bloqueos, "bloquear");
    try {
      for (const version of [0, 7]) {
        await expect(desactivarGerente(propio.id, { version, motivo: "Me voy" }, propio.actor)).rejects.toMatchObject({
          code: "NO_PUEDE_DESACTIVARSE_A_SI_MISMO", status: 422, message: "No podés desactivarte a vos mismo.",
        });
      }
      expect(espia).not.toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
    expect(await ficha(propio.id)).toEqual(antes.ficha);
    expect(await cuentaDe(propio.id)).toEqual(antes.cuenta);
    expect(await historial(propio.id)).toHaveLength(0);
    expect((await obtenerDetalleGerente(propio.id, propio.usuarioId)).esVos).toBe(true);
  });

  it("dos bajas cruzadas (A desactiva a B y B desactiva a A, únicos activos): exactamente una confirma y la otra responde ULTIMO_GERENTE_ACTIVO", async () => {
    const a = await gerente();
    const b = await gerente();
    expect(await gerentesActivosConCuenta()).toHaveLength(2);

    const pausa = pausarDespuesDelPrimerBloqueo();
    // A desactiva a B y se detiene con los bloqueos tomados.
    const primera = desactivarGerente(b.id, { version: 0 }, a.actor);
    let resultados: PromiseSettledResult<unknown>[] = [];
    try {
      await pausa.listo;
      // B desactiva a A: leyó a los dos como activos y queda esperando el bloqueo.
      const segunda = Promise.allSettled([desactivarGerente(a.id, { version: 0 }, b.actor)]);
      await esperarTransaccionBloqueada();
      pausa.soltar();
      resultados = [...(await Promise.allSettled([primera])), ...(await segunda)];
    } finally {
      pausa.soltar();
      pausa.restaurar();
    }
    expect(resultados[0]).toMatchObject({ status: "fulfilled", value: { id: b.id, activo: false } });
    expect(resultados[1]).toMatchObject({
      status: "rejected", reason: { code: "ULTIMO_GERENTE_ACTIVO", status: 409, message: "Debe quedar al menos un gerente activo" },
    });
    expect(await gerentesActivosConCuenta()).toEqual([a.usuarioId]);
    expect(await ficha(a.id)).toMatchObject({ activoFichaGerente: true, version: 0 });
    expect((await cuentaDe(a.id)).activoUsuario).toBe(true);
    expect([...(await historial(a.id)), ...(await historial(b.id))]).toEqual([
      expect.objectContaining({ accion: "DESACTIVAR", usuario_id: a.usuarioId }),
    ]);
  });

  it("dos bajas cruzadas sin pausas: el resultado es el mismo (una confirma, la otra ULTIMO_GERENTE_ACTIVO)", async () => {
    const a = await gerente();
    const b = await gerente();
    const rs = await Promise.allSettled([
      desactivarGerente(b.id, { version: 0 }, a.actor),
      desactivarGerente(a.id, { version: 0 }, b.actor),
    ]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((rs.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.code).toBe("ULTIMO_GERENTE_ACTIVO");
    expect(await gerentesActivosConCuenta()).toHaveLength(1);
    expect([...(await historial(a.id)), ...(await historial(b.id))]).toHaveLength(1);
  });

  it("lectura vieja: la segunda baja leyó los activos y se pausa antes de pedir el bloqueo; la primera confirma; la segunda relee y responde ULTIMO_GERENTE_ACTIVO", async () => {
    const a = await gerente();
    const b = await gerente();
    const pausa = pausarAntesDelPrimerBloqueo();
    // B desactiva a A: lee los ids de las activas (A y B) y se detiene antes de bloquear.
    const vieja = Promise.allSettled([desactivarGerente(a.id, { version: 0 }, b.actor)]);
    try {
      await pausa.listo;
      expect([...pausa.pedidos[0]!].sort()).toEqual([a.id, b.id].sort());
      // Mientras tanto, A desactiva a B y confirma.
      expect(await desactivarGerente(b.id, { version: 0 }, a.actor)).toMatchObject({ activo: false });
      pausa.soltar();
      const [r] = await vieja;
      expect(r).toMatchObject({ status: "rejected", reason: { code: "ULTIMO_GERENTE_ACTIVO" } });
    } finally {
      pausa.soltar();
      pausa.restaurar();
    }
    expect(await gerentesActivosConCuenta()).toEqual([a.usuarioId]);
    expect(await ficha(a.id)).toMatchObject({ activoFichaGerente: true, version: 0 });
    expect(await historial(a.id)).toHaveLength(0);
    expect(await historial(b.id)).toHaveLength(1);
  });

  it("tres gerentes activos: dos bajas simultáneas de objetivos distintos hechas por el tercero confirman las dos", async () => {
    const a = await gerente();
    const b = await gerente();
    const c = await gerente();
    const rs = await Promise.allSettled([
      desactivarGerente(a.id, { version: 0 }, c.actor),
      desactivarGerente(b.id, { version: 0 }, c.actor),
    ]);
    expect(rs).toEqual([
      { status: "fulfilled", value: { id: a.id, activo: false, version: 1 } },
      { status: "fulfilled", value: { id: b.id, activo: false, version: 1 } },
    ]);
    expect(await gerentesActivosConCuenta()).toEqual([c.usuarioId]);
    expect((await obtenerDetalleGerente(c.id, c.usuarioId)).esUltimoGerenteActivo).toBe(true);
  });

  it("único gerente activo con cuenta como objetivo, el resto sin cuenta o con la cuenta inactiva: ULTIMO_GERENTE_ACTIVO sin cambiar nada", async () => {
    const objetivo = await gerente();
    const sinCuenta = await gerenteSinCuenta();
    const conCuentaInactiva = await crearFichaGerenteDePrueba(db);
    await db.usuario.update({ where: { idUsuario: conCuentaInactiva.usuarioId! }, data: { activoUsuario: false } });
    expect((await ficha(sinCuenta)).activoFichaGerente).toBe(true);
    expect((await ficha(conCuentaInactiva.idFichaGerente)).activoFichaGerente).toBe(true);

    expect((await obtenerDetalleGerente(objetivo.id, registrante)).esUltimoGerenteActivo).toBe(true);
    await expect(desactivarGerente(objetivo.id, { version: 0, motivo: "x" }, actorUsuario(registrante))).rejects.toMatchObject({
      code: "ULTIMO_GERENTE_ACTIVO", status: 409,
    });
    expect(await ficha(objetivo.id)).toMatchObject({ activoFichaGerente: true, version: 0 });
    expect((await cuentaDe(objetivo.id)).activoUsuario).toBe(true);
    expect(await historial(objetivo.id)).toHaveLength(0);

    // Las otras dos no son «el último gerente»: se pueden dar de baja (la del objetivo queda).
    expect((await obtenerDetalleGerente(sinCuenta, registrante)).esUltimoGerenteActivo).toBe(false);
    expect(await desactivarGerente(sinCuenta, { version: 0 }, actorUsuario(registrante))).toMatchObject({ activo: false });
  });

  it("dos bajas simultáneas del mismo objetivo con la misma versión: una gana, la otra recibe conflicto o ya inactivo; un solo historial", async () => {
    const objetivo = await gerente();
    const actor = await gerente();
    const rs = await Promise.allSettled([
      desactivarGerente(objetivo.id, { version: 0 }, actor.actor),
      desactivarGerente(objetivo.id, { version: 0 }, actor.actor),
    ]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = rs.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(["CONFLICTO_EDICION_CONCURRENTE", "GERENTE_YA_INACTIVO"]).toContain(rechazo.reason.code);
    expect(await ficha(objetivo.id)).toMatchObject({ activoFichaGerente: false, version: 1 });
    expect(await historial(objetivo.id)).toHaveLength(1);
  });

  it("el DNI y el email de la ficha inactiva siguen reservados", async () => {
    const objetivo = await gerente();
    const actor = await gerente();
    await desactivarGerente(objetivo.id, { version: 0 }, actor.actor);
    const { dniFichaGerente, emailFichaGerente } = await ficha(objetivo.id);
    const alta = (doc: string, email: string) => ({ nombre: "Otro", apellido: "Gerente", dni: doc, fechaNacimiento: new Date(Date.UTC(1980, 0, 1)), email });
    await expect(crearGerente(alta(dniFichaGerente, `${unico("g05")}@prueba.local`), registrante)).rejects.toMatchObject({ code: "DNI_DUPLICADO" });
    await expect(crearGerente(alta(dni(), emailFichaGerente), registrante)).rejects.toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
  });

  it("ficha sin cuenta: baja sin motivo y reactivación con historial, sin tocar ninguna cuenta", async () => {
    const id = await gerenteSinCuenta();
    const actor = await gerente();
    const desactivar = vi.spyOn(cuentas, "desactivarCuenta");
    const reactivar = vi.spyOn(cuentas, "reactivarCuenta");
    try {
      expect(await obtenerDetalleGerente(id, actor.usuarioId)).toMatchObject({
        cuenta: { estado: "SIN_CUENTA" }, motivoObligatorioAlDesactivar: false, esUltimoGerenteActivo: false, esVos: false,
      });
      await desactivarGerente(id, { version: 0 }, actor.actor);
      await reactivarGerente(id, { version: 1 }, actor.actor);
      expect(desactivar).not.toHaveBeenCalled();
      expect(reactivar).not.toHaveBeenCalled();
    } finally {
      desactivar.mockRestore();
      reactivar.mockRestore();
    }
    expect(await ficha(id)).toMatchObject({ activoFichaGerente: true, version: 2, usuarioId: null });
    expect((await historial(id)).map((h) => h.accion)).toEqual(["REACTIVAR", "DESACTIVAR"]);
  });

  it("«registró operaciones»: quien dio de baja a otro necesita motivo para su propia baja; nada se borra y su nombre se sigue resolviendo", async () => {
    const operador = await gerente();
    const otro = await gerente();
    const tercero = await gerente();
    await desactivarGerente(otro.id, { version: 0, motivo: "Renuncia" }, operador.actor);

    expect((await obtenerDetalleGerente(operador.id, tercero.usuarioId)).motivoObligatorioAlDesactivar).toBe(true);
    await expect(desactivarGerente(operador.id, { version: 0 }, tercero.actor)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO", status: 400 });
    await expect(desactivarGerente(operador.id, { version: 0, motivo: "   " }, tercero.actor)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO" });
    expect(await ficha(operador.id)).toMatchObject({ activoFichaGerente: true, version: 0 });
    expect(await desactivarGerente(operador.id, { version: 0, motivo: "Dejó el centro" }, tercero.actor)).toMatchObject({ activo: false });

    // La baja que hizo sigue en el historial, con su nombre.
    expect((await obtenerDetalleGerente(otro.id, tercero.usuarioId)).historialEstados).toEqual([
      expect.objectContaining({ accion: "DESACTIVAR", motivo: "Renuncia", usuarioId: operador.usuarioId, usuarioNombre: `${operador.apellido}, Andrés` }),
    ]);
    expect(await obtenerNombresPersonal([operador.usuarioId])).toEqual([
      { usuario_id: operador.usuarioId, nombre_completo: `${operador.apellido}, Andrés` },
    ]);
  });

  it("el listado refleja el estado: inactivo tras la baja y activo tras la reactivación (criterio 5)", async () => {
    const objetivo = await gerente();
    const actor = await gerente();
    const fila = async () => (await listarGerentes({ pagina: 1, q: objetivo.apellido }, actor.usuarioId)).items;
    expect(await fila()).toEqual([expect.objectContaining({ id: objetivo.id, activo: true })]);
    await desactivarGerente(objetivo.id, { version: 0 }, actor.actor);
    expect(await fila()).toEqual([expect.objectContaining({ id: objetivo.id, activo: false })]);
    await reactivarGerente(objetivo.id, { version: 1 }, actor.actor);
    expect(await fila()).toEqual([expect.objectContaining({ id: objetivo.id, activo: true })]);
  });

  it("id inexistente: GERENTE_NO_ENCONTRADO en la baja y en la reactivación (bloquear no lanza)", async () => {
    const actor = await gerente();
    await gerente();
    await expect(desactivarGerente("ck-no-existe", { version: 0 }, actor.actor)).rejects.toMatchObject({ code: "GERENTE_NO_ENCONTRADO", status: 404 });
    await expect(reactivarGerente("ck-no-existe", { version: 0 }, actor.actor)).rejects.toMatchObject({ code: "GERENTE_NO_ENCONTRADO", status: 404 });
  });
});
