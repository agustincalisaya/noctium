import { Suspense, type ReactNode } from "react";
import { CalendarX, Loader2 } from "lucide-react";
import type { RolUsuario } from "@prisma/client";
import { GrillaSemanal } from "@/components/shared/grilla-semanal";
import { EventoCalendario } from "@/components/shared/evento-calendario";
import {
  construirUrlCalendarioProfesor,
  esFechaCalendario,
  hoyEnZonaCentro,
  lunesDeLaSemana,
  rangoDeLaSemana,
} from "@/lib/calendario-semana";
import { obtenerCalendarioProfesor } from "@/server/calendario/calendario.service";
import { listarOpcionesProfesoresActivos } from "@/server/profesores/profesor.service";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { exigirPermiso } from "@/server/shared/with-permission";
import { NavegacionSemana } from "./navegacion-semana";
import { SelectorProfesor } from "./selector-profesor";

/**
 * Agenda semanal por profesor (HU-J-01, `spec_modulo_J.md` §2.1). La
 * autorización real es `calendario:leer` verificada acá, en el servidor.
 *
 * Profesor y semana viajan en la URL (`?profesorId=&semana=`) para
 * conservarlos al volver del detalle de un turno. Para el rol Profesor el
 * `profesorId` de la URL se ignora: la agenda sale siempre de su sesión.
 */
export default async function AgendaProfesorPage({
  searchParams,
}: {
  searchParams: Promise<{ profesorId?: string | string[]; semana?: string | string[] }>;
}) {
  const usuario = await exigirPermiso("calendario:leer");
  const params = await searchParams;

  const esProfesor = usuario.rol === "PROFESOR";
  const profesorId = esProfesor ? undefined : primerValor(params.profesorId)?.trim() || undefined;
  const semana = primerValor(params.semana);

  const hoy = hoyEnZonaCentro();
  const lunesActual = lunesDeLaSemana(hoy);
  // Una semana inválida en la URL no rompe la página: abre la actual.
  const lunes = esFechaCalendario(semana) ? lunesDeLaSemana(semana) : lunesActual;

  const [parametros, opciones] = await Promise.all([
    obtenerParametrosHorarioOperativo(),
    esProfesor ? null : listarOpcionesProfesoresActivos(),
  ]);
  const rango = rangoDeLaSemana(lunes, parametros.diasOperativos);
  const hayAgenda = esProfesor || profesorId !== undefined;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-semibold">{esProfesor ? "Mi agenda" : "Agenda por profesor"}</h1>

      {opciones && <SelectorProfesor opciones={opciones} profesorId={profesorId} semana={lunes} />}

      {hayAgenda ? (
        <>
          <NavegacionSemana
            lunes={lunes}
            rango={rango}
            profesorId={profesorId}
            esSemanaActual={lunes === lunesActual}
          />
          {/*
           * Suspense manual acotado a la grilla, no `loading.tsx` (mismo
           * criterio que HU-D-05). La `key` fuerza el fallback al cambiar de
           * profesor o de semana, así no se ve la agenda anterior mientras carga.
           */}
          <Suspense key={`${profesorId ?? "propia"}-${lunes}`} fallback={<CargandoAgenda />}>
            <AgendaSemanal usuario={usuario} profesorId={profesorId} lunes={lunes} hoy={hoy} />
          </Suspense>
        </>
      ) : (
        <Aviso>Seleccioná un profesor para ver su agenda</Aviso>
      )}
    </div>
  );
}

function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function CargandoAgenda() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando agenda
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-card py-12 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

// Errores de negocio esperables: se informan en la página, no como error
// técnico (ese va a `error.tsx` con Reintentar).
const MENSAJES_POR_CODIGO: Record<string, string> = {
  PROFESOR_NO_ENCONTRADO: "El profesor seleccionado no existe o no está activo",
  PROFESOR_SIN_FICHA: "Tu cuenta no tiene una ficha de profesor vinculada",
  SIN_PERMISO: "No tenés permisos para acceder a esta sección",
};

async function AgendaSemanal({
  usuario,
  profesorId,
  lunes,
  hoy,
}: {
  usuario: { id: string; rol: RolUsuario };
  profesorId: string | undefined;
  lunes: string;
  hoy: string;
}) {
  let calendario;
  try {
    calendario = await obtenerCalendarioProfesor({
      usuario,
      profesorIdSolicitado: profesorId,
      lunes,
      rechazarAjeno: false,
    });
  } catch (error) {
    if (error instanceof ServiceError && MENSAJES_POR_CODIGO[error.code]) {
      return <Aviso>{MENSAJES_POR_CODIGO[error.code]}</Aviso>;
    }
    throw error;
  }

  // Para el rol Profesor, `profesorId` es undefined y la URL de vuelta no
  // lo lleva: su agenda sale siempre de la sesión.
  const volverA = construirUrlCalendarioProfesor({ profesorId, semana: lunes });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Turnos agendados de <span className="font-medium text-foreground">{calendario.profesor.nombre_completo}</span>
      </p>

      {calendario.eventos.length === 0 && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-md border border-border bg-card py-4 text-sm text-muted-foreground"
        >
          <CalendarX className="size-4" aria-hidden />
          Agenda sin turnos
        </div>
      )}

      <GrillaSemanal
        dias={calendario.dias}
        horario={calendario.horario}
        eventos={calendario.eventos}
        hoy={hoy}
        renderEvento={(evento, estilo) => (
          <EventoCalendario evento={evento} estilo={estilo} volverA={volverA} />
        )}
      />
    </div>
  );
}
