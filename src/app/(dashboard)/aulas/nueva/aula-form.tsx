"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrearAulaSchema } from "@/server/aulas/aula.schema";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { crearAula } from "@/server/aulas/actions";
import { ESTADO_INICIAL, type EstadoAula } from "@/types/aula.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

export function AulaForm() {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const [estado, setEstado] = useState<EstadoAula>(ESTADO_INICIAL);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<{ nombre?: string; capacidad?: string }>({});
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
    const parsed = CrearAulaSchema.safeParse({
      nombre: formData.get("nombre"),
      capacidad: formData.get("capacidad"),
    });

    if (!parsed.success) {
      const campos = parsed.error.flatten().fieldErrors;
      setErroresCliente({ nombre: campos.nombre?.[0], capacidad: campos.capacidad?.[0] });
      return;
    }
    setErroresCliente({});
    setPendiente(true);

    try {
      const resultado = await crearAula(estado, formData);
      setEstado(resultado);
    } catch (error) {
      // El redirect() de la action en el caso exitoso se propaga como señal
      // de control de Next.js, no como un error real — se deja pasar antes
      // de tratar cualquier otro throw como falla de comunicación.
      unstable_rethrow(error);
      setEstado({
        status: "error_comunicacion",
        nombre: String(formData.get("nombre") ?? ""),
        capacidad: String(formData.get("capacidad") ?? ""),
      });
    } finally {
      setPendiente(false);
    }
  }

  function handleCancelar() {
    // A diferencia de Materias (HU-L-01), el criterio de aceptación de esta
    // HU ("Cancelar vuelve al listado sin guardar") no exige confirmación
    // condicional — navegación directa (HU-K-01.md §5).
    setDirty(false);
    router.push("/aulas");
  }

  const errorNombre =
    erroresCliente.nombre ??
    (estado.status === "error_validacion" ? estado.errores.nombre?.[0] : undefined) ??
    (estado.status === "error" && estado.campo === "nombre" ? estado.mensaje : undefined);
  const errorCapacidad =
    erroresCliente.capacidad ??
    (estado.status === "error_validacion" ? estado.errores.capacidad?.[0] : undefined) ??
    (estado.status === "error" && estado.campo === "capacidad" ? estado.mensaje : undefined);
  const errorGeneral =
    estado.status === "error" && estado.campo === null
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

  const nombreDefault = estado.status !== "idle" ? estado.nombre : "";
  const capacidadDefault = estado.status !== "idle" ? estado.capacidad : "";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre o número</Label>
        <Input
          ref={nombreRef}
          id="nombre"
          name="nombre"
          defaultValue={nombreDefault}
          onChange={handleChange}
          aria-invalid={!!errorNombre}
          placeholder="Ej: Aula 3"
        />
        <p className="text-xs text-muted-foreground">Entre 1 y 30 caracteres.</p>
        {errorNombre && (
          <p className="text-sm text-destructive" role="alert">
            {errorNombre}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="capacidad">Capacidad</Label>
        <Input
          id="capacidad"
          name="capacidad"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          defaultValue={capacidadDefault}
          onChange={handleChange}
          aria-invalid={!!errorCapacidad}
          placeholder="Ej: 25"
        />
        <p className="text-xs text-muted-foreground">Número entero mayor a cero.</p>
        {errorCapacidad && (
          <p className="text-sm text-destructive" role="alert">
            {errorCapacidad}
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
          {pendiente ? "Guardando..." : "Registrar aula"}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
