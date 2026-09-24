"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { construirModificarAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { modificarAlumno } from "@/server/alumnos/actions";
import type { DetalleAlumno } from "@/types/alumno.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Alumno actualizado correctamente";

const GENEROS = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMENINO", label: "Femenino" },
  { value: "OTRO", label: "Otro" },
  { value: "PREFIERO_NO_INDICARLO", label: "Prefiero no indicarlo" },
] as const;

type FormaPagoActiva = { id: string; nombre: string };

type ValoresEditables = {
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  genero: string; // "" = sin especificar
  telefono: string;
  email: string;
  forma_pago_id: string; // "" = sin preferencia
};

type CamposError = Partial<Record<keyof ValoresEditables, string>>;

type EditarAlumnoFormProps = {
  alumno: DetalleAlumno;
  formasPagoActivas: FormaPagoActiva[];
  dniLongitudMin: number;
  dniLongitudMax: number;
};

/**
 * Formulario único de edición del alumno (HU-B-06 §5): identidad + contacto
 * + forma de pago en un solo submit. Diferencias deliberadas respecto a
 * `AlumnoForm`/`ContactoAlumnoForm`/`FormaPagoForm` (los formularios que
 * combina):
 *
 * - "Guardar" necesita diffing real campo por campo (criterio 5: "si no hubo
 *   cambios, Guardar permanece deshabilitado") — el flag booleano de
 *   `useDirtyState()` no alcanza (ese sigue usándose tal cual, solo para la
 *   confirmación de "Cancelar"). `valorOriginal` guarda el snapshot cargado;
 *   `recalcularCambios()` relee el `FormData` completo en cada `onChange` del
 *   `<form>` y compara campo por campo contra ese snapshot.
 * - El payload que se envía a `modificarAlumno()` (Server Action) solo
 *   incluye las claves que efectivamente difieren del snapshot — igual
 *   diffing que el de arriba, reutilizado — para que `camposProvistos` en la
 *   capa de servicio (que la action arma con `formData.has()`) refleje
 *   cambios reales y no todo el formulario en cada guardado (criterio 5:
 *   "se actualizan únicamente los datos modificados").
 * - La validación de cliente corre sobre el estado ACTUAL completo (no solo
 *   el diff): mismas validaciones que en el alta (criterio 3), aplicadas a
 *   todo el formulario, no campo por campo aislado.
 */
