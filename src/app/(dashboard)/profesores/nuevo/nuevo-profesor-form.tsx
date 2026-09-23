"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { construirIdentidadProfesorSchema } from "@/server/profesores/profesor.schema";
import { crearProfesor, verificarDniDisponible } from "../actions";
import { ESTADO_INICIAL_NUEVO_PROFESOR, type EstadoNuevoProfesor } from "../profesor.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_DNI_DUPLICADO = "Ya existe un profesor registrado con ese DNI";

// Sin acoplamiento a @prisma/client como valor (ver nota de deuda técnica
// en docs/tasks/Sprint 1/HU-D-01.md, junto a §4.5) — mismos 4 valores de
// `enum Genero` en schema.prisma, hardcodeados acá igual que en
// profesor.schema.ts (GENERO_VALORES), por la misma restricción de
// bundling: este archivo es un Client Component.
const GENERO_OPCIONES: { value: string; label: string }[] = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMENINO", label: "Femenino" },
  { value: "OTRO", label: "Otro" },
  { value: "PREFIERO_NO_INDICARLO", label: "Prefiero no indicarlo" },
];

const CLASE_SELECT = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type NuevoProfesorFormProps = {
  dniLongitudMin: number;
  dniLongitudMax: number;
  /**
   * YYYY-MM-DD: hoy en UTC menos 18 años exactos. Es el `max` real del date
   * picker (mayoría de edad, regla agregada por decisión del usuario — ver
   * "Desviaciones de la spec original" en docs/tasks/Sprint 1/HU-D-01.md).
   */
  fechaMaximaNacimiento: string;
};

