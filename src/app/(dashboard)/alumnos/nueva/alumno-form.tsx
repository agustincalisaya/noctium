"use client";

import { useMemo, useRef, useState, useEffect, type FormEvent } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { flattenError } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ContactoAlumnoSchema, crearIdentidadAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { actualizarContactoAlumno, crearAlumno } from "@/server/alumnos/actions";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

/**
 * Destino tras el alta. Si se cargó contacto y no se pudo guardar, el alta
 * ya existe y no se revierte: el listado avisa y enlaza al formulario de
 * contacto de ese alumno (`alumnos/page.tsx`, `sin_contacto`/`motivo`).
 */
function rutaTrasAlta(alumnoId: string, contacto: "sin_cargar" | "guardado" | { error: string }) {
  if (contacto === "sin_cargar" || contacto === "guardado") return "/alumnos?creada=1";
  const motivo = contacto.error === "EMAIL_YA_ASOCIADO" ? "&motivo=email_ya_asociado" : "";
  return `/alumnos?creada=1&sin_contacto=${encodeURIComponent(alumnoId)}${motivo}`;
}

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

  const nombreRef = useRef<HTMLInputElement>(null);
  const apellidoRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const generoRef = useRef<HTMLSelectElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Mismos schemas que vuelven a aplicar crearAlumno() y
  // actualizarContactoAlumno() en el servidor: se valida todo antes del alta
  // para no crear el alumno con un contacto que después sería rechazado.
  const identidadSchema = useMemo(
    () => crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax),
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;

    const formData = new FormData(e.currentTarget);
    const generoIngresado = String(formData.get("genero") ?? "");
    const identidad = {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      genero: generoIngresado === "" ? undefined : generoIngresado,
    };
    const telefono = String(formData.get("telefono") ?? "");
    const email = String(formData.get("email") ?? "");
    // Contacto opcional: sin ninguno de los dos no se valida ni se envía
    // (ContactoAlumnoSchema exige "al menos uno", regla de la pantalla de contacto).
    const conContacto = telefono.trim() !== "" || email.trim() !== "";

    const identidadParseada = identidadSchema.safeParse(identidad);
    const contactoParseado = conContacto ? ContactoAlumnoSchema.safeParse({ telefono, email }) : null;
    if (!identidadParseada.success || (contactoParseado && !contactoParseado.success)) {
      const campos: Record<string, string[] | undefined> = {
        ...(identidadParseada.success ? {} : flattenError(identidadParseada.error).fieldErrors),
        ...(contactoParseado && !contactoParseado.success ? flattenError(contactoParseado.error).fieldErrors : {}),
      };
      const camposConError: CamposError = {
        nombre: campos.nombre?.[0],
        apellido: campos.apellido?.[0],
        dni: campos.dni?.[0],
        fecha_nacimiento: campos.fecha_nacimiento?.[0],
        genero: campos.genero?.[0],
        telefono: campos.telefono?.[0],
        email: campos.email?.[0],
      };
      setErrores(camposConError);
      setErrorGeneral(undefined);
      enfocarPrimerCampoInvalido(camposConError);
      return; // sin alta parcial: no se envía nada al servidor
    }

    setErrores({});
    setErrorGeneral(undefined);
    setPendiente(true);

    try {
      const resultado = await crearAlumno(identidad);

      if (!resultado.error) {
        // Alta confirmada. El contacto se guarda con su propia action
        // (HU-B-02); si falla, el alumno ya existe y no se revierte.
        let contacto: Parameters<typeof rutaTrasAlta>[1] = "sin_cargar";
        if (conContacto) {
          const datosContacto = new FormData();
          datosContacto.set("telefono", telefono);
          datosContacto.set("email", email);
          try {
            const guardado = await actualizarContactoAlumno(resultado.data.id, datosContacto);
            contacto = guardado.error ? { error: guardado.error.code } : "guardado";
          } catch (error) {
            unstable_rethrow(error);
            contacto = { error: "ERROR_COMUNICACION" };
          }
        }
        setDirty(false);
        router.push(rutaTrasAlta(resultado.data.id, contacto));
        return;
      }

      if (resultado.error.code === "VALIDACION") {
        const detalles = resultado.error.detalles as
          | { fieldErrors?: Record<string, string[] | undefined> }
          | undefined;
        const campos = detalles?.fieldErrors ?? {};
        const camposConError: CamposError = {
          nombre: campos.nombre?.[0],
          apellido: campos.apellido?.[0],
          dni: campos.dni?.[0],
          fecha_nacimiento: campos.fecha_nacimiento?.[0],
          genero: campos.genero?.[0],
        };
        setErrores(camposConError);
        enfocarPrimerCampoInvalido(camposConError);
      } else if (resultado.error.code === "DNI_DUPLICADO") {
        setErrores({ dni: resultado.error.message });
        dniRef.current?.focus();
      } else {
        // SESION_INVALIDA / SIN_PERMISO / cualquier otro código: mensaje
        // genérico, ya viene sin detalle técnico desde el servicio.
        setErrorGeneral(resultado.error.message);
      }
    } catch (error) {
      unstable_rethrow(error);
      setErrorGeneral(MENSAJE_ERROR_COMUNICACION);
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

        {/* Contacto opcional (HU-B-02 dentro del alta, mismo patrón visual que
            nuevo-profesor-form.tsx): vacío = alta solo de identidad; si se
            completa, mismas reglas que la pantalla de contacto. */}
        <fieldset className="space-y-4 pt-2">
          <legend className="text-lg font-semibold">Datos de contacto</legend>
          <p className="text-sm text-muted-foreground">
            Opcional. Podés cargarlos ahora o más tarde desde la ficha.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
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
              aria-describedby={errores.telefono ? "telefono-error" : undefined}
            />
            {errores.telefono && (
              <p id="telefono-error" className="text-sm text-destructive" role="alert">
                {errores.telefono}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              onChange={handleChange}
              placeholder="Ej.: nombre@dominio.com"
              aria-invalid={!!errores.email}
              aria-describedby={errores.email ? "email-error" : undefined}
            />
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
