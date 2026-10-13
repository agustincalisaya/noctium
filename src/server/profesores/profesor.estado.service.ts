import type { z } from "zod";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import { prisma } from "@/lib/prisma";
import { bloquear } from "@/server/shared/bloquear";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";
import type { ActorDominio } from "@/server/shared/historial";
import { registrarCambioEstado, listarHistorialEstados } from "@/server/shared/historial-estados";
import { desactivarCuenta, reactivarCuenta } from "@/server/usuarios/cuenta.service";
import { profesorTieneRegistros } from "@/server/historial/historial.publico";
import { turnosConPagosVigentes } from "@/server/pagos/pago.publico";
import { obtenerMateriasPorIds } from "@/server/materias/materia.publico";
import {
  contarTurnosFuturosDeProfesor, profesorTieneClasesPasadas, listarTurnosFuturosDeProfesor,
  obtenerTurnosBasicos, gerentePuedeGestionarClaseDeBaja, evaluarCambioDeProfesor,
  cancelarTurnoPorBajaDeProfesor, cambiarProfesorDeTurno,
} from "@/server/turnos/turno.publico";
import { listarProfesoresActivosPorMateria, profesorActivoDictaMateria } from "@/server/profesores/profesor.publico";
import type { DesactivarProfesorSchema, ReactivarProfesorSchema, TurnosLoteSchema, CambiarProfesorLoteSchema, ListarTurnosFuturosBajaQuerySchema } from "@/server/profesores/profesor.schema";

