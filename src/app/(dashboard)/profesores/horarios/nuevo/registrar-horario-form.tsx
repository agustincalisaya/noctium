"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LinkProtegido } from "@/components/sesion/link-protegido";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import {
  ETIQUETA_DIA,
  generarHoras,
  horaAMinutos,
  minutosAHora,
  type ParametrosHorarioOperativo,
} from "@/lib/horario-atencion";
import { construirRegistrarHorarioSchema } from "@/server/profesores/profesor.schema";
import { registrarHorarioProfesor } from "@/server/profesores/actions";
import {
  ESTADO_INICIAL_REGISTRAR_HORARIO,
  type EstadoRegistrarHorario,
  type ProfesorActivoOpcion,
} from "@/types/profesor.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Horario registrado correctamente";

// Mismo estilo de <select> nativo que nuevo-profesor-form.tsx (HU-D-01).
const CLASE_SELECT = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "aria-invalid:border-destructive",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type Campo = "profesorId" | "diaSemana" | "horaInicio" | "horaFin";
type Valores = Record<Campo, string>;

/**
 * Formulario de horario de atención (HU-D-04). Mismo patrón que
 * `AsociarMateriasForm` (HU-D-03): valida con el mismo schema que el
 * servidor (armado con los parámetros operativos que recibe de la página)
 * e invoca la action directamente dentro de un try/catch.
 *
 * Los selects son controlados: ante un error los valores válidos quedan
 * cargados y el foco va al primer campo inválido. Cambiar de profesor
 * actualiza `?profesorId=` para que la página muestre su resumen semanal.
 * Tras guardar se limpian solo las horas (profesor y día quedan, para cargar
 * otro intervalo del mismo día) y se refresca el resumen.
 */
