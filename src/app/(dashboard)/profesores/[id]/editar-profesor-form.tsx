"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { cn } from "@/lib/utils";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { formatearApellidoNombre } from "@/lib/profesor-listado";
import { normalizarTextoNombre } from "@/server/shared/texto";
import { normalizarTelefono } from "@/server/shared/contacto";
import { MENSAJE_CONTACTO_REQUERIDO } from "@/server/shared/contacto.schema";
import { construirModificarProfesorSchema } from "@/server/profesores/profesor.schema";
import { modificarProfesor } from "@/server/profesores/actions";
import type { DetalleProfesor } from "@/types/profesor.types";
import { formatearFechaAlta } from "./ficha-identidad";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

// Mismas opciones que el alta (nuevo-profesor-form.tsx): sin importar el enum
// de @prisma/client en un Client Component (deuda documentada en HU-D-01).
const GENERO_OPCIONES: { value: string; label: string }[] = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMENINO", label: "Femenino" },
  { value: "OTRO", label: "Otro" },
  { value: "PREFIERO_NO_INDICARLO", label: "Prefiero no indicarlo" },
];

const CLASE_SELECT = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const CAMPOS = ["nombre", "apellido", "dni", "fechaNacimiento", "genero", "telefono", "email"] as const;
type Campo = (typeof CAMPOS)[number];
type Errores = Partial<Record<Campo, string>>;

/** Campos que se pueden vaciar: vacío = `null` (sin especificar / quitar el medio). */
const CAMPOS_ANULABLES = new Set<Campo>(["genero", "telefono", "email"]);

function primerErrorPorCampo(fieldErrors: Record<string, string[] | undefined>): Errores {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, fieldErrors[campo]?.[0]]));
}

/** Fecha calendario `@db.Date` (medianoche UTC) como valor de `<input type="date">`. */
function fechaAInput(fecha: Date): string {
  return new Date(fecha).toISOString().slice(0, 10);
}

/**
 * Valores del formulario con la misma normalización que
 * `construirModificarProfesorSchema()` (vacío = `null`), para decidir qué
 * cambió: "Guardar cambios" queda deshabilitado mientras coincidan con los
 * guardados, y solo viajan los campos distintos (HU-D-06 criterio 3).
 */
function normalizarContacto(telefono: string, email: string) {
  return {
    telefono: telefono.trim() === "" ? null : normalizarTelefono(telefono),
    email: email.trim() === "" ? null : email.trim().toLowerCase(),
  };
}

type EditarProfesorFormProps = {
  profesor: DetalleProfesor;
  dniLongitudMin: number;
  dniLongitudMax: number;
  /** YYYY-MM-DD: `max` del date picker (mayoría de edad, igual que el alta). */
  fechaMaximaNacimiento: string;
  /** Ficha en modo consulta (Cancelar / Salir sin guardar). */
  rutaConsulta: string;
  /** Ficha en modo consulta con el banner de éxito. */
  rutaTrasGuardar: string;
};

/**
 * Modo edición de la ficha del profesor (HU-D-06, `spec_modulo_D.md` §2.6):
 * identidad (HU-D-01) y contacto (HU-D-02) precargados, con las mismas
 * validaciones que el alta. No incluye materias, horario de atención ni
 * estado (criterio 5): siguen en sus propias pantallas.
 */
