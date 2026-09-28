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

export function AulaForm({
  onCancelar,
  onCreada,
  onCambios,
  onGuardando,
}: {
  onCancelar?: () => void;
  onCreada?: () => void;
  onCambios?: (hayCambios: boolean) => void;
  onGuardando?: (guardando: boolean) => void;
} = {}) {
  const router = useRouter();
  const { setDirty, confirmarSalida } = useDirtyState();
  const [estado, setEstado] = useState<EstadoAula>(ESTADO_INICIAL);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<{ nombre?: string; capacidad?: string }>({});
  const nombreRef = useRef<HTMLInputElement>(null);
  const capacidadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  function handleChange() {
    const nombre = nombreRef.current?.value.trim() ?? "";
    const capacidad = capacidadRef.current?.value.trim() ?? "";
    const hayCambios = Boolean(nombre || capacidad);
    setDirty(hayCambios);
    onCambios?.(hayCambios);
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
    onGuardando?.(true);

    try {
      const resultado = await crearAula(estado, formData);
      if (resultado.status === "ok") {
        setDirty(false);
        onCambios?.(false);
        if (onCreada) onCreada();
        else router.push("/aulas?creada=1");
        return;
      }
      setEstado(resultado);
    } catch (error) {
      // Propagar las señales de control de Next.js antes de tratar cualquier
      // otro error como falla de comunicación.
      unstable_rethrow(error);
      setEstado({
        status: "error_comunicacion",
        nombre: String(formData.get("nombre") ?? ""),
        capacidad: String(formData.get("capacidad") ?? ""),
      });
    } finally {
      setPendiente(false);
      onGuardando?.(false);
    }
  }

  function handleCancelar() {
    if (onCancelar) onCancelar();
    else confirmarSalida(() => router.push("/aulas"));
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

  const nombreDefault = "nombre" in estado ? estado.nombre : "";
  const capacidadDefault = "capacidad" in estado ? estado.capacidad : "";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre o número</Label>
        <Input
          ref={nombreRef}
          id="nombre"
          name="nombre"
          defaultValue={nombreDefault}
          onChange={handleChange}
          aria-invalid={!!errorNombre}
          aria-describedby="nombre-ayuda"
          placeholder="Ej: Aula 3"
          className="h-11 bg-card"
        />
        <p id="nombre-ayuda" className="text-xs text-muted-foreground">Entre 1 y 30 caracteres.</p>
        {errorNombre && (
          <p className="text-sm text-destructive" role="alert">
            {errorNombre}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacidad">Capacidad</Label>
        <Input
          ref={capacidadRef}
          id="capacidad"
          name="capacidad"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          defaultValue={capacidadDefault}
          onChange={handleChange}
          aria-invalid={!!errorCapacidad}
          aria-describedby="capacidad-ayuda"
          placeholder="Ej: 25"
          className="h-11 bg-card"
        />
        <p id="capacidad-ayuda" className="text-xs text-muted-foreground">Número entero mayor a cero.</p>
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

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Registrar aula"}
        </Button>
      </div>
    </form>
  );
}
