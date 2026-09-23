"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrearMateriaSchema } from "@/server/materias/materia.schema";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { crearMateria } from "@/server/materias/actions";
import { ESTADO_INICIAL, type EstadoMateria } from "@/types/materia.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

export function MateriaForm() {
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const [estado, setEstado] = useState<EstadoMateria>(ESTADO_INICIAL);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<{ nombre?: string; codigo?: string }>({});
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  function handleChange() {
    const nombre = nombreRef.current?.value.trim() ?? "";
    if (nombre) setDirty(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;

    const formData = new FormData(e.currentTarget);
    const parsed = CrearMateriaSchema.safeParse({
      nombre: formData.get("nombre"),
      codigo: formData.get("codigo"),
    });

    if (!parsed.success) {
      const campos = parsed.error.flatten().fieldErrors;
      setErroresCliente({ nombre: campos.nombre?.[0], codigo: campos.codigo?.[0] });
      return;
    }
    setErroresCliente({});
    setPendiente(true);

    try {
      const resultado = await crearMateria(estado, formData);
      setEstado(resultado);
    } catch (error) {
      // El redirect() de la action en el caso exitoso se propaga como señal
      // de control de Next.js, no como un error real — se deja pasar antes
      // de tratar cualquier otro throw como falla de comunicación.
      unstable_rethrow(error);
      setEstado({
        status: "error_comunicacion",
        nombre: String(formData.get("nombre") ?? ""),
        codigo: String(formData.get("codigo") ?? ""),
      });
    } finally {
      setPendiente(false);
    }
  }

  function handleCancelar() {
    if (dirty) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push("/materias");
  }

  const errorNombre =
    erroresCliente.nombre ??
    (estado.status === "error_validacion" ? estado.errores.nombre?.[0] : undefined) ??
    (estado.status === "error" && estado.campo === "nombre" ? estado.mensaje : undefined);
  const errorCodigo =
    erroresCliente.codigo ??
    (estado.status === "error_validacion" ? estado.errores.codigo?.[0] : undefined) ??
    (estado.status === "error" && estado.campo === "codigo" ? estado.mensaje : undefined);
  const errorGeneral =
    estado.status === "error" && estado.campo === null
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

  const nombreDefault = estado.status !== "idle" ? estado.nombre : "";
  const codigoDefault = estado.status !== "idle" ? estado.codigo : "";

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            ref={nombreRef}
            id="nombre"
            name="nombre"
            defaultValue={nombreDefault}
            onChange={handleChange}
            aria-invalid={!!errorNombre}
            placeholder="Ej: Matemática"
          />
          <p className="text-xs text-muted-foreground">Entre 2 y 80 caracteres.</p>
          {errorNombre && (
            <p className="text-sm text-destructive" role="alert">
              {errorNombre}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="codigo">Código (opcional)</Label>
          <Input
            id="codigo"
            name="codigo"
            defaultValue={codigoDefault}
            onChange={handleChange}
            aria-invalid={!!errorCodigo}
            placeholder="Ej: MAT101"
          />
          <p className="text-xs text-muted-foreground">
            Letras y números, sin espacios, hasta 10 caracteres. Se guarda en mayúsculas.
          </p>
          {errorCodigo && (
            <p className="text-sm text-destructive" role="alert">
              {errorCodigo}
            </p>
          )}
        </div>

        {errorGeneral && (
          <p className="text-sm text-destructive" role="alert">
            {errorGeneral}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar materia"}
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
                  router.push("/materias");
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