export function EditarProfesorForm({
  profesor,
  dniLongitudMin,
  dniLongitudMax,
  fechaMaximaNacimiento,
  rutaConsulta,
  rutaTrasGuardar,
}: EditarProfesorFormProps) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const formRef = useRef<HTMLFormElement>(null);

  const schema = useMemo(
    () => construirModificarProfesorSchema(dniLongitudMin, dniLongitudMax),
    [dniLongitudMin, dniLongitudMax],
  );

  const fechaOriginal = fechaAInput(profesor.fechaNacimiento);
  const [nombre, setNombre] = useState(profesor.nombre);
  const [apellido, setApellido] = useState(profesor.apellido);
  const [dni, setDni] = useState(profesor.dni);
  const [fechaNacimiento, setFechaNacimiento] = useState(fechaOriginal);
  const [genero, setGenero] = useState<string>(profesor.genero ?? "");
  const [telefono, setTelefono] = useState(profesor.telefono ?? "");
  const [email, setEmail] = useState(profesor.email ?? "");

  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const [conflicto, setConflicto] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const contacto = normalizarContacto(telefono, email);
  const cambios: Record<Campo, boolean> = {
    nombre: normalizarTextoNombre(nombre) !== profesor.nombre,
    apellido: normalizarTextoNombre(apellido) !== profesor.apellido,
    dni: dni.trim() !== profesor.dni,
    fechaNacimiento: fechaNacimiento !== fechaOriginal,
    genero: (genero === "" ? null : genero) !== profesor.genero,
    telefono: contacto.telefono !== profesor.telefono,
    email: contacto.email !== profesor.email,
  };
  const hayCambios = CAMPOS.some((campo) => cambios[campo]);

  useEffect(() => {
    setDirty(hayCambios);
  }, [hayCambios, setDirty]);

  useEffect(() => () => setDirty(false), [setDirty]);

  function mostrarErrores(nuevos: Errores) {
    setErrores(nuevos);
    enfocarPrimerCampoInvalido(formRef.current, nuevos);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || !hayCambios) return;

    // Solo viaja lo que cambió (semántica de PATCH: ausente = no se modifica);
    // un contacto o género vaciado viaja como "" y la action lo convierte en null.
    const valores: Record<Campo, string> = { nombre, apellido, dni, fechaNacimiento, genero, telefono, email };
    const formData = new FormData();
    formData.append("version", String(profesor.version));
    const payload: Record<string, unknown> = { version: profesor.version };
    for (const campo of CAMPOS) {
      if (!cambios[campo]) continue;
      const vaciado = CAMPOS_ANULABLES.has(campo) && valores[campo].trim() === "";
      formData.append(campo, vaciado ? "" : valores[campo]);
      payload[campo] = vaciado ? null : valores[campo];
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      mostrarErrores(primerErrorPorCampo(flattenError(parsed.error).fieldErrors));
      setErrorGeneral(undefined);
      return;
    }
    // «Al menos un medio de contacto» (N-2): se anticipa acá con los valores
    // precargados; la fuente de verdad es el servicio.
    const teniaContacto = profesor.telefono !== null || profesor.email !== null;
    if ((cambios.telefono || cambios.email) && teniaContacto && !contacto.telefono && !contacto.email) {
      mostrarErrores({ telefono: MENSAJE_CONTACTO_REQUERIDO });
      setErrorGeneral(undefined);
      return;
    }

    setErrores({});
    setErrorGeneral(undefined);
    setConflicto(false);
    setPendiente(true);

    try {
      const resultado = await modificarProfesor(profesor.id, formData);

      if (!resultado.error) {
        setDirty(false);
        router.replace(rutaTrasGuardar);
        return;
      }

      const { code, message, detalles } = resultado.error;
      if (code === "VALIDACION") {
        const campos =
          (detalles as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors ?? {};
        mostrarErrores(primerErrorPorCampo(campos));
      } else if (code === "DNI_DUPLICADO") {
        mostrarErrores({ dni: message });
      } else if (code === "EMAIL_YA_ASOCIADO") {
        mostrarErrores({ email: message });
      } else {
        // CONFLICTO_EDICION_CONCURRENTE / PROFESOR_NO_ENCONTRADO /
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
    router.push(rutaConsulta);
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

  function campoError(campo: Campo) {
    const mensaje = errores[campo];
    return mensaje ? (
      <p className="text-sm text-destructive" role="alert">
        {mensaje}
      </p>
    ) : null;
  }

  const requerido = (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {formatearApellidoNombre(profesor.apellido, profesor.nombre)}
            </h1>
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
          <section className="space-y-4 rounded-md border border-border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">Datos personales</h2>

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre {requerido}</Label>
              <Input
                id="nombre"
                name="nombre"
                autoComplete="off"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                aria-invalid={!!errores.nombre}
              />
              {campoError("nombre")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido {requerido}</Label>
              <Input
                id="apellido"
                name="apellido"
                autoComplete="off"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                aria-invalid={!!errores.apellido}
              />
              {campoError("apellido")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dni">DNI {requerido}</Label>
              <Input
                id="dni"
                name="dni"
                inputMode="numeric"
                autoComplete="off"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                aria-invalid={!!errores.dni}
              />
              {campoError("dni")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento {requerido}</Label>
              <Input
                id="fechaNacimiento"
                name="fechaNacimiento"
                type="date"
                max={fechaMaximaNacimiento}
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                aria-invalid={!!errores.fechaNacimiento}
              />
              {campoError("fechaNacimiento")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="genero">Género</Label>
              <select
                id="genero"
                name="genero"
                value={genero}
                onChange={(e) => setGenero(e.target.value)}
                aria-invalid={!!errores.genero}
                className={CLASE_SELECT}
              >
                <option value="">Sin especificar</option>
                {GENERO_OPCIONES.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>
              {campoError("genero")}
            </div>

            <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Estado</dt>
                <dd className="font-medium">{profesor.activo ? "Activo" : "Inactivo"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Fecha de alta</dt>
                <dd className="font-medium">{formatearFechaAlta(profesor.fechaAlta)}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4 self-start rounded-md border border-border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">Datos de contacto</h2>
            <p className="text-sm text-muted-foreground">
              Podés dejar uno vacío, pero no los dos si el profesor ya tenía alguno.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                autoComplete="off"
                placeholder="Ej.: (0387) 15-412-3456"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                aria-invalid={!!errores.telefono}
              />
              {campoError("telefono")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errores.email}
              />
              {campoError("email")}
            </div>
          </section>
        </div>

        <p className="text-xs text-muted-foreground">
          Las materias y el horario de atención no se modifican desde acá: se gestionan desde la ficha.
        </p>
      </form>

      <ConfirmarDescarteDialog
        abierto={confirmandoCancelar}
        onAbiertoChange={setConfirmandoCancelar}
        onConfirmar={volverAConsulta}
      />
    </>
  );
}
