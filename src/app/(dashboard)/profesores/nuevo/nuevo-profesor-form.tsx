"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { texto } from "@/lib/textos";
import { construirAltaProfesorSchema } from "@/server/profesores/profesor.schema";
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
  // HU-A-06: alta ya validada, a la espera de la confirmación de HU-C-25.
  const [pendienteDeConfirmar, setPendienteDeConfirmar] = useState<{ datos: FormData; form: HTMLFormElement; email: string } | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const { notificarExito } = useToast();

  // Identidad (HU-D-01) + contacto opcional con las reglas de HU-D-02: el
  // mismo schema que vuelve a aplicar la Server Action en el servidor.
  const schema = useMemo(
    () => construirAltaProfesorSchema(dniLongitudMin, dniLongitudMax),
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
      telefono: formData.get("telefono"),
      email: formData.get("email"),
    };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = schema.safeParse(leerValores(formData));
    const campos = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
    const errores: Record<string, string | undefined> = {
      nombre: campos.nombre?.[0],
      apellido: campos.apellido?.[0],
      dni: campos.dni?.[0],
      fechaNacimiento: campos.fechaNacimiento?.[0],
      genero: campos.genero?.[0],
      telefono: campos.telefono?.[0],
      email: campos.email?.[0],
    };
    // HU-A-06 c1: en la pantalla el email es obligatorio (con él se crea la
    // cuenta); el servidor sigue admitiendo el alta sin email (P-D1).
    const emailVacio = String(formData.get("email") ?? "").trim() === "";
    if (emailVacio) errores.email = texto("ui.profesores.alta.emailRequerido");
    if (!parsed.success || !parsed.data.email) {
      setErroresCliente(errores);
      setEstado(ESTADO_INICIAL_NUEVO_PROFESOR);
      enfocarPrimerCampoInvalido(form, errores);
      return; // sin alta parcial: no se envía nada al servidor
    }
    setErroresCliente({});
    setPendienteDeConfirmar({ datos: formData, form, email: parsed.data.email });
  }

  /**
   * Confirmación de HU-C-25 (paso 1 del wizard, donde se registra la ficha):
   * una sola llamada crea la ficha y la cuenta. Un rechazo de campo cierra el
   * diálogo y se muestra junto al campo (EMAIL_YA_ASOCIADO, sin revelar de
   * quién es); el resto se muestra dentro del diálogo.
   */
  async function confirmarAlta() {
    if (!pendienteDeConfirmar) return;
    const { datos, form } = pendienteDeConfirmar;
    setPendiente(true);

    // Éxito (HU-D-01 c4, wizard de alta): toast y paso 2 (materias) sin
    // pantalla intermedia. `pendiente` queda en true hasta que la navegación
    // desmonte el formulario, así no se puede reenviar mientras tanto. Desde
    // HU-A-06 el toast informa también la cuenta creada (spec_modulo_D.md §2.9.1).
    let resultado: EstadoNuevoProfesor;
    try {
      resultado = await crearProfesor(estado, datos);
    } catch {
      setPendiente(false);
      throw new Error(MENSAJE_ERROR_COMUNICACION);
    }
    if (resultado.status === "exito") {
      setEstado(resultado);
      setDirty(false);
      notificarExito(texto("ui.profesores.alta.exito"));
      router.push(`/profesores/${resultado.profesorId}/materias?alta=1`);
      return;
    }
    setPendiente(false);
    if (resultado.status === "error_validacion") {
      setEstado(resultado);
      enfocarPrimerCampoInvalido(form, resultado.errores);
      return;
    }
    throw new Error(resultado.status === "error" ? resultado.mensaje : MENSAJE_ERROR_COMUNICACION);
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
  const errorTelefono =
    erroresCliente.telefono ?? (estado.status === "error_validacion" ? estado.errores.telefono?.[0] : undefined);
  // Incluye EMAIL_YA_ASOCIADO, que la action devuelve como error de este campo.
  const errorEmail = erroresCliente.email ?? (estado.status === "error_validacion" ? estado.errores.email?.[0] : undefined);
  const mensajeError =
    estado.status === "error"
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

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

      {/* Contacto y cuenta de acceso (HU-A-06 criterio 1, prototipo fig. 85):
          el email es obligatorio y con él se crea la cuenta; el teléfono,
          opcional. Mismas reglas de formato que la pantalla de contacto. */}
      <fieldset className="space-y-4 pt-2">
        <legend className="text-lg font-semibold">{texto("ui.profesores.alta.contactoTitulo")}</legend>
        <p className="text-sm text-muted-foreground">{texto("ui.profesores.alta.contactoDescripcion")}</p>

        <div className="space-y-1.5">
          <Label htmlFor="telefono">{texto("ui.profesores.alta.telefono")}</Label>
          <Input
            id="telefono"
            name="telefono"
            type="tel"
            autoComplete="off"
            placeholder="Ej.: (0387) 15-412-3456"
            aria-invalid={!!errorTelefono}
            aria-describedby="telefono-ayuda"
          />
          <p id="telefono-ayuda" className="text-xs text-muted-foreground">
            {texto("ui.profesores.alta.telefonoAyuda")}
          </p>
          {errorTelefono && (
            <p className="text-sm text-destructive" role="alert">
              {errorTelefono}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            {texto("ui.profesores.alta.email")} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            aria-invalid={!!errorEmail}
            aria-describedby="email-ayuda"
          />
          <p id="email-ayuda" className="text-xs text-muted-foreground">
            {texto("ui.profesores.alta.emailAyuda")}
          </p>
          {errorEmail && (
            <p className="text-sm text-destructive" role="alert">
              {errorEmail}
            </p>
          )}
        </div>
      </fieldset>

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

      <ConfirmarAccionDialog
        abierto={pendienteDeConfirmar !== null}
        titulo={texto("ui.profesores.alta.confirmacionTitulo")}
        detalle={texto("ui.profesores.alta.confirmacionDetalle", { email: pendienteDeConfirmar?.email ?? "" })}
        textoConfirmar={texto("ui.profesores.alta.confirmar")}
        onConfirmar={confirmarAlta}
        onCerrar={() => setPendienteDeConfirmar(null)}
      />

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
