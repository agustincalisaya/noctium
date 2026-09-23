"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { actualizarFormaPagoPreferida } from "@/server/alumnos/actions";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Forma de pago preferida actualizada";

type FormaPagoActiva = { id: string; nombre: string };

type FormaPagoFormProps = {
  alumnoId: string;
  formasPagoActivas: FormaPagoActiva[];
  /** Id de la forma de pago preferida actual (`null` = "Sin preferencia"). */
  formaPagoIdActual: string | null;
};

/**
 * Formulario de forma de pago preferida (HU-B-03). Mismo patrón que
 * `ContactoAlumnoForm` (HU-B-02): valida en el servidor vía la Server
 * Action (que ya hace la conversión `"" -> null`), formulario no
 * controlado, `DirtyStateContext`/`ConfirmarDescarteDialog` para "Cancelar"
 * con cambios sin guardar.
 */
export function FormaPagoForm({ alumnoId, formasPagoActivas, formaPagoIdActual }: FormaPagoFormProps) {
  const [exito, setExito] = useState<{ nombre: string | null } | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | undefined>();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const rutaFicha = `/alumnos/${alumnoId}`;

  useEffect(() => {
    selectRef.current?.focus();
    return () => setDirty(false);
  }, [setDirty]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    setErrorGeneral(undefined);
    setPendiente(true);

    try {
      const formData = new FormData(e.currentTarget);
      const resultado = await actualizarFormaPagoPreferida(alumnoId, formData);

      if (!resultado.error) {
        setDirty(false);
        const seleccionada = formasPagoActivas.find((fp) => fp.id === resultado.data.forma_pago_preferida_id);
        setExito({ nombre: seleccionada?.nombre ?? null });
        return;
      }

      // SESION_INVALIDA / SIN_PERMISO / ALUMNO_NO_ENCONTRADO /
      // FORMA_PAGO_NO_DISPONIBLE (criterio 6) / cualquier otro código:
      // mensaje general, ya viene sin detalle técnico.
      setErrorGeneral(resultado.error.message);
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
        <p className="text-sm text-muted-foreground">
          Forma de pago preferida: <span className="font-medium text-foreground">{exito.nombre ?? "Sin preferencia"}</span>
        </p>
        <Link href={rutaFicha} className={buttonVariants({ variant: "default" })}>
          Volver a la ficha
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setDirty(true)} noValidate className="space-y-4">
      {formasPagoActivas.length === 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          No hay formas de pago disponibles. Podés continuar sin preferencia.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="forma_pago_id">Forma de pago preferida</Label>
        <select
          ref={selectRef}
          id="forma_pago_id"
          name="forma_pago_id"
          defaultValue={formaPagoIdActual ?? ""}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <option value="">Sin preferencia</option>
          {formasPagoActivas.map((fp) => (
            <option key={fp.id} value={fp.id}>
              {fp.nombre}
            </option>
          ))}
        </select>
      </div>

      {errorGeneral && (
        <p className="text-sm text-destructive" role="alert">
          {errorGeneral}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pendiente}>
          {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Guardar
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
