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
import { actualizarMateriasProfesor, modificarProfesor } from "@/server/profesores/actions";
import type { DetalleProfesor } from "@/types/profesor.types";
import { formatearFechaAlta } from "./ficha-identidad";
import { MateriasProfesorSelector } from "./materias-profesor-selector";
import { VerTurnosFuturosDialog } from "./ver-turnos-futuros-dialog";
import type { OpcionMateria } from "./materias/asociar-materias-form";

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
  /** Ficha en modo consulta con el banner de éxito de solo materias (HU-D-07 AC4). */
  rutaTrasGuardarMaterias: string;
  /** Selector de materias (HU-D-07): activas del catálogo + asociadas inactivas. */
  opcionesMaterias: OpcionMateria[];
};

function mismosElementos(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

/**
 * Modo edición de la ficha del profesor (HU-D-06, `spec_modulo_D.md` §2.6):
 * identidad (HU-D-01) y contacto (HU-D-02) precargados, con las mismas
 * validaciones que el alta, y las materias asociadas (HU-D-07, §2.7). No
 * incluye horario de atención ni estado: siguen en sus propias pantallas.
 *
 * Un solo "Guardar cambios" para dos endpoints sin transacción común (spec
 * §2.7 «Guardado desde la UI»): primero las materias (la regla que más
 * probablemente falle) y, solo si salieron bien, los datos. Si las materias
 * se guardaron y los datos no, se avisa y el reintento manda solo los datos.
 */
export function EditarProfesorForm({
  profesor,
  dniLongitudMin,
  dniLongitudMax,
  fechaMaximaNacimiento,
  rutaConsulta,
  rutaTrasGuardar,
  rutaTrasGuardarMaterias,
  opcionesMaterias,
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

  // HU-D-07: conjunto deseado vs. último guardado. `materiasGuardadas` se
  // mueve si las materias se guardaron pero los datos fallaron.
  const [materiasGuardadas, setMateriasGuardadas] = useState(
    () => new Set(opcionesMaterias.filter((opcion) => opcion.asociada).map((opcion) => opcion.id)),
  );
  const [materiasDeseadas, setMateriasDeseadas] = useState(() => new Set(materiasGuardadas));
  const [bloqueos, setBloqueos] = useState<Map<string, number>>(() => new Map());
  const [idsInactivas, setIdsInactivas] = useState<Set<string>>(() => new Set());
  const [errorMaterias, setErrorMaterias] = useState<string>();
  const [avisoParcial, setAvisoParcial] = useState<string>();
  const [verTurnos, setVerTurnos] = useState<{ id: string; nombre: string } | null>(null);

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
  const hayCambiosDatos = CAMPOS.some((campo) => cambios[campo]);
  const hayCambiosMaterias = !mismosElementos(materiasDeseadas, materiasGuardadas);
  const hayCambios = hayCambiosDatos || hayCambiosMaterias;

  useEffect(() => {
    setDirty(hayCambios);
  }, [hayCambios, setDirty]);

  useEffect(() => () => setDirty(false), [setDirty]);

  function mostrarErrores(nuevos: Errores) {
    setErrores(nuevos);
    enfocarPrimerCampoInvalido(formRef.current, nuevos);
  }

  function alternarMateria(id: string, marcada: boolean) {
    setMateriasDeseadas((previas) => {
      const siguiente = new Set(previas);
      if (marcada) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
    // Destildarla de nuevo es el reintento: el aviso de esa materia se va.
    setBloqueos((previos) => {
      if (!previos.has(id)) return previos;
      const siguiente = new Map(previos);
      siguiente.delete(id);
      return siguiente;
    });
    setIdsInactivas((previas) => {
      if (!previas.has(id)) return previas;
      const siguiente = new Set(previas);
      siguiente.delete(id);
      return siguiente;
    });
    setErrorMaterias(undefined);
  }

  /**
   * Paso 1 del guardado (spec §2.7). Ante un rechazo de bajas, las materias
   * bloqueadas vuelven a quedar tildadas y el resto de los cambios queda en
   * pantalla, sin guardar (el servidor no guardó nada: todo o nada).
   */
  async function guardarMaterias(): Promise<{ ok: true; pendientes: number } | { ok: false }> {
    const resultado = await actualizarMateriasProfesor(profesor.id, [...materiasDeseadas]);
    if (!resultado.error) {
      setMateriasGuardadas(new Set(materiasDeseadas));
      setBloqueos(new Map());
      setIdsInactivas(new Set());
      return { ok: true, pendientes: resultado.data.pendientes_afectados };
    }
    const { code, message, detalle, materias } = resultado.error;
    if (code === "MATERIA_CON_TURNOS_FUTUROS" && detalle) {
      setBloqueos(new Map(detalle.map(({ materia_id, cantidad }) => [materia_id, cantidad])));
      setMateriasDeseadas((previas) => new Set([...previas, ...detalle.map(({ materia_id }) => materia_id)]));
    } else if (code === "MATERIA_INACTIVA" && materias) {
      setIdsInactivas(new Set(materias.map(({ id }) => id)));
      setErrorMaterias(
        materias
          .map(({ nombre }) => `La materia ${nombre} dejó de estar activa. Quitala de la selección y volvé a confirmar`)
          .join(". "),
      );
    } else {
      setErrorMaterias(message);
    }
    return { ok: false };
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

    const parsed = hayCambiosDatos ? schema.safeParse(payload) : null;
    if (parsed && !parsed.success) {
      mostrarErrores(primerErrorPorCampo(flattenError(parsed.error).fieldErrors));
      setErrorGeneral(undefined);
      return;
    }
    // «Al menos un medio de contacto» (N-2): se anticipa acá con los valores
    // precargados; la fuente de verdad es el servicio.
    const teniaContacto = profesor.telefono !== null || profesor.email !== null;
    if (hayCambiosDatos && (cambios.telefono || cambios.email) && teniaContacto && !contacto.telefono && !contacto.email) {
      mostrarErrores({ telefono: MENSAJE_CONTACTO_REQUERIDO });
      setErrorGeneral(undefined);
      return;
    }

    setErrores({});
    setErrorGeneral(undefined);
    setAvisoParcial(undefined);
    setErrorMaterias(undefined);
    setConflicto(false);
    setPendiente(true);

    try {
      let materiasGuardadasAhora = false;
      let pendientesAfectados = 0;
      if (hayCambiosMaterias) {
        const materias = await guardarMaterias();
        if (!materias.ok) return; // 2.7 falló: los datos no se envían.
        materiasGuardadasAhora = true;
        pendientesAfectados = materias.pendientes;
      }

      if (!hayCambiosDatos) {
        setDirty(false);
        router.replace(
          pendientesAfectados > 0
            ? `${rutaTrasGuardarMaterias}&pendientes=${pendientesAfectados}`
            : rutaTrasGuardarMaterias,
        );
        return;
      }

      const resultado = await modificarProfesor(profesor.id, formData);

      if (!resultado.error) {
        setDirty(false);
        router.replace(rutaTrasGuardar);
        return;
      }

      const { code, message, detalles } = resultado.error;
      if (materiasGuardadasAhora) {
        setAvisoParcial(`Las materias se guardaron, pero los datos no: ${message}`);
      }
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

        {avisoParcial && (
          <p role="alert" className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
            {avisoParcial}
          </p>
        )}

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

        <MateriasProfesorSelector
          opciones={opcionesMaterias}
          guardadas={materiasGuardadas}
          seleccionadas={materiasDeseadas}
          onAlternar={alternarMateria}
          bloqueos={bloqueos}
          idsInactivas={idsInactivas}
          onVerTurnos={setVerTurnos}
          deshabilitado={pendiente}
          profesorActivo={profesor.activo}
          error={errorMaterias}
        />

        <p className="text-xs text-muted-foreground">
          El horario de atención no se modifica desde acá: se gestiona desde la ficha.
        </p>
      </form>

      {verTurnos && (
        <VerTurnosFuturosDialog
          profesorId={profesor.id}
          materia={verTurnos}
          onCerrar={() => setVerTurnos(null)}
        />
      )}

      <ConfirmarDescarteDialog
        abierto={confirmandoCancelar}
        onAbiertoChange={setConfirmandoCancelar}
        onConfirmar={volverAConsulta}
      />
    </>
  );
}