export function RegistrarHorarioForm({
  profesores,
  profesorIdInicial,
  parametros,
}: {
  profesores: ProfesorActivoOpcion[];
  profesorIdInicial: string;
  parametros: ParametrosHorarioOperativo;
}) {
  const [valores, setValores] = useState<Valores>({
    profesorId: profesorIdInicial,
    diaSemana: "",
    horaInicio: "",
    horaFin: "",
  });
  const [estado, setEstado] = useState<EstadoRegistrarHorario>(ESTADO_INICIAL_REGISTRAR_HORARIO);
  const [erroresCliente, setErroresCliente] = useState<Partial<Record<Campo, string>>>({});
  const [pendiente, setPendiente] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const router = useRouter();
  const { setDirty } = useDirtyState();

  const schema = useMemo(() => construirRegistrarHorarioSchema(parametros), [parametros]);
  const { apertura, cierre, granularidadMinutos } = parametros;
  // Inicio: de la apertura al último bloque antes del cierre; fin: del
  // primer bloque después de la apertura hasta el cierre.
  const horasInicio = useMemo(
    () => generarHoras(apertura, minutosAHora(horaAMinutos(cierre) - granularidadMinutos), granularidadMinutos),
    [apertura, cierre, granularidadMinutos],
  );
  const horasFin = useMemo(
    () => generarHoras(minutosAHora(horaAMinutos(apertura) + granularidadMinutos), cierre, granularidadMinutos),
    [apertura, cierre, granularidadMinutos],
  );

  const hayDatos =
    valores.diaSemana !== "" ||
    valores.horaInicio !== "" ||
    valores.horaFin !== "" ||
    valores.profesorId !== profesorIdInicial;

  useEffect(() => {
    setDirty(hayDatos);
  }, [hayDatos, setDirty]);

  useEffect(() => {
    // Mismo criterio que los formularios de HU-D-02/D-03: el dirty flag no
    // queda pegado si se sale por otro camino que no sea cancelar/guardar.
    return () => setDirty(false);
  }, [setDirty]);

  function cambiar(campo: Campo, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setErroresCliente((previos) => ({ ...previos, [campo]: undefined }));
    if (estado.status !== "idle") setEstado(ESTADO_INICIAL_REGISTRAR_HORARIO);
    if (campo === "profesorId") {
      router.replace(
        valor ? `/profesores/horarios/nuevo?profesorId=${valor}` : "/profesores/horarios/nuevo",
        { scroll: false },
      );
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const parsed = schema.safeParse(valores);
    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      const errores = {
        profesorId: campos.profesorId?.[0],
        diaSemana: campos.diaSemana?.[0],
        horaInicio: campos.horaInicio?.[0],
        horaFin: campos.horaFin?.[0],
      };
      setErroresCliente(errores);
      setEstado(ESTADO_INICIAL_REGISTRAR_HORARIO);
      enfocarPrimerCampoInvalido(form, errores);
      return;
    }
    setErroresCliente({});

    const formData = new FormData();
    formData.set("profesorId", parsed.data.profesorId);
    formData.set("diaSemana", parsed.data.diaSemana);
    formData.set("horaInicio", parsed.data.horaInicio);
    formData.set("horaFin", parsed.data.horaFin);

    setPendiente(true);
    try {
      const resultado = await registrarHorarioProfesor(formData);
      setEstado(resultado);
      if (resultado.status === "exito") {
        setValores((previos) => ({ ...previos, horaInicio: "", horaFin: "" }));
        router.refresh();
      } else if (resultado.status === "error_validacion") {
        enfocarPrimerCampoInvalido(form, resultado.errores);
      }
    } catch {
      setEstado({ status: "error_comunicacion" });
    } finally {
      setPendiente(false);
    }
  }

  const rutaVolver = valores.profesorId ? `/profesores/${valores.profesorId}` : "/profesores";

  function handleCancelar() {
    if (hayDatos) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push(rutaVolver);
  }

  function errorDe(campo: Campo): string | undefined {
    return (
      erroresCliente[campo] ??
      (estado.status === "error_validacion" ? estado.errores[campo]?.[0] : undefined)
    );
  }

  const mensajeError =
    estado.status === "error"
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

  function campoSelect(
    campo: Campo,
    etiqueta: string,
    placeholder: string,
    opciones: { value: string; label: string }[],
  ) {
    const error = errorDe(campo);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo}>
          {etiqueta} <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <select
          id={campo}
          name={campo}
          value={valores[campo]}
          onChange={(e) => cambiar(campo, e.target.value)}
          disabled={pendiente}
          aria-invalid={!!error}
          aria-describedby={error ? `${campo}-error` : undefined}
          className={CLASE_SELECT}
        >
          <option value="">{placeholder}</option>
          {opciones.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${campo}-error`} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {estado.status === "exito" && (
        <div role="status" className="space-y-1 rounded-md bg-success p-3 text-sm text-success-foreground">
          <p className="font-medium">{MENSAJE_EXITO}</p>
          <p>
            {ETIQUETA_DIA[estado.horario.diaSemana]} {estado.horario.horaInicio}–{estado.horario.horaFin}
          </p>
          <LinkProtegido
            href={`/profesores/${valores.profesorId}`}
            className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Volver a la ficha
          </LinkProtegido>
        </div>
      )}

      {campoSelect(
        "profesorId",
        "Profesor",
        "Seleccioná un profesor",
        profesores.map((profesor) => ({
          value: profesor.id,
          label: `${profesor.apellido}, ${profesor.nombre} · DNI ${profesor.dni}`,
        })),
      )}
      {campoSelect(
        "diaSemana",
        "Día de la semana",
        "Seleccioná un día",
        parametros.diasOperativos.map((dia) => ({ value: dia, label: ETIQUETA_DIA[dia] })),
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {campoSelect(
          "horaInicio",
          "Hora de inicio",
          "HH:MM",
          horasInicio.map((hora) => ({ value: hora, label: hora })),
        )}
        {campoSelect(
          "horaFin",
          "Hora de fin",
          "HH:MM",
          horasFin.map((hora) => ({ value: hora, label: hora })),
        )}
      </div>

      {mensajeError && (
        <p className="text-sm text-destructive" role="alert">
          {mensajeError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Registrar horario
        </Button>
        <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
          Cancelar
        </Button>
      </div>

      <ConfirmarDescarteDialog
        abierto={confirmandoCancelar}
        onAbiertoChange={setConfirmandoCancelar}
        onConfirmar={() => {
          setDirty(false);
          router.push(rutaVolver);
        }}
      />
    </form>
  );
}
