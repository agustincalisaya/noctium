import { Suspense } from "react";
import type { RolUsuario } from "@prisma/client";
import { GrillaSemanal } from "@/components/shared/grilla-semanal";
import { EventoCalendarioMateria } from "@/components/shared/evento-calendario-materia";
import { NavegacionSemana } from "@/components/shared/navegacion-semana";
import { SelectorCalendario } from "@/components/shared/selector-calendario";
import { AvisoCalendario, CalendarioVacio, CargandoCalendario } from "@/components/shared/estado-calendario";
import {
  construirUrlCalendarioMateria,
  desplazarSemana,
  esFechaCalendario,
  etiquetaMateria,
  hoyEnZonaCentro,
  lunesDeLaSemana,
  rangoDeLaSemana,
} from "@/lib/calendario-semana";
import { listarMateriasDelCalendario, obtenerCalendarioMateria } from "@/server/calendario/calendario.service";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { exigirPermiso } from "@/server/shared/with-permission";

/**
 * Calendario semanal por materia (HU-J-02, `spec_modulo_J.md` §2.2). La
 * autorización real es `calendario:leer` verificada acá, en el servidor.
 *
 * Materia y semana viajan en la URL (`?materiaId=&semana=`) para
 * conservarlas al navegar y al volver del detalle de un turno. Mesa de
 * Entrada y Gerente ven todos los turnos de la materia; un Profesor solo
 * los suyos, y solo puede elegir las materias que dicta (lo resuelve el
 * servicio, no esta página).
 */
export default async function CalendarioMateriaPage({
  searchParams,
}: {
  searchParams: Promise<{ materiaId?: string | string[]; semana?: string | string[] }>;
}) {
  const usuario = await exigirPermiso("calendario:leer");
  const params = await searchParams;

  const esProfesor = usuario.rol === "PROFESOR";
  const materiaId = primerValor(params.materiaId)?.trim() || undefined;
  const semana = primerValor(params.semana);

  const hoy = hoyEnZonaCentro();
  const lunesActual = lunesDeLaSemana(hoy);
  // Una semana inválida en la URL no rompe la página: abre la actual.
  const lunes = esFechaCalendario(semana) ? lunesDeLaSemana(semana) : lunesActual;

  const titulo = <h1 className="text-lg font-semibold">{esProfesor ? "Mis turnos por materia" : "Agenda por materia"}</h1>;

  const [parametros, materias] = await Promise.all([
    obtenerParametrosHorarioOperativo(),
    listarMateriasDelCalendario(usuario).catch((error: unknown) => {
      if (error instanceof ServiceError && MENSAJES_POR_CODIGO[error.code]) return error;
      throw error;
    }),
  ]);

  if (materias instanceof ServiceError) {
    return (
      <div className="space-y-4 p-6">
        {titulo}
        <AvisoCalendario>{MENSAJES_POR_CODIGO[materias.code]}</AvisoCalendario>
      </div>
    );
  }

  const rango = rangoDeLaSemana(lunes, parametros.diasOperativos);

  return (
    <div className="space-y-4 p-6">
      {titulo}

      <SelectorCalendario
        id="materia"
        etiqueta="Materia"
        placeholder="Seleccioná una materia"
        sinOpciones={esProfesor ? "No tenés materias activas asociadas" : "No hay materias activas"}
        opciones={materias.map((materia) => ({ id: materia.id, etiqueta: etiquetaMateria(materia) }))}
        valor={materiaId}
        rutaBase="/calendario/materia"
        parametro="materiaId"
        semana={lunes}
      />

      {materiaId ? (
        <>
          <NavegacionSemana
            rango={rango}
            hrefAnterior={construirUrlCalendarioMateria({ materiaId, semana: desplazarSemana(lunes, -1) })}
            hrefHoy={construirUrlCalendarioMateria({ materiaId })}
            hrefSiguiente={construirUrlCalendarioMateria({ materiaId, semana: desplazarSemana(lunes, 1) })}
            esSemanaActual={lunes === lunesActual}
          />
          {/*
           * Mismo criterio que la agenda por profesor: Suspense acotado a la
           * grilla, con `key` para no mostrar la materia/semana anterior
           * mientras carga la nueva.
           */}
          <Suspense key={`${materiaId}-${lunes}`} fallback={<CargandoCalendario texto="Cargando turnos de la materia" />}>
            <TurnosDeLaSemana usuario={usuario} materiaId={materiaId} lunes={lunes} hoy={hoy} />
          </Suspense>
        </>
      ) : (
        materias.length > 0 && <AvisoCalendario>Seleccioná una materia para ver sus turnos</AvisoCalendario>
      )}
    </div>
  );
}

function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

// Errores de negocio esperables: se informan en la página, no como error
// técnico (ese va a `error.tsx` con Reintentar).
const MENSAJES_POR_CODIGO: Record<string, string> = {
  MATERIA_NO_ENCONTRADA: "La materia seleccionada no existe o no está activa",
  PROFESOR_SIN_FICHA: "Tu cuenta no tiene una ficha de profesor vinculada",
  SIN_PERMISO: "No tenés permisos para ver los turnos de esa materia",
};

async function TurnosDeLaSemana({
  usuario,
  materiaId,
  lunes,
  hoy,
}: {
  usuario: { id: string; rol: RolUsuario };
  materiaId: string;
  lunes: string;
  hoy: string;
}) {
  let calendario;
  try {
    calendario = await obtenerCalendarioMateria({ usuario, materiaId, lunes });
  } catch (error) {
    if (error instanceof ServiceError && MENSAJES_POR_CODIGO[error.code]) {
      return <AvisoCalendario>{MENSAJES_POR_CODIGO[error.code]}</AvisoCalendario>;
    }
    throw error;
  }

  const volverA = construirUrlCalendarioMateria({ materiaId, semana: lunes });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Turnos de <span className="font-medium text-foreground">{etiquetaMateria(calendario.materia)}</span>
      </p>

      {calendario.eventos.length === 0 && <CalendarioVacio texto="No hay turnos para la materia seleccionada" />}

      <GrillaSemanal
        dias={calendario.dias}
        horario={calendario.horario}
        eventos={calendario.eventos}
        hoy={hoy}
        renderEvento={(evento, estilo) => (
          <EventoCalendarioMateria evento={evento} estilo={estilo} volverA={volverA} />
        )}
      />
    </div>
  );
}