async function ficha(id: string, db: Tx = prisma) {
  const p = await db.profesor.findUnique({ where: { idProfesor: id } });
  if (!p) throw new ErrorDeDominio("errores.profesor.noEncontrado");
  return p;
}
async function tieneHistoria(id: string, db: Tx = prisma) {
  const [pasadas, academica] = await Promise.all([profesorTieneClasesPasadas(id, db), profesorTieneRegistros(id, db)]);
  return pasadas || academica;
}
export async function obtenerImpactoBajaProfesor(id: string) {
  const p = await ficha(id);
  if (!p.activoProfesor) throw new ErrorDeDominio("errores.profesor.yaInactivo");
  const [clases_futuras, motivo_obligatorio] = await Promise.all([contarTurnosFuturosDeProfesor(id), tieneHistoria(id)]);
  return { profesor: { id, nombre_para_mostrar: `${p.nombreProfesor} ${p.apellidoProfesor}` }, version: p.version,
    clases_futuras, tiene_cuenta: Boolean(p.usuarioId), motivo_obligatorio };
}
export async function desactivarProfesor(id: string, input: z.infer<typeof DesactivarProfesorSchema>, actor: ActorDominio) {
  return transaccion(async (tx) => {
    await bloquear(tx, { recursos: { profesores: [id] } });
    const p = await ficha(id, tx);
    if (!p.activoProfesor) throw new ErrorDeDominio("errores.profesor.yaInactivo");
    if (p.version !== input.version) throw new ErrorDeDominio("errores.profesor.conflictoEdicion");
    const motivo = input.motivo?.trim() || null;
    if (!motivo && await tieneHistoria(id, tx)) throw new ErrorDeDominio("errores.profesor.motivoRequerido");
    const futuras = await contarTurnosFuturosDeProfesor(id, tx);
    if (futuras.confirmados) throw new ErrorDeDominio("errores.profesor.conClasesFuturas", { total: futuras.confirmados, pendientes: futuras.pendientes });
    const r = await tx.profesor.updateMany({ where: { idProfesor: id, activoProfesor: true, version: input.version },
      data: { activoProfesor: false, version: { increment: 1 }, modificadoPorUsuarioId: actor.tipo === "USUARIO" ? actor.usuarioId : null } });
    if (!r.count) throw new ErrorDeDominio("errores.profesor.conflictoEdicion");
    if (p.usuarioId) await desactivarCuenta(tx, p.usuarioId);
    registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "DESACTIVAR", motivo, actor });
    return { id, activo: false, version: p.version + 1, pendientes_afectados: futuras.pendientes };
  });
}
export async function reactivarProfesor(id: string, input: z.infer<typeof ReactivarProfesorSchema>, actor: ActorDominio) {
  return transaccion(async (tx) => {
    await bloquear(tx, { recursos: { profesores: [id] } });
    const p = await ficha(id, tx);
    if (p.activoProfesor) throw new ErrorDeDominio("errores.profesor.yaActivo");
    if (p.version !== input.version) throw new ErrorDeDominio("errores.profesor.conflictoEdicion");
    const r = await tx.profesor.updateMany({ where: { idProfesor: id, activoProfesor: false, version: input.version },
      data: { activoProfesor: true, version: { increment: 1 }, modificadoPorUsuarioId: actor.tipo === "USUARIO" ? actor.usuarioId : null } });
    if (!r.count) throw new ErrorDeDominio("errores.profesor.conflictoEdicion");
    if (p.usuarioId) await reactivarCuenta(tx, p.usuarioId);
    registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "REACTIVAR", actor });
    return { id, activo: true, version: p.version + 1 };
  });
}
export async function obtenerHistorialEstadosProfesor(id: string) {
  const historial = await listarHistorialEstados("PROFESOR", id);
  const nombres = await obtenerNombresPersonal(historial.flatMap((r) => r.usuario_id ? [r.usuario_id] : []));
  const porId = new Map(nombres.map((n) => [n.usuario_id, n.nombre_completo]));
  return historial.map((r) => ({ ...r, usuario_nombre: r.usuario_id ? porId.get(r.usuario_id) ?? null : null }));
}
export async function listarTurnosFuturosParaBaja(id: string, query: z.infer<typeof ListarTurnosFuturosBajaQuerySchema>) {
  const p = await ficha(id);
  const lista = await listarTurnosFuturosDeProfesor(id, { materiaId: query.materia_id, pagina: query.pagina, porPagina: 10 });
  const idsMaterias = [...new Set([...lista.materias.map((m) => m.materia_id), ...(query.materia_id ? [query.materia_id] : [])])];
  const [materias, pagos, futuras, destinos] = await Promise.all([
    obtenerMateriasPorIds(idsMaterias), turnosConPagosVigentes([...new Set([...lista.items.map((t) => t.turno_id), ...lista.seleccion.items.map((t) => t.turno_id)])]),
    contarTurnosFuturosDeProfesor(id),
    Promise.all(lista.materias.map(async (m) => ({ materia_id: m.materia_id, profesores: (await listarProfesoresActivosPorMateria(m.materia_id)).filter((p) => p.id !== id) }))),
  ]);
  if (query.materia_id && !materias.some((m) => m.id === query.materia_id)) throw new ErrorDeDominio("errores.profesor.materiaNoEncontrada");
  const nombres = new Map(materias.map((m) => [m.id, m.nombre]));
  const conPagos = new Set(pagos);
  const profesor = { id, nombre_para_mostrar: `${p.nombreProfesor} ${p.apellidoProfesor}` };
  const enriquecer = ({ materia_id, ...t }: (typeof lista.items)[number]) => ({ ...t, materia: { id: materia_id, nombre: nombres.get(materia_id) ?? materia_id }, profesor, con_pagos: conPagos.has(t.turno_id) });
  return { profesor, items: lista.items.map(enriquecer),
    total: lista.total, pagina: query.pagina, por_pagina: 10,
    materias: lista.materias.map((m) => ({ id: m.materia_id, nombre: nombres.get(m.materia_id) ?? m.materia_id, cantidad: m.cantidad })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    seleccion: { ...lista.seleccion, items: lista.seleccion.items.map(enriquecer), con_pagos: lista.seleccion.items.filter((t) => conPagos.has(t.turno_id)).length }, pendientes: futuras.pendientes,
    confirmados: futuras.confirmados, destinos,
  };
}
async function validarLote(id: string, ids: string[]) {
  const p = await ficha(id);
  if (!p.activoProfesor) throw new ErrorDeDominio("errores.profesor.inactivo");
  const alcances = await Promise.all(ids.map((turnoId) => gerentePuedeGestionarClaseDeBaja(turnoId, id)));
  if (alcances.some((valido) => !valido)) throw new ErrorDeDominio("errores.profesor.sinPermiso");
}
async function validarCambio(id: string, input: z.infer<typeof CambiarProfesorLoteSchema>) {
  await validarLote(id, input.turno_ids);
  const clases = await obtenerTurnosBasicos(input.turno_ids);
  const materias = new Set(clases.map((t) => t.materia_id));
  if (materias.size !== 1) throw new ErrorDeDominio("errores.profesor.materiasDistintas");
  if (input.profesor_destino_id === id) throw new ErrorDeDominio("errores.profesor.destinoIgualOrigen");
  const destino = await ficha(input.profesor_destino_id);
  if (!destino.activoProfesor) throw new ErrorDeDominio("errores.profesor.inactivo");
  if (!(await profesorActivoDictaMateria(input.profesor_destino_id, clases[0].materia_id))) throw new ErrorDeDominio("errores.profesor.noDictaMateria");
}
export async function obtenerDestinosDeClases(id: string, turnoIds: string[]) {
  await validarLote(id, turnoIds);
  const clases = await obtenerTurnosBasicos(turnoIds);
  if (new Set(clases.map((t) => t.materia_id)).size !== 1) throw new ErrorDeDominio("errores.profesor.materiasDistintas");
  return (await listarProfesoresActivosPorMateria(clases[0].materia_id)).filter((p) => p.id !== id);
}
export async function previsualizarCambioDeProfesor(id: string, input: z.infer<typeof CambiarProfesorLoteSchema>) {
  await validarCambio(id, input);
  const resultados = await evaluarCambioDeProfesor(input.profesor_destino_id, input.turno_ids);
  const se_pueden = resultados.filter((r) => r.resultado === "SE_PUEDE").length;
  return { resultados, se_pueden, no_se_pueden: resultados.length - se_pueden };
}
async function procesar(ids: string[], id: string, operar: (tx: Tx, turnoId: string) => Promise<unknown>) {
  let procesadas = 0;
  const no_procesadas: { turno_id: string; code: string; message: string }[] = [];
  for (const turnoId of ids) {
    try { await transaccion((tx) => operar(tx, turnoId)); procesadas++; }
    catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      no_procesadas.push({ turno_id: turnoId, code: error.code, message: error.message });
    }
  }
  return { procesadas, no_procesadas, restantes: await contarTurnosFuturosDeProfesor(id) };
}
export async function cancelarTurnosFuturosDeProfesor(id: string, input: z.infer<typeof TurnosLoteSchema>, actor: ActorDominio) {
  await validarLote(id, input.turno_ids);
  const resultado = await procesar(input.turno_ids, id, async (tx, turnoId) => {
    const p = await ficha(id, tx);
    // La mutación de C bloquea origen y clase y vuelve a validar alcance.
    if (!p.activoProfesor) throw new ErrorDeDominio("errores.profesor.inactivo");
    return cancelarTurnoPorBajaDeProfesor(tx, { turnoId, profesorId: id, actor });
  });
  return { ...resultado, canceladas: resultado.procesadas };
}
export async function cambiarProfesorDeTurnosFuturos(id: string, input: z.infer<typeof CambiarProfesorLoteSchema>, actor: ActorDominio) {
  await validarCambio(id, input);
  const resultado = await procesar(input.turno_ids, id, (tx, turnoId) => cambiarProfesorDeTurno(tx, { turnoId, profesorOrigenId: id, profesorDestinoId: input.profesor_destino_id, actor }));
  return { ...resultado, cambiadas: resultado.procesadas };
}
