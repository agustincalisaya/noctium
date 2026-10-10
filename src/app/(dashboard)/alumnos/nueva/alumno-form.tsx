"use client";

import { useMemo, useRef, useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { flattenError } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { texto } from "@/lib/textos";
import { construirRegistrarAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { crearAlumno } from "@/server/alumnos/actions";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

/**
 * Destino tras el alta con cuenta (HU-A-06): el listado muestra el banner
 * inline con el mensaje de la cuenta (`alumnos/page.tsx`, `cuenta=1`). El
 * aviso `sin_contacto` del listado se conserva para compatibilidad, pero
 * este formulario ya no lo produce: ficha, cuenta y contacto se guardan
 * juntos o no se guarda nada.
 */
const RUTA_TRAS_ALTA = "/alumnos?creada=1&cuenta=1";

const GENEROS = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMENINO", label: "Femenino" },
  { value: "OTRO", label: "Otro" },
  { value: "PREFIERO_NO_INDICARLO", label: "Prefiero no indicarlo" },
] as const;

type CamposError = {
  nombre?: string;
  apellido?: string;
  dni?: string;
  fecha_nacimiento?: string;
  genero?: string;
  telefono?: string;
  email?: string;
};

export function AlumnoForm({
  dniLongitudMin,
  dniLongitudMax,
}: {
  dniLongitudMin: number;
  dniLongitudMax: number;
}) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const [dirtyLocal, setDirtyLocal] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [errores, setErrores] = useState<CamposError>({});
  const [errorGeneral, setErrorGeneral] = useState<string | undefined>();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  // Alta ya validada, a la espera de la confirmación de HU-C-25.
  const [pendienteDeConfirmar, setPendienteDeConfirmar] = useState<Record<string, unknown> | null>(null);

  const nombreRef = useRef<HTMLInputElement>(null);
  const apellidoRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const generoRef = useRef<HTMLSelectElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Mismo schema que vuelve a aplicar crearAlumno() en el servidor
  // (HU-A-06, spec_modulo_B.md §2.9). El email es obligatorio en la pantalla
  // aunque el servidor admita el alta sin él (P-B1).
  const registroSchema = useMemo(
    () => construirRegistrarAlumnoSchema(dniLongitudMin, dniLongitudMax),
    [dniLongitudMin, dniLongitudMax],
  );

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  function handleChange() {
    if (!dirtyLocal) {
      setDirtyLocal(true);
      setDirty(true);
    }
  }

  function enfocarPrimerCampoInvalido(camposConError: CamposError) {
    // Orden fijo (nombre → apellido → DNI → fecha → género → teléfono →
    // email), no el orden en que Zod devolvió las claves — así el foco
    // siempre es predecible.
    if (camposConError.nombre) return nombreRef.current?.focus();
    if (camposConError.apellido) return apellidoRef.current?.focus();
    if (camposConError.dni) return dniRef.current?.focus();
    if (camposConError.fecha_nacimiento) return fechaRef.current?.focus();
    if (camposConError.genero) return generoRef.current?.focus();
    if (camposConError.telefono) return telefonoRef.current?.focus();
    if (camposConError.email) return emailRef.current?.focus();
  }

  function erroresDeCampos(campos: Record<string, string[] | undefined>): CamposError {
    return {
      nombre: campos.nombre?.[0],
      apellido: campos.apellido?.[0],
      dni: campos.dni?.[0],
      fecha_nacimiento: campos.fecha_nacimiento?.[0],
      genero: campos.genero?.[0],
      telefono: campos.telefono?.[0],
      email: campos.email?.[0],
    };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;

    const formData = new FormData(e.currentTarget);
    const generoIngresado = String(formData.get("genero") ?? "");
    const datos = {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      genero: generoIngresado === "" ? undefined : generoIngresado,
      telefono: String(formData.get("telefono") ?? ""),
      email: String(formData.get("email") ?? ""),
    };

    const parseado = registroSchema.safeParse(datos);
    const camposConError: CamposError = parseado.success ? {} : erroresDeCampos(flattenError(parseado.error).fieldErrors);
    // HU-A-06 criterio 1: en la pantalla el email es obligatorio.
    if (datos.email.trim() === "") camposConError.email = texto("ui.alumnos.alta.emailRequerido");
    if (Object.values(camposConError).some(Boolean)) {
      setErrores(camposConError);
      setErrorGeneral(undefined);
      enfocarPrimerCampoInvalido(camposConError);
      return; // sin alta parcial: no se envía nada al servidor
    }

    setErrores({});
    setErrorGeneral(undefined);
    setPendienteDeConfirmar(datos);
  }

  /**
   * Confirmación de HU-C-25: una sola llamada crea la ficha y la cuenta
   * (spec_modulo_B.md §2.9). Un rechazo de un campo cierra el diálogo y se
   * muestra junto al campo (EMAIL_YA_ASOCIADO, sin revelar de quién es); el
   * resto se muestra dentro del diálogo.
   */
  async function confirmarAlta() {
    setPendiente(true);
    try {
      const resultado = await crearAlumno(pendienteDeConfirmar);
      if (!resultado.error) {
        setDirty(false);
        router.push(RUTA_TRAS_ALTA);
        return;
      }
      if (resultado.error.code === "VALIDACION") {
        const detalles = resultado.error.detalles as { fieldErrors?: Record<string, string[] | undefined> } | undefined;
        const camposConError = erroresDeCampos(detalles?.fieldErrors ?? {});
        setErrores(camposConError);
        enfocarPrimerCampoInvalido(camposConError);
        return;
      }
      if (resultado.error.code === "DNI_DUPLICADO" || resultado.error.code === "EMAIL_YA_ASOCIADO") {
        const campo = resultado.error.code === "DNI_DUPLICADO" ? "dni" : "email";
        setErrores({ [campo]: resultado.error.message });
        (campo === "dni" ? dniRef : emailRef).current?.focus();
        return;
      }
      // SESION_INVALIDA / SIN_PERMISO / TRANSACCION_OCUPADA / otro código:
      // se muestra en el diálogo, ya sin detalle técnico.
      throw new Error(resultado.error.message);
    } catch (error) {
      throw error instanceof Error && error.message ? error : new Error(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setPendiente(false);
    }
  }

  function handleCancelar() {
    if (dirtyLocal) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push("/alumnos");
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">
            Nombre <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={nombreRef}
            id="nombre"
            name="nombre"
            required
            maxLength={50}
            onChange={handleChange}
            aria-invalid={!!errores.nombre}
            placeholder="Ej: Ana"
          />
          <p className="text-xs text-muted-foreground">
            Entre 2 y 50 caracteres. Solo letras, espacios, acentos, apóstrofes y guiones.
          </p>
          {errores.nombre && (
            <p className="text-sm text-destructive" role="alert">
              {errores.nombre}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="apellido">
            Apellido <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={apellidoRef}
            id="apellido"
            name="apellido"
            required
            maxLength={50}
            onChange={handleChange}
            aria-invalid={!!errores.apellido}
            placeholder="Ej: Pérez"
          />
          <p className="text-xs text-muted-foreground">
            Entre 2 y 50 caracteres. Solo letras, espacios, acentos, apóstrofes y guiones.
          </p>
          {errores.apellido && (
            <p className="text-sm text-destructive" role="alert">
              {errores.apellido}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dni">
            DNI <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={dniRef}
            id="dni"
            name="dni"
            required
            inputMode="numeric"
            maxLength={dniLongitudMax}
            onChange={handleChange}
            aria-invalid={!!errores.dni}
            placeholder="Ej: 30123456"
          />
          <p className="text-xs text-muted-foreground">
            Solo números, entre {dniLongitudMin} y {dniLongitudMax} dígitos.
          </p>
          {errores.dni && (
            <p className="text-sm text-destructive" role="alert">
              {errores.dni}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fecha_nacimiento">
            Fecha de nacimiento <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={fechaRef}
            id="fecha_nacimiento"
            name="fecha_nacimiento"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            onChange={handleChange}
            aria-invalid={!!errores.fecha_nacimiento}
          />
          <p className="text-xs text-muted-foreground">No puede ser una fecha futura.</p>
          {errores.fecha_nacimiento && (
            <p className="text-sm text-destructive" role="alert">
              {errores.fecha_nacimiento}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="genero">Género</Label>
          <select
            ref={generoRef}
            id="genero"
            name="genero"
            onChange={handleChange}
            aria-invalid={!!errores.genero}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            )}
          >
            <option value="">Sin especificar</option>
            {GENEROS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Opcional.</p>
          {errores.genero && (
            <p className="text-sm text-destructive" role="alert">
              {errores.genero}
            </p>
          )}
        </div>

        {/* Contacto y cuenta de acceso (HU-A-06 criterio 1): el email es
            obligatorio y con él se crea la cuenta; el teléfono, opcional. Mismas
            reglas de formato que la pantalla de contacto (HU-B-02). */}
        <fieldset className="space-y-4 pt-2">
          <legend className="text-lg font-semibold">{texto("ui.alumnos.alta.contactoTitulo")}</legend>
          <p className="text-sm text-muted-foreground">{texto("ui.alumnos.alta.contactoDescripcion")}</p>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">{texto("ui.alumnos.alta.telefono")}</Label>
            <Input
              ref={telefonoRef}
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              onChange={handleChange}
              placeholder="Ej.: (0387) 15-412-3456"
              aria-invalid={!!errores.telefono}
              aria-describedby={errores.telefono ? "telefono-ayuda telefono-error" : "telefono-ayuda"}
            />
            <p id="telefono-ayuda" className="text-xs text-muted-foreground">
              {texto("ui.alumnos.alta.telefonoAyuda")}
            </p>
            {errores.telefono && (
              <p id="telefono-error" className="text-sm text-destructive" role="alert">
                {errores.telefono}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">
              {texto("ui.alumnos.alta.email")} <span aria-hidden="true">*</span>
            </Label>
            <Input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              onChange={handleChange}
              placeholder="Ej.: nombre@dominio.com"
              aria-invalid={!!errores.email}
              required
              aria-describedby={errores.email ? "email-ayuda email-error" : "email-ayuda"}
            />
            <p id="email-ayuda" className="text-xs text-muted-foreground">
              {texto("ui.alumnos.alta.emailAyuda")}
            </p>
            {errores.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errores.email}
              </p>
            )}
          </div>
        </fieldset>

        {errorGeneral && (
          <p className="text-sm text-destructive" role="alert">
            {errorGeneral}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar alumno"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
            Cancelar
          </Button>
        </div>
      </form>

      <ConfirmarAccionDialog
        abierto={pendienteDeConfirmar !== null}
        titulo={texto("ui.alumnos.alta.confirmacionTitulo")}
        detalle={texto("ui.alumnos.alta.confirmacionDetalle", { email: String(pendienteDeConfirmar?.email ?? "").trim().toLowerCase() })}
        textoConfirmar={texto("ui.alumnos.alta.confirmar")}
        onConfirmar={confirmarAlta}
        onCerrar={() => setPendienteDeConfirmar(null)}
      />

      <AlertDialog.Root open={confirmandoCancelar} onOpenChange={setConfirmandoCancelar}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg">
            <AlertDialog.Title className="font-semibold">Datos sin guardar</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              Tenés datos ingresados sin guardar. ¿Querés salir igualmente?
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmandoCancelar(false)}>
                Seguir editando
              </Button>
              <Button
                onClick={() => {
                  setDirty(false);
                  router.push("/alumnos");
                }}
              >
                Salir sin guardar
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
