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
import { ContactoProfesorSchema } from "@/server/profesores/profesor.schema";
import { actualizarContactoProfesor } from "../../actions";
import {
  ESTADO_INICIAL_CONTACTO_PROFESOR,
  type EstadoContactoProfesor,
} from "../../profesor.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Datos de contacto del profesor guardados correctamente";

type ContactoProfesorFormProps = {
  profesorId: string;
  /** Contacto actual, para precargar el formulario (null = sin cargar). */
  telefonoActual: string | null;
  emailActual: string | null;
};

/**
 * Formulario de contacto del profesor (HU-D-02). Mismo patrón que
 * `NuevoProfesorForm` (HU-D-01): valida con el mismo schema que el servidor,
 * invoca la action directamente dentro de un try/catch, y los campos no son
 * controlados — ante un error lo tipeado queda cargado tal cual.
 */
export function ContactoProfesorForm({
  profesorId,
  telefonoActual,
  emailActual,
}: ContactoProfesorFormProps) {
  const [estado, setEstado] = useState<EstadoContactoProfesor>(ESTADO_INICIAL_CONTACTO_PROFESOR);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<Record<string, string | undefined>>({});
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const rutaFicha = `/profesores/${profesorId}`;

  useEffect(() => {
    telefonoRef.current?.focus();
    // Mismo criterio que NuevoProfesorForm: el dirty flag no queda pegado si
    // se sale por otro camino que no sea cancelar/guardar.
    return () => setDirty(false);
  }, [setDirty]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = ContactoProfesorSchema.safeParse({
      telefono: formData.get("telefono"),
      email: formData.get("email"),
    });

    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      const errores = { telefono: campos.telefono?.[0], email: campos.email?.[0] };
      setErroresCliente(errores);
      setEstado(ESTADO_INICIAL_CONTACTO_PROFESOR);
      enfocarPrimerCampoInvalido(form, errores);
      return; // sin guardado parcial: no se envía nada al servidor
    }
    setErroresCliente({});
    setPendiente(true);

    try {
      const resultado = await actualizarContactoProfesor(profesorId, formData);
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

  function handleCancelar() {
    if (dirty) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push(rutaFicha);
  }

  const erroresServidor = estado.status === "error_validacion" ? estado.errores : {};
  const errorTelefono = erroresCliente.telefono ?? erroresServidor.telefono?.[0];
  const errorEmail = erroresCliente.email ?? erroresServidor.email?.[0];
  const mensajeError =
    estado.status === "error"
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

  if (estado.status === "exito") {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm font-medium">{MENSAJE_EXITO}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Teléfono</dt>
            <dd className="break-words font-medium">{estado.telefono ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="break-words font-medium">{estado.email ?? "—"}</dd>
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
          aria-invalid={!!errorTelefono}
          aria-describedby={errorTelefono ? "telefono-error" : undefined}
        />
        {errorTelefono && (
          <p id="telefono-error" className="text-sm text-destructive" role="alert">
            {errorTelefono}
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
          aria-invalid={!!errorEmail}
          aria-describedby={errorEmail ? "email-error" : undefined}
        />
        {errorEmail && (
          <p id="email-error" className="text-sm text-destructive" role="alert">
            {errorEmail}
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
