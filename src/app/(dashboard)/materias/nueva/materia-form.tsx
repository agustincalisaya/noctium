"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrearMateriaSchema } from "@/server/materias/materia.schema";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { crearMateria } from "@/server/materias/actions";
import { ESTADO_INICIAL, type EstadoMateria } from "@/types/materia.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

export function MateriaForm({
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
  const [estado, setEstado] = useState<EstadoMateria>(ESTADO_INICIAL);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<{ nombre?: string; codigo?: string }>({});
  const nombreRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  function handleChange() {
    const nombre = nombreRef.current?.value.trim() ?? "";
    const codigo = codigoRef.current?.value.trim() ?? "";
    const hayCambios = Boolean(nombre || codigo);
    setDirty(hayCambios);
    onCambios?.(hayCambios);
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
    onGuardando?.(true);

    try {
      const resultado = await crearMateria(estado, formData);
      if (resultado.status === "ok") {
        setDirty(false);
        onCambios?.(false);
        if (onCreada) onCreada();
        else router.push("/materias?creada=1");
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
        codigo: String(formData.get("codigo") ?? ""),
      });
    } finally {
      setPendiente(false);
      onGuardando?.(false);
    }
  }

  function handleCancelar() {
    if (onCancelar) onCancelar();
    else confirmarSalida(() => router.push("/materias"));
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

  const nombreDefault = "nombre" in estado ? estado.nombre : "";
  const codigoDefault = "codigo" in estado ? estado.codigo : "";

  return (
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            ref={nombreRef}
            id="nombre"
            name="nombre"
            defaultValue={nombreDefault}
            onChange={handleChange}
            aria-invalid={!!errorNombre}
            aria-describedby="materia-nombre-ayuda"
            placeholder="Ej: Matemática"
            className="h-11 bg-card"
          />
          <p id="materia-nombre-ayuda" className="text-xs text-muted-foreground">Entre 2 y 80 caracteres.</p>
          {errorNombre && (
            <p className="text-sm text-destructive" role="alert">
              {errorNombre}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="codigo">Código (opcional)</Label>
          <Input
            ref={codigoRef}
            id="codigo"
            name="codigo"
            defaultValue={codigoDefault}
            onChange={handleChange}
            aria-invalid={!!errorCodigo}
            aria-describedby="materia-codigo-ayuda"
            placeholder="Ej: MAT101"
            className="h-11 bg-card"
          />
          <p id="materia-codigo-ayuda" className="text-xs text-muted-foreground">
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

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar materia"}
          </Button>
        </div>
      </form>
  );
}
