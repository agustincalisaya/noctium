"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { rutaTrasGuardar } from "@/lib/modo-edicion";
import { ModificarAulaSchema } from "@/server/aulas/aula.schema";
import { modificarAula } from "@/server/aulas/actions";
import type { DetalleAula } from "@/types/aula.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

type CamposError = { nombre?: string; capacidad?: string };

/**
 * Misma normalización que `ModificarAulaSchema` (trim y espacios internos
 * colapsados), para decidir si hay cambios reales: "Guardar cambios" queda
 * deshabilitado mientras el valor normalizado coincida con el guardado.
 */
function normalizarNombre(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}

/**
 * Modo edición de la ficha de aula (HU-K-03, mockup 21): mismos campos,
 * textos de ayuda y reglas que el alta (HU-K-01, criterio 1). Sin estado
 * activo/inactivo (criterio 5, HU-K-04).
 */
export function EditarAulaForm({ aula }: { aula: DetalleAula }) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const rutaFicha = `/aulas/${aula.id}`;

  const [nombre, setNombre] = useState(aula.nombre);
  const [capacidad, setCapacidad] = useState(String(aula.capacidad));
  const [errores, setErrores] = useState<CamposError>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const [conflicto, setConflicto] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const nombreCambio = normalizarNombre(nombre) !== aula.nombre;
  const capacidadCambio = capacidad.trim() !== String(aula.capacidad);
  const hayCambios = nombreCambio || capacidadCambio;

  useEffect(() => {
    setDirty(hayCambios);
  }, [hayCambios, setDirty]);

  useEffect(() => () => setDirty(false), [setDirty]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || !hayCambios) return;

    // Solo viaja lo que cambió (semántica de PATCH: ausente = no se modifica).
    const payload: { nombre?: string; capacidad?: string; version: number } = { version: aula.version };
    if (nombreCambio) payload.nombre = nombre;
    if (capacidadCambio) payload.capacidad = capacidad;

    const parsed = ModificarAulaSchema.safeParse(payload);
    if (!parsed.success) {
      const campos = parsed.error.flatten().fieldErrors;
      setErrores({ nombre: campos.nombre?.[0], capacidad: campos.capacidad?.[0] });
      setErrorGeneral(undefined);
      return;
    }
    setErrores({});
    setErrorGeneral(undefined);
    setConflicto(false);
    setPendiente(true);

    const formData = new FormData();
    formData.append("version", String(aula.version));
    if (payload.nombre !== undefined) formData.append("nombre", payload.nombre);
    if (payload.capacidad !== undefined) formData.append("capacidad", payload.capacidad);

    try {
      const resultado = await modificarAula(aula.id, formData);

      if (!resultado.error) {
        setDirty(false);
        router.replace(rutaTrasGuardar(rutaFicha));
        return;
      }

      const { code, message, detalles } = resultado.error;
      if (code === "VALIDACION") {
        const campos =
          (detalles as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors ?? {};
        setErrores({ nombre: campos.nombre?.[0], capacidad: campos.capacidad?.[0] });
      } else if (code === "NOMBRE_DUPLICADO") {
        setErrores({ nombre: message });
      } else if (code === "CAPACIDAD_MENOR_A_INSCRIPTOS") {
        // Criterio 2: no se guardó nada; se conserva lo tipeado.
        setErrores({ capacidad: message });
      } else {
        // CONFLICTO_EDICION_CONCURRENTE / AULA_NO_ENCONTRADA /
        // SESION_INVALIDA / SIN_PERMISO: mensaje general, sin reintento
        // automático — ante un conflicto el usuario recarga los datos.
        setConflicto(code === "CONFLICTO_EDICION_CONCURRENTE");
        setErrorGeneral(message);
      }
    } catch {
      setErrorGeneral(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setPendiente(false);
    }
  }

  function volverAConsulta() {
    setDirty(false);
    router.push(rutaFicha);
  }

  function handleCancelar() {
    if (hayCambios) {
      setConfirmandoCancelar(true);
      return;
    }
    volverAConsulta();
  }

  function handleRecargar() {
    // Descarta lo tipeado: el `key={version}` de la página remonta el
    // formulario con los datos actuales.
    setDirty(false);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{aula.nombre}</h1>
            <Badge variant="warning">Editando</Badge>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!hayCambios || pendiente}>
              {pendiente ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </header>

        {errorGeneral && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
            <p>{errorGeneral}</p>
            {conflicto && (
              <Button type="button" variant="outline" size="sm" onClick={handleRecargar}>
                Recargar
              </Button>
            )}
          </div>
        )}

        <section className="space-y-4 rounded-md border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-foreground">Datos del aula</h2>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre o número</Label>
            <Input
              id="nombre"
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              aria-invalid={!!errores.nombre}
              placeholder="Ej: Aula 3"
            />
            <p className="text-xs text-muted-foreground">Entre 1 y 30 caracteres.</p>
            {errores.nombre && (
              <p className="text-sm text-destructive" role="alert">
                {errores.nombre}
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
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              aria-invalid={!!errores.capacidad}
              placeholder="Ej: 25"
            />
            <p className="text-xs text-muted-foreground">Número entero mayor a cero.</p>
            {errores.capacidad && (
              <p className="text-sm text-destructive" role="alert">
                {errores.capacidad}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Guardar se habilita cuando hay cambios. No se puede repetir el nombre de otra aula.
          </p>
        </section>
      </form>

      <ConfirmarDescarteDialog
        abierto={confirmandoCancelar}
        onAbiertoChange={setConfirmandoCancelar}
        onConfirmar={volverAConsulta}
      />
    </>
  );
}
