import { Suspense } from "react";
import type { RolUsuario } from "@prisma/client";
import { EventoCalendario } from "@/components/shared/evento-calendario";
import { EncabezadoCalendario } from "@/components/shared/encabezado-calendario";
import { CuerpoCalendario } from "@/components/shared/cuerpo-calendario";
import { SelectorCalendario } from "@/components/shared/selector-calendario";
import { AvisoCalendario, CargandoCalendario } from "@/components/shared/estado-calendario";
import {
  construirUrlCalendarioMateria,
  construirUrlCalendarioProfesor,
  hoyEnZonaCentro,
  navegacionDelCalendario,
  periodoDeLaVista,
  resolverVistaYFecha,
  type VistaCalendario,
} from "@/lib/calendario-semana";
import { obtenerCalendarioProfesor } from "@/server/calendario/calendario.service";
import { listarOpcionesProfesoresActivos } from "@/server/profesores/profesor.service";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { exigirPermiso } from "@/server/shared/with-permission";

type Param = string | string[] | undefined;

/**
 * Agenda por profesor (HU-J-01, `spec_modulo_J.md` §2.1) en vista día,
 * semana o mes (HU-J-03, §2.3). La autorización real es `calendario:leer`
 * verificada acá, en el servidor.
 *
 * Profesor, vista y fecha viajan en la URL (`?profesorId=&vista=&fecha=`)
 * para conservarlos al navegar y al volver del detalle de un turno; `semana`
 * (HU-J-01) se sigue aceptando. Para el rol Profesor el `profesorId` de la
 * URL se ignora: la agenda sale siempre de su sesión.
 */
export default async function AgendaProfesorPage({
  searchParams,
}: {
  searchParams: Promise<{ profesorId?: Param; vista?: Param; fecha?: Param; semana?: Param }>;
}) {
  const usuario = await exigirPermiso("calendario:leer");
  const params = await searchParams;

  const esProfesor = usuario.rol === "PROFESOR";
  const profesorId = esProfesor ? undefined : primerValor(params.profesorId)?.trim() || undefined;

  const hoy = hoyEnZonaCentro();
  // Una vista o fecha inválida en la URL no rompe la página: abre la semana / hoy.
  const { vista, fecha, fechaExplicita } = resolverVistaYFecha(
    { vista: primerValor(params.vista), fecha: primerValor(params.fecha), semana: primerValor(params.semana) },
    hoy,
  );
  const fechaUrl = fechaExplicita ? fecha : undefined;

  const [parametros, opciones] = await Promise.all([
    obtenerParametrosHorarioOperativo(),
    esProfesor ? null : listarOpcionesProfesoresActivos(),
  ]);
  const periodo = periodoDeLaVista(vista, fecha, parametros.diasOperativos);
  const navegacion = navegacionDelCalendario({
    periodo,
    fecha,
    hoy,
    url: (valores) => construirUrlCalendarioProfesor({ profesorId, ...valores }),
  });
  const hayAgenda = esProfesor || profesorId !== undefined;

  return (
    <div className="space-y-4 p-6">
      <EncabezadoCalendario
        subtitulo={esProfesor ? "Mi agenda" : "Agenda por profesor"}
        vista={vista}
        hrefsVista={navegacion.hrefsVista}
        tipos={[
          { etiqueta: esProfesor ? "Mi agenda" : "Por profesor", href: construirUrlCalendarioProfesor({ vista, fecha: fechaUrl }), activa: true },
          { etiqueta: "Por materia", href: construirUrlCalendarioMateria({ vista, fecha: fechaUrl }), activa: false },
        ]}
        navegacion={hayAgenda ? navegacion : undefined}
      >
        {opciones && (
          <SelectorCalendario
            id="profesor"
            etiqueta="Profesor"
            placeholder="Seleccioná un profesor"
            sinOpciones="No hay profesores activos"
            opciones={opciones.map(({ id, nombreParaMostrar }) => ({ id, etiqueta: nombreParaMostrar }))}
            valor={profesorId}
            rutaBase="/calendario/profesor"
            parametro="profesorId"
            vista={vista}
            fecha={fechaUrl}
          />
        )}
      </EncabezadoCalendario>

      {hayAgenda ? (
        // Suspense manual acotado a la grilla, no `loading.tsx` (mismo criterio
        // que HU-D-05). La `key` fuerza el fallback al cambiar de profesor, de
        // vista o de período, así no se ve la agenda anterior mientras carga.
        <Suspense
          key={`${profesorId ?? "propia"}-${vista}-${periodo.consulta.desde}`}
          fallback={<CargandoCalendario texto="Cargando agenda" />}
        >
          <Agenda usuario={usuario} profesorId={profesorId} vista={vista} fecha={fecha} hoy={hoy} />
        </Suspense>
      ) : (
        <AvisoCalendario>Seleccioná un profesor para ver su agenda</AvisoCalendario>
      )}
    </div>
  );
}

function primerValor(valor: Param): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

// Errores de negocio esperables: se informan en la página, no como error
// técnico (ese va a `error.tsx` con Reintentar).
const MENSAJES_POR_CODIGO: Record<string, string> = {
  PROFESOR_NO_ENCONTRADO: "El profesor seleccionado no existe o no está activo",
  PROFESOR_SIN_FICHA: "Tu cuenta no tiene una ficha de profesor vinculada",
  SIN_PERMISO: "No tenés permisos para acceder a esta sección",
};

async function Agenda({
  usuario,
  profesorId,
  vista,
  fecha,
  hoy,
}: {
  usuario: { id: string; rol: RolUsuario };
  profesorId: string | undefined;
  vista: VistaCalendario;
  fecha: string;
  hoy: string;
}) {
  let calendario;
  try {
    calendario = await obtenerCalendarioProfesor({
      usuario,
      profesorIdSolicitado: profesorId,
      vista,
      fecha,
      rechazarAjeno: false,
    });
  } catch (error) {
    if (error instanceof ServiceError && MENSAJES_POR_CODIGO[error.code]) {
      return <AvisoCalendario>{MENSAJES_POR_CODIGO[error.code]}</AvisoCalendario>;
    }
    throw error;
  }

  // Para el rol Profesor, `profesorId` es undefined y la URL de vuelta no
  // lo lleva: su agenda sale siempre de la sesión.
  const volverA = construirUrlCalendarioProfesor({ profesorId, vista, fecha });

  return (
    <CuerpoCalendario
      calendario={calendario}
      hoy={hoy}
      encabezado={
        <>
          Turnos agendados de <span className="font-medium text-foreground">{calendario.profesor.nombre_completo}</span>
        </>
      }
      textoVacio="Agenda sin turnos"
      hrefDia={(dia) => construirUrlCalendarioProfesor({ profesorId, vista: "dia", fecha: dia })}
      renderEvento={(evento, estilo) => <EventoCalendario evento={evento} estilo={estilo} volverA={volverA} />}
    />
  );
}
