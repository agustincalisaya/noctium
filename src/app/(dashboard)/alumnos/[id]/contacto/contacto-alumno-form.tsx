"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { ContactoAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { actualizarContactoAlumno } from "@/server/alumnos/actions";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Datos de contacto del alumno guardados correctamente";

type ContactoAlumnoFormProps = {
  alumnoId: string;
  /** Contacto actual, para precargar el formulario (null = sin cargar). */
  telefonoActual: string | null;
  emailActual: string | null;
};

type ExitoContacto = { telefono: string | null; email: string | null };

/**
 * Formulario de contacto del alumno (HU-B-02). Mismo patrón que
 * `ContactoProfesorForm` (HU-D-02): valida con el mismo schema que el
 * servidor, invoca la action directamente dentro de un try/catch, y los
 * campos no son controlados — ante un error lo tipeado queda cargado tal
 * cual. Diferencia deliberada: la action devuelve `{ data, error }`
 * genérico (RULES.md Regla N.° 5), no un `status` discriminado — acá no
 * está ligada a `useActionState`.
 */
export function ContactoAlumnoForm({
  alumnoId,
  telefonoActual,
  emailActual,
}: ContactoAlumnoFormProps) {
  const [exito, setExito] = useState<ExitoContacto | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [errores, setErrores] = useState<{ telefono?: string; email?: string }>({});
  const [errorGeneral, setErrorGeneral] = useState<string | undefined>();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const rutaFicha = `/alumnos/${alumnoId}`;

  useEffect(() => {
    telefonoRef.current?.focus();
    // Mismo criterio que ContactoProfesorForm: el dirty flag no queda pegado
    // si se sale por otro camino que no sea cancelar/guardar.
    return () => setDirty(false);
  }, [setDirty]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = ContactoAlumnoSchema.safeParse({
      telefono: formData.get("telefono"),
      email: formData.get("email"),
    });

    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      const erroresCliente = { telefono: campos.telefono?.[0], email: campos.email?.[0] };
      setErrores(erroresCliente);
      setErrorGeneral(undefined);
      enfocarPrimerCampoInvalido(form, erroresCliente);
      return; // sin guardado parcial: no se envía nada al servidor
    }
    setErrores({});
    setErrorGeneral(undefined);
    setPendiente(true);

    try {
      const resultado = await actualizarContactoAlumno(alumnoId, formData);

      if (!resultado.error) {
        setDirty(false);
        setExito(resultado.data);
        return;
      }

      if (resultado.error.code === "VALIDACION") {
        const detalles = resultado.error.detalles as
          | { fieldErrors?: Record<string, string[] | undefined> }
          | undefined;
        const campos = detalles?.fieldErrors ?? {};
        const erroresServidor = { telefono: campos.telefono?.[0], email: campos.email?.[0] };
        setErrores(erroresServidor);
        enfocarPrimerCampoInvalido(form, erroresServidor);
      } else if (resultado.error.code === "EMAIL_YA_ASOCIADO") {
        // Se pinta junto al campo email, igual que un error de formato (c6).
        setErrores({ email: resultado.error.message });
        enfocarPrimerCampoInvalido(form, { email: resultado.error.message });
      } else {
        // SESION_INVALIDA / SIN_PERMISO / ALUMNO_NO_ENCONTRADO / cualquier
        // otro código: mensaje genérico, ya viene sin detalle técnico.
        setErrorGeneral(resultado.error.message);
      }
    } catch {
      setErrorGeneral(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setPendiente(false);
    }
  }

  function handleCancelar() {
    if (dirty) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push(rutaFicha);
  }

  if (exito) {
    return (
      <div className="space-y-4" role="status">
        <p className="rounded-md bg-success px-3 py-2 text-sm font-medium text-success-foreground">
          {MENSAJE_EXITO}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Teléfono</dt>
            <dd className="break-words font-medium">{exito.telefono ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="break-words font-medium">{exito.email ?? "—"}</dd>
          </div>
        </dl>
        <Link href={rutaFicha} className={buttonVariants({ variant: "default" })}>
          Volver a la ficha
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setDirty(true)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">Completá al menos uno de los dos datos.</p>

      <div className="space-y-1.5">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          ref={telefonoRef}
          id="telefono"
          name="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          defaultValue={telefonoActual ?? ""}
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
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          defaultValue={emailActual ?? ""}
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

      {errorGeneral && (
        <p className="text-sm text-destructive" role="alert">
          {errorGeneral}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Guardar contacto
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
          router.push(rutaFicha);
        }}
      />
    </form>
  );
}
