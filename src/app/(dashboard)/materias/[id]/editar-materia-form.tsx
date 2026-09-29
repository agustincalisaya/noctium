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
import { ModificarMateriaSchema } from "@/server/materias/materia.schema";
import { modificarMateria } from "@/server/materias/actions";
import type { DetalleMateria } from "@/types/materia.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

type CamposError = { nombre?: string; codigo?: string };

/**
 * Misma normalización que `ModificarMateriaSchema` (trim, espacios internos
 * colapsados, código en mayúsculas, vacío = sin código), para decidir si hay
 * cambios reales: "Guardar cambios" queda deshabilitado mientras el valor
 * normalizado coincida con el guardado (HU-L-03 criterio 3).
 */
function normalizarNombre(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}
function normalizarCodigo(valor: string): string | null {
  const limpio = valor.trim().toUpperCase();
  return limpio === "" ? null : limpio;
}

/**
 * Modo edición de la ficha de materia (HU-L-03, mockup 20): datos editables
 * a la izquierda y profesores que la dictan en solo lectura a la derecha
 * (mismos datos de `obtenerMateriaPorId()`, HU-L-02). Sin estado
 * activo/inactivo ni duración (criterio 5).
 */
export function EditarMateriaForm({ materia }: { materia: DetalleMateria }) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const rutaFicha = `/materias/${materia.id}`;

  const [nombre, setNombre] = useState(materia.nombre);
  const [codigo, setCodigo] = useState(materia.codigo ?? "");
  const [errores, setErrores] = useState<CamposError>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const [conflicto, setConflicto] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const nombreCambio = normalizarNombre(nombre) !== materia.nombre;
  const codigoCambio = normalizarCodigo(codigo) !== materia.codigo;
  const hayCambios = nombreCambio || codigoCambio;

  useEffect(() => {
    setDirty(hayCambios);
  }, [hayCambios, setDirty]);

  useEffect(() => () => setDirty(false), [setDirty]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || !hayCambios) return;

    // Solo viaja lo que cambió (semántica de PATCH: ausente = no se modifica).
    const payload: { nombre?: string; codigo?: string; version: number } = { version: materia.version };
    if (nombreCambio) payload.nombre = nombre;
    if (codigoCambio) payload.codigo = codigo;

    const parsed = ModificarMateriaSchema.safeParse(payload);
    if (!parsed.success) {
      const campos = parsed.error.flatten().fieldErrors;
      setErrores({ nombre: campos.nombre?.[0], codigo: campos.codigo?.[0] });
      setErrorGeneral(undefined);
      return;
    }
    setErrores({});
    setErrorGeneral(undefined);
    setConflicto(false);
    setPendiente(true);

    const formData = new FormData();
    formData.append("version", String(materia.version));
    if (payload.nombre !== undefined) formData.append("nombre", payload.nombre);
    if (payload.codigo !== undefined) formData.append("codigo", payload.codigo);

    try {
      const resultado = await modificarMateria(materia.id, formData);

      if (!resultado.error) {
        setDirty(false);
        router.replace(rutaTrasGuardar(rutaFicha));
        return;
      }

      const { code, message, detalles } = resultado.error;
      if (code === "VALIDACION") {
        const campos =
          (detalles as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors ?? {};
        setErrores({ nombre: campos.nombre?.[0], codigo: campos.codigo?.[0] });
      } else if (code === "NOMBRE_DUPLICADO") {
        setErrores({ nombre: message });
      } else if (code === "CODIGO_DUPLICADO") {
        setErrores({ codigo: message });
      } else {
        // CONFLICTO_EDICION_CONCURRENTE / MATERIA_NO_ENCONTRADA /
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
            <h1 className="text-2xl font-semibold text-foreground">{materia.nombre}</h1>
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

        <div className="grid gap-5 md:grid-cols-2">
          <section className="space-y-4 rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-medium text-foreground">Datos de la materia</h2>

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                aria-invalid={!!errores.nombre}
              />
              {errores.nombre && (
                <p className="text-sm text-destructive" role="alert">
                  {errores.nombre}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                name="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                aria-invalid={!!errores.codigo}
                placeholder="Ej: MAT101"
              />
              {errores.codigo && (
                <p className="text-sm text-destructive" role="alert">
                  {errores.codigo}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Guardar se habilita cuando hay cambios. No se puede repetir el nombre ni el código de otra materia.
            </p>
          </section>

          <section className="space-y-3 rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-medium text-foreground">Profesores que la dictan</h2>
            {materia.profesores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin profesores asociados</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {materia.profesores.map((profesor) => (
                  <li key={profesor.id}>
                    <Badge variant="outline">{profesor.nombre_completo}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Mesa de Entradas las asigna desde la ficha de cada profesor.
            </p>
          </section>
        </div>
      </form>

      <ConfirmarDescarteDialog
        abierto={confirmandoCancelar}
        onAbiertoChange={setConfirmandoCancelar}
        onConfirmar={volverAConsulta}
      />
    </>
  );
}