export function EditarAlumnoForm({
  alumno,
  formasPagoActivas,
  dniLongitudMin,
  dniLongitudMax,
}: EditarAlumnoFormProps) {
  const router = useRouter();
  const { dirty, setDirty } = useDirtyState();
  const rutaFicha = `/alumnos/${alumno.id}`;

  const valorOriginal = useRef<ValoresEditables>({
    nombre: alumno.nombre,
    apellido: alumno.apellido,
    dni: alumno.dni,
    fecha_nacimiento: alumno.fecha_nacimiento,
    genero: alumno.genero ?? "",
    telefono: alumno.telefono ?? "",
    email: alumno.email ?? "",
    forma_pago_id: alumno.forma_pago_preferida_id ?? "",
  });

  const [hayCambios, setHayCambios] = useState(false);
  const [exito, setExito] = useState<{ campos_modificados: string[] } | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [errores, setErrores] = useState<CamposError>({});
  const [errorGeneral, setErrorGeneral] = useState<string | undefined>();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const nombreRef = useRef<HTMLInputElement>(null);
  const apellidoRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const generoRef = useRef<HTMLSelectElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formaPagoRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    nombreRef.current?.focus();
    return () => setDirty(false);
  }, [setDirty]);

  function leerValoresActuales(form: HTMLFormElement): ValoresEditables {
    const fd = new FormData(form);
    return {
      nombre: String(fd.get("nombre") ?? ""),
      apellido: String(fd.get("apellido") ?? ""),
      dni: String(fd.get("dni") ?? ""),
      fecha_nacimiento: String(fd.get("fecha_nacimiento") ?? ""),
      genero: String(fd.get("genero") ?? ""),
      telefono: String(fd.get("telefono") ?? ""),
      email: String(fd.get("email") ?? ""),
      forma_pago_id: String(fd.get("forma_pago_id") ?? ""),
    };
  }

  function camposCambiados(actual: ValoresEditables): (keyof ValoresEditables)[] {
    return (Object.keys(actual) as (keyof ValoresEditables)[]).filter(
      (clave) => actual[clave] !== valorOriginal.current[clave],
    );
  }

  function handleFormChange(e: FormEvent<HTMLFormElement>) {
    setDirty(true);
    setHayCambios(camposCambiados(leerValoresActuales(e.currentTarget)).length > 0);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const actual = leerValoresActuales(form);
    const cambiados = camposCambiados(actual);
    if (cambiados.length === 0) return; // "Guardar" no debería estar habilitado, pero por las dudas.

    const payloadValidacion = {
      nombre: actual.nombre,
      apellido: actual.apellido,
      dni: actual.dni,
      fecha_nacimiento: actual.fecha_nacimiento,
      genero: actual.genero === "" ? null : actual.genero,
      telefono: actual.telefono,
      email: actual.email,
      forma_pago_id: actual.forma_pago_id === "" ? null : actual.forma_pago_id,
      version: alumno.version,
    };

    const parsed = construirModificarAlumnoSchema(dniLongitudMin, dniLongitudMax).safeParse(payloadValidacion);
    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      const erroresCliente: CamposError = {
        nombre: campos.nombre?.[0],
        apellido: campos.apellido?.[0],
        dni: campos.dni?.[0],
        fecha_nacimiento: campos.fecha_nacimiento?.[0],
        genero: campos.genero?.[0],
        telefono: campos.telefono?.[0],
        email: campos.email?.[0],
        forma_pago_id: campos.forma_pago_id?.[0],
      };
      setErrores(erroresCliente);
      setErrorGeneral(undefined);
      enfocarPrimerCampoInvalido(form, erroresCliente);
      return; // sin guardado parcial: no se envía nada al servidor
    }
    setErrores({});
    setErrorGeneral(undefined);
    setPendiente(true);

    // Solo se manda lo que efectivamente cambió respecto al snapshot cargado
    // (mismo diff de arriba) — camposProvistos en la Server Action se arma
    // con formData.has(), así que un campo sin cambios ni siquiera llega.
    const datosModificados = new FormData();
    datosModificados.append("version", String(alumno.version));
    for (const clave of cambiados) {
      datosModificados.append(clave, actual[clave]);
    }

    try {
      const resultado = await modificarAlumno(alumno.id, datosModificados);

      if (!resultado.error) {
        setDirty(false);
        setHayCambios(false);
        setExito({ campos_modificados: resultado.data.campos_modificados });
        return;
      }

      if (resultado.error.code === "VALIDACION") {
        const detalles = resultado.error.detalles as
          | { fieldErrors?: Record<string, string[] | undefined> }
          | undefined;
        const campos = detalles?.fieldErrors ?? {};
        const erroresServidor: CamposError = {
          nombre: campos.nombre?.[0],
          apellido: campos.apellido?.[0],
          dni: campos.dni?.[0],
          fecha_nacimiento: campos.fecha_nacimiento?.[0],
          genero: campos.genero?.[0],
          telefono: campos.telefono?.[0],
          email: campos.email?.[0],
          forma_pago_id: campos.forma_pago_id?.[0],
        };
        setErrores(erroresServidor);
        enfocarPrimerCampoInvalido(form, erroresServidor);
      } else if (resultado.error.code === "DNI_DUPLICADO") {
        setErrores({ dni: resultado.error.message });
        dniRef.current?.focus();
      } else if (
        resultado.error.code === "EMAIL_YA_ASOCIADO" ||
        resultado.error.code === "EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE"
      ) {
        setErrores({ email: resultado.error.message });
        emailRef.current?.focus();
      } else {
        // CONFLICTO_EDICION_CONCURRENTE / FORMA_PAGO_NO_DISPONIBLE /
        // SESION_INVALIDA / SIN_PERMISO / ALUMNO_NO_ENCONTRADO / cualquier
        // otro código: mensaje general, ya viene sin detalle técnico. Sin
        // reintento automático (criterio 6: el usuario tiene que recargar).
        setErrorGeneral(resultado.error.message);
      }
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
        <Link href={rutaFicha} className={buttonVariants({ variant: "default" })}>
          Volver a la ficha
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onChange={handleFormChange} noValidate className="space-y-6">
      <dl className="grid gap-3 rounded-md bg-muted px-3 py-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Id interno</dt>
          <dd className="break-all font-medium">{alumno.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fecha de alta</dt>
          <dd className="font-medium">{new Date(alumno.created_at).toLocaleDateString("es-AR")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estado</dt>
          <dd className="font-medium">{alumno.is_active ? "Activo" : "Inactivo"}</dd>
        </div>
      </dl>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Identidad</h2>

        <div className="space-y-1.5">
          <Label htmlFor="nombre">
            Nombre <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={nombreRef}
            id="nombre"
            name="nombre"
            required
            maxLength={50}
            defaultValue={alumno.nombre}
            aria-invalid={!!errores.nombre}
          />
          <p className="text-xs text-muted-foreground">
            Entre 2 y 50 caracteres. Solo letras, espacios, acentos, apóstrofes y guiones.
          </p>
          {errores.nombre && (
            <p className="text-sm text-destructive" role="alert">
              {errores.nombre}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="apellido">
            Apellido <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={apellidoRef}
            id="apellido"
            name="apellido"
            required
            maxLength={50}
            defaultValue={alumno.apellido}
            aria-invalid={!!errores.apellido}
          />
          <p className="text-xs text-muted-foreground">
            Entre 2 y 50 caracteres. Solo letras, espacios, acentos, apóstrofes y guiones.
          </p>
          {errores.apellido && (
            <p className="text-sm text-destructive" role="alert">
              {errores.apellido}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dni">
            DNI <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={dniRef}
            id="dni"
            name="dni"
            required
            inputMode="numeric"
            maxLength={dniLongitudMax}
            defaultValue={alumno.dni}
            aria-invalid={!!errores.dni}
          />
          <p className="text-xs text-muted-foreground">
            Solo números, entre {dniLongitudMin} y {dniLongitudMax} dígitos.
          </p>
          {errores.dni && (
            <p className="text-sm text-destructive" role="alert">
              {errores.dni}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fecha_nacimiento">
            Fecha de nacimiento <span aria-hidden="true">*</span>
          </Label>
          <Input
            ref={fechaRef}
            id="fecha_nacimiento"
            name="fecha_nacimiento"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={alumno.fecha_nacimiento}
            aria-invalid={!!errores.fecha_nacimiento}
          />
          <p className="text-xs text-muted-foreground">No puede ser una fecha futura.</p>
          {errores.fecha_nacimiento && (
            <p className="text-sm text-destructive" role="alert">
              {errores.fecha_nacimiento}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="genero">Género</Label>
          <select
            ref={generoRef}
            id="genero"
            name="genero"
            defaultValue={alumno.genero ?? ""}
            aria-invalid={!!errores.genero}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            )}
          >
            <option value="">Sin especificar</option>
            {GENEROS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Opcional.</p>
          {errores.genero && (
            <p className="text-sm text-destructive" role="alert">
              {errores.genero}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Contacto</h2>
        <p className="text-sm text-muted-foreground">Completá al menos uno de los dos datos.</p>

        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            ref={telefonoRef}
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={alumno.telefono ?? ""}
            placeholder="Ej.: (0387) 15-412-3456"
            aria-invalid={!!errores.telefono}
          />
          {errores.telefono && (
            <p className="text-sm text-destructive" role="alert">
              {errores.telefono}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={alumno.email ?? ""}
            placeholder="Ej.: nombre@dominio.com"
            aria-invalid={!!errores.email}
          />
          {errores.email && (
            <p className="text-sm text-destructive" role="alert">
              {errores.email}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Forma de pago</h2>

        {formasPagoActivas.length === 0 && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            No hay formas de pago disponibles. Podés continuar sin preferencia.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="forma_pago_id">Forma de pago preferida</Label>
          <select
            ref={formaPagoRef}
            id="forma_pago_id"
            name="forma_pago_id"
            defaultValue={alumno.forma_pago_preferida_id ?? ""}
            aria-invalid={!!errores.forma_pago_id}
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
          {errores.forma_pago_id && (
            <p className="text-sm text-destructive" role="alert">
              {errores.forma_pago_id}
            </p>
          )}
        </div>
      </div>

      {/* Condición de concurrencia optimista (RULES.md Regla N.° 7) — no editable, viaja siempre. */}
      <input type="hidden" name="version" value={alumno.version} readOnly />

      {errorGeneral && (
        <p className="text-sm text-destructive" role="alert">
          {errorGeneral}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pendiente || !hayCambios}>
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