export function NuevoProfesorForm({
  dniLongitudMin,
  dniLongitudMax,
  fechaMaximaNacimiento,
}: NuevoProfesorFormProps) {
  // Mismo patrón que login-form.tsx: sin useActionState/<form action>,
  // invocación directa de la action envuelta en try/catch (un fallo de
  // transporte se escapa como excepción no controlada con el otro
  // mecanismo). A diferencia del login, crearProfesor() nunca llama
  // redirect() internamente (solo revalidatePath), así que acá no hace
  // falta unstable_rethrow antes de tratar el catch como error de comunicación.
  const [estado, setEstado] = useState<EstadoNuevoProfesor>(ESTADO_INICIAL_NUEVO_PROFESOR);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<Record<string, string | undefined>>({});
  const [dniNoDisponible, setDniNoDisponible] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();

  const schema = useMemo(
    () => construirIdentidadProfesorSchema(dniLongitudMin, dniLongitudMax),
    [dniLongitudMin, dniLongitudMax],
  );

  useEffect(() => {
    nombreRef.current?.focus();
    // Limpieza: si el usuario navega fuera del formulario sin pasar por
    // handleCancelar (ej. un link del menú, el botón "atrás" del browser)
    // ni por un submit exitoso, el dirty flag no debe quedar pegado para
    // la próxima pantalla que consuma DirtyStateProvider.
    return () => setDirty(false);
  }, [setDirty]);

  function leerValores(formData: FormData) {
    const generoIngresado = formData.get("genero");
    return {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fechaNacimiento: formData.get("fechaNacimiento"),
      genero:
        typeof generoIngresado === "string" && generoIngresado !== ""
          ? generoIngresado
          : undefined,
    };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = schema.safeParse(leerValores(formData));

    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      const errores = {
        nombre: campos.nombre?.[0],
        apellido: campos.apellido?.[0],
        dni: campos.dni?.[0],
        fechaNacimiento: campos.fechaNacimiento?.[0],
        genero: campos.genero?.[0],
      };
      setErroresCliente(errores);
      enfocarPrimerCampoInvalido(form, errores);
      return; // sin alta parcial: no se envía nada al servidor
    }
    setErroresCliente({});
    setPendiente(true);

    try {
      const resultado = await crearProfesor(estado, formData);
      setEstado(resultado);
      if (resultado.status === "exito") {
        setDirty(false);
      } else if (resultado.status === "error_validacion") {
        enfocarPrimerCampoInvalido(form, resultado.errores);
      }
    } catch {
      setEstado({ status: "error_comunicacion" });
    } finally {
      setPendiente(false);
    }
  }

  async function handleDniBlur(e: FocusEvent<HTMLInputElement>) {
    const dni = e.target.value.trim();
    if (!dni) return;
    try {
      const resultado = await verificarDniDisponible(dni);
      setDniNoDisponible(!resultado.disponible);
    } catch {
      // Ayuda de UX, nunca bloquea ni informa nada al usuario si falla
      // (incluido un PermisoError inesperado) — la verificación real y
      // determinante sigue siendo el submit final.
      setDniNoDisponible(false);
    }
  }

  function handleCancelar() {
    if (dirty) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push("/profesores");
  }

  const errorNombre = erroresCliente.nombre ?? (estado.status === "error_validacion" ? estado.errores.nombre?.[0] : undefined);
  const errorApellido = erroresCliente.apellido ?? (estado.status === "error_validacion" ? estado.errores.apellido?.[0] : undefined);
  const errorDni =
    erroresCliente.dni ??
    (estado.status === "error_validacion" ? estado.errores.dni?.[0] : undefined) ??
    (dniNoDisponible ? MENSAJE_DNI_DUPLICADO : undefined);
  const errorFechaNacimiento =
    erroresCliente.fechaNacimiento ??
    (estado.status === "error_validacion" ? estado.errores.fechaNacimiento?.[0] : undefined);
  const errorGenero = erroresCliente.genero ?? (estado.status === "error_validacion" ? estado.errores.genero?.[0] : undefined);
  const mensajeError =
    estado.status === "error"
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

  if (estado.status === "exito") {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm font-medium">Profesor registrado correctamente</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/profesores/${estado.profesorId}/contacto`}
            className={buttonVariants({ variant: "default" })}
          >
            Cargar datos de contacto
          </Link>
          <Link href={`/profesores/${estado.profesorId}`} className={buttonVariants({ variant: "outline" })}>
            Ver ficha del profesor
          </Link>
          <Link href="/profesores" className={buttonVariants({ variant: "outline" })}>
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setDirty(true)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">
          Nombre <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          ref={nombreRef}
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="off"
          aria-invalid={!!errorNombre}
        />
        {errorNombre && (
          <p className="text-sm text-destructive" role="alert">
            {errorNombre}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="apellido">
          Apellido <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="apellido"
          name="apellido"
          type="text"
          autoComplete="off"
          aria-invalid={!!errorApellido}
        />
        {errorApellido && (
          <p className="text-sm text-destructive" role="alert">
            {errorApellido}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dni">
          DNI <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="dni"
          name="dni"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          onBlur={handleDniBlur}
          onChange={() => setDniNoDisponible(false)}
          aria-invalid={!!errorDni}
        />
        {errorDni && (
          <p className="text-sm text-destructive" role="alert">
            {errorDni}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fechaNacimiento">
          Fecha de nacimiento <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input
          id="fechaNacimiento"
          name="fechaNacimiento"
          type="date"
          max={fechaMaximaNacimiento}
          aria-invalid={!!errorFechaNacimiento}
        />
        {errorFechaNacimiento && (
          <p className="text-sm text-destructive" role="alert">
            {errorFechaNacimiento}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="genero">Género</Label>
        <select id="genero" name="genero" defaultValue="" aria-invalid={!!errorGenero} className={CLASE_SELECT}>
          <option value=""></option>
          {GENERO_OPCIONES.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
        {errorGenero && (
          <p className="text-sm text-destructive" role="alert">
            {errorGenero}
          </p>
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
          Registrar profesor
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
          router.push("/profesores");
        }}
      />
    </form>
  );
}
