import { Suspense } from "react";
import type { RolUsuario } from "@prisma/client";
import { EventoCalendarioMateria } from "@/components/shared/evento-calendario-materia";
import { EncabezadoCalendario } from "@/components/shared/encabezado-calendario";
import { CuerpoCalendario } from "@/components/shared/cuerpo-calendario";
import { SelectorCalendario } from "@/components/shared/selector-calendario";
import { AvisoCalendario, CargandoCalendario } from "@/components/shared/estado-calendario";
import {
  construirUrlCalendarioMateria,
  construirUrlCalendarioProfesor,
  etiquetaMateria,
  hoyEnZonaCentro,
  navegacionDelCalendario,
  periodoDeLaVista,
  resolverVistaYFecha,
  type VistaCalendario,
} from "@/lib/calendario-semana";
import { listarMateriasDelCalendario, obtenerCalendarioMateria } from "@/server/calendario/calendario.service";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { ServiceError } from "@/server/shared/service-error";
import { exigirPermiso } from "@/server/shared/with-permission";

type Param = string | string[] | undefined;

/**
 * Calendario por materia (HU-J-02, `spec_modulo_J.md` §2.2) en vista día,
 * semana o mes (HU-J-03, §2.3). La autorización real es `calendario:leer`
 * verificada acá, en el servidor.
 *
 * Materia, vista y fecha viajan en la URL (`?materiaId=&vista=&fecha=`) para
 * conservarlas al navegar y al volver del detalle de un turno; `semana`
 * (HU-J-02) se sigue aceptando. Mesa de Entrada y Gerente ven todos los
 * turnos de la materia; un Profesor solo los suyos, y solo puede elegir las
 * materias que dicta (lo resuelve el servicio, no esta página).
 */
export default async function CalendarioMateriaPage({
  searchParams,
}: {
  searchParams: Promise<{ materiaId?: Param; vista?: Param; fecha?: Param; semana?: Param }>;
}) {
  const usuario = await exigirPermiso("calendario:leer");
  const params = await searchParams;

  const esProfesor = usuario.rol === "PROFESOR";
  const materiaId = primerValor(params.materiaId)?.trim() || undefined;

  const hoy = hoyEnZonaCentro();
  // Una vista o fecha inválida en la URL no rompe la página: abre la semana / hoy.
  const { vista, fecha, fechaExplicita } = resolverVistaYFecha(
    { vista: primerValor(params.vista), fecha: primerValor(params.fecha), semana: primerValor(params.semana) },
    hoy,
  );
  const fechaUrl = fechaExplicita ? fecha : undefined;

  const [parametros, materias] = await Promise.all([
    obtenerParametrosHorarioOperativo(),
    listarMateriasDelCalendario(usuario).catch((error: unknown) => {
      if (error instanceof ServiceError && MENSAJES_POR_CODIGO[error.code]) return error;
      throw error;
    }),
  ]);

  const periodo = periodoDeLaVista(vista, fecha, parametros.diasOperativos);
  const navegacion = navegacionDelCalendario({
    periodo,
    fecha,
    hoy,
    url: (valores) => construirUrlCalendarioMateria({ materiaId, ...valores }),
  });
  const sinMaterias = materias instanceof ServiceError;

  return (
    <div className="space-y-4 p-6">
      <EncabezadoCalendario
        subtitulo={esProfesor ? "Mis turnos por materia" : "Agenda por materia"}
        vista={vista}
        hrefsVista={navegacion.hrefsVista}
        tipos={[
          { etiqueta: esProfesor ? "Mi agenda" : "Por profesor", href: construirUrlCalendarioProfesor({ vista, fecha: fechaUrl }), activa: false },
          { etiqueta: "Por materia", href: construirUrlCalendarioMateria({ vista, fecha: fechaUrl }), activa: true },
        ]}
        navegacion={materiaId && !sinMaterias ? navegacion : undefined}
      >
        {!sinMaterias && (
          <SelectorCalendario
            id="materia"
            etiqueta="Materia"
            placeholder="Seleccioná una materia"
            sinOpciones={esProfesor ? "No tenés materias activas asociadas" : "No hay materias activas"}
            opciones={materias.map((materia) => ({ id: materia.id, etiqueta: etiquetaMateria(materia) }))}
            valor={materiaId}
            rutaBase="/calendario/materia"
            parametro="materiaId"
            vista={vista}
            fecha={fechaUrl}
          />
        )}
      </EncabezadoCalendario>

      {sinMaterias ? (
        <AvisoCalendario>{MENSAJES_POR_CODIGO[materias.code]}</AvisoCalendario>
      ) : materiaId ? (
        // Mismo criterio que la agenda por profesor: Suspense acotado a la
        // grilla, con `key` para no mostrar la materia o el período anterior
        // mientras carga el nuevo.
        <Suspense
          key={`${materiaId}-${vista}-${periodo.consulta.desde}`}
          fallback={<CargandoCalendario texto="Cargando turnos de la materia" />}
        >
          <TurnosDeLaMateria usuario={usuario} materiaId={materiaId} vista={vista} fecha={fecha} hoy={hoy} />
        </Suspense>
      ) : (
        materias.length > 0 && <AvisoCalendario>Seleccioná una materia para ver sus turnos</AvisoCalendario>
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
  MATERIA_NO_ENCONTRADA: "La materia seleccionada no existe o no está activa",
  PROFESOR_SIN_FICHA: "Tu cuenta no tiene una ficha de profesor vinculada",
  SIN_PERMISO: "No tenés permisos para ver los turnos de esa materia",
};

async function TurnosDeLaMateria({
  usuario,
  materiaId,
  vista,
  fecha,
  hoy,
}: {
  usuario: { id: string; rol: RolUsuario };
  materiaId: string;
  vista: VistaCalendario;
  fecha: string;
  hoy: string;
}) {
  let calendario;
  try {
    calendario = await obtenerCalendarioMateria({ usuario, materiaId, vista, fecha });
  } catch (error) {
    if (error instanceof ServiceError && MENSAJES_POR_CODIGO[error.code]) {
      return <AvisoCalendario>{MENSAJES_POR_CODIGO[error.code]}</AvisoCalendario>;
    }
    throw error;
  }

  const volverA = construirUrlCalendarioMateria({ materiaId, vista, fecha });

  return (
    <CuerpoCalendario
      calendario={calendario}
      hoy={hoy}
      encabezado={
        <>
          Turnos de <span className="font-medium text-foreground">{etiquetaMateria(calendario.materia)}</span>
        </>
      }
      textoVacio="No hay turnos para la materia seleccionada"
      hrefDia={(dia) => construirUrlCalendarioMateria({ materiaId, vista: "dia", fecha: dia })}
      renderEvento={(evento, estilo) => (
        <EventoCalendarioMateria evento={evento} estilo={estilo} volverA={volverA} />
      )}
    />
  );
}
