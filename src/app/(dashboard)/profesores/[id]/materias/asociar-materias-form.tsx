"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { filtrarMaterias } from "@/lib/filtrar-materias";
import { AsociarMateriasProfesorSchema } from "@/server/profesores/profesor.schema";
import { asociarMateriasProfesor } from "@/server/profesores/actions";
import {
  ESTADO_INICIAL_ASOCIAR_MATERIAS,
  type EstadoAsociarMaterias,
  type MateriaDeProfesor,
} from "@/types/profesor.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Materias del profesor actualizadas";

/** Materia del selector: activa del catálogo, o asociada que hoy está inactiva. */
export type OpcionMateria = MateriaDeProfesor & { asociada: boolean };

function etiquetaMateria({ nombre, codigo }: { nombre: string; codigo: string | null }) {
  return codigo ? `${nombre} (${codigo})` : nombre;
}

/**
 * Formulario de asociación de materias (HU-D-03). Mismo patrón que
 * `ContactoProfesorForm` (HU-D-02): valida con el mismo schema que el
 * servidor e invoca la action directamente dentro de un try/catch.
 *
 * La selección vive en estado y el `FormData` se arma desde ahí, no desde el
 * DOM: así las materias ocultas por el filtro conservan su selección y se
 * envían igual. Las ya asociadas se muestran marcadas y deshabilitadas, y
 * nunca viajan (criterio 2). Ante `materias_inactivas` la selección se
 * conserva para destildar y reconfirmar (criterio 4).
 */
export function AsociarMateriasForm({
  profesorId,
  opciones,
}: {
  profesorId: string;
  opciones: OpcionMateria[];
}) {
  const [estado, setEstado] = useState<EstadoAsociarMaterias>(ESTADO_INICIAL_ASOCIAR_MATERIAS);
  const [pendiente, setPendiente] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(() => new Set());
  const [asociadas, setAsociadas] = useState<Set<string>>(
    () => new Set(opciones.filter((opcion) => opcion.asociada).map((opcion) => opcion.id)),
  );
  const [errorCliente, setErrorCliente] = useState<string>();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const rutaFicha = `/profesores/${profesorId}`;

  useEffect(() => {
    // Mismo criterio que ContactoProfesorForm: el dirty flag no queda pegado
    // si se sale por otro camino que no sea cancelar/guardar.
    return () => setDirty(false);
  }, [setDirty]);

  const visibles = filtrarMaterias(opciones, filtro);
  const inactivas = estado.status === "materias_inactivas" ? estado.materias : [];
  const idsInactivas = new Set(inactivas.map((materia) => materia.id));

  function alternar(id: string, marcada: boolean) {
    const siguiente = new Set(seleccionadas);
    if (marcada) siguiente.add(id);
    else siguiente.delete(id);
    setSeleccionadas(siguiente);
    setDirty(siguiente.size > 0);
    setErrorCliente(undefined);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const materiaIds = [...seleccionadas];
    const parsed = AsociarMateriasProfesorSchema.safeParse({ materiaIds });
    if (!parsed.success) {
      setErrorCliente(flattenError(parsed.error).fieldErrors.materiaIds?.[0]);
      setEstado(ESTADO_INICIAL_ASOCIAR_MATERIAS);
      return;
    }
    setErrorCliente(undefined);

    const formData = new FormData();
    for (const id of parsed.data.materiaIds) formData.append("materiaIds", id);

    setPendiente(true);
    try {
      const resultado = await asociarMateriasProfesor(profesorId, formData);
      setEstado(resultado);
      if (resultado.status === "exito") {
        setDirty(false);
        setAsociadas((previas) => {
          const siguiente = new Set(previas);
          for (const materia of resultado.asociadas) siguiente.add(materia.id);
          return siguiente;
        });
        setSeleccionadas(new Set());
      }
    } catch {
      setEstado({ status: "error_comunicacion" });
    } finally {
      setPendiente(false);
    }
  }

  function handleCancelar() {
    if (seleccionadas.size > 0) {
      setConfirmandoCancelar(true);
      return;
    }
    router.push(rutaFicha);
  }

  const mensajeError =
    errorCliente ??
    (estado.status === "error_validacion"
      ? (estado.errores.materiaIds?.[0] ?? MENSAJE_ERROR_COMUNICACION)
      : estado.status === "error"
        ? estado.mensaje
        : estado.status === "error_comunicacion"
          ? MENSAJE_ERROR_COMUNICACION
          : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {estado.status === "exito" && (
        <div role="status" className="space-y-1 rounded-md bg-success p-3 text-sm text-success-foreground">
          <p className="font-medium">{MENSAJE_EXITO}</p>
          <Link
            href={rutaFicha}
            className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Volver a la ficha
          </Link>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="filtro-materias">Filtrar por nombre o código</Label>
        <Input
          id="filtro-materias"
          type="search"
          autoComplete="off"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Ej.: matemática o MAT101"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Materias</legend>
        {visibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguna materia coincide con el filtro</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {visibles.map((materia) => {
              const asociada = asociadas.has(materia.id);
              const invalida = idsInactivas.has(materia.id);
              const idCheckbox = `materia-${materia.id}`;
              return (
                <li key={materia.id}>
                  <label
                    htmlFor={idCheckbox}
                    className={
                      asociada
                        ? "flex cursor-not-allowed items-center gap-3 px-3 py-2 text-muted-foreground"
                        : "flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                    }
                  >
                    <input
                      id={idCheckbox}
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={asociada || seleccionadas.has(materia.id)}
                      disabled={asociada || pendiente}
                      onChange={(e) => alternar(materia.id, e.target.checked)}
                      aria-invalid={invalida || undefined}
                      aria-describedby={invalida ? `${idCheckbox}-error` : undefined}
                    />
                    <span className="min-w-0 flex-1 break-words">{etiquetaMateria(materia)}</span>
                    {asociada && (
                      <Badge variant="muted">
                        {materia.activa ? "Asociada" : "Asociada · Inactiva"}
                      </Badge>
                    )}
                    {invalida && (
                      <span id={`${idCheckbox}-error`} className="text-xs font-medium text-destructive">
                        Dejó de estar activa
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {seleccionadas.size === 1 ? "1 seleccionada" : `${seleccionadas.size} seleccionadas`}
      </p>

      {inactivas.length > 0 && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          {inactivas.map((materia) => (
            <p key={materia.id}>
              La materia {materia.nombre} dejó de estar activa. Quitala de la selección y volvé a
              confirmar
            </p>
          ))}
        </div>
      )}

      {mensajeError && (
        <p className="text-sm text-destructive" role="alert">
          {mensajeError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pendiente || seleccionadas.size === 0}>
          {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Guardar materias
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
