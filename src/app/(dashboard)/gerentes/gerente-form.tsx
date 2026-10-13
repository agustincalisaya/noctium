"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { flattenError, type z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { ConfirmarDescarteDialog } from "@/components/shared/confirmar-descarte-dialog";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { rutaTrasGuardar } from "@/lib/modo-edicion";
import { texto } from "@/lib/textos";
import { cn } from "@/lib/utils";
import { crearGerente, modificarGerente, verificarDisponibilidadGerente } from "@/server/gerentes/actions";
import { construirAltaGerenteSchema, construirModificarGerenteSchema } from "@/server/gerentes/gerente.schema";
import { normalizarTelefono } from "@/server/shared/contacto";
import { normalizarTextoNombre } from "@/server/shared/texto";
import type { ResultadoAccionGerente } from "@/types/gerente.types";

/**
 * Formulario único del gerente (P-48, HU-G-01; prototipo figura 95): modo
 * alta y modo edición (decisión 12 de la task). Copia adaptada del de mesa de
 * entrada (HU-F-01), con sus textos y su schema:
 * - `onSubmit` manual, sin `useActionState`: la confirmación de HU-C-25
 *   (siempre, en los dos modos) espera el resultado de la Server Action.
 * - Valida con el mismo schema que la acción y la ruta; los errores van junto
 *   al campo y no se envía nada parcial.
 * - DNI y email se verifican al salir del campo; el servidor lo repite al
 *   confirmar. El aviso del email no dice de quién es.
 * - «Guardar» está deshabilitado sin cambios; «Cancelar» pide confirmación si
 *   hay datos (alta) o cambios (edición); un conflicto de versión ofrece
 *   «Recargar», que remonta el formulario con la `version` nueva.
 * - Si cambia el email de la propia ficha (`esVos`), la confirmación avisa que
 *   la sesión sigue abierta y que la próxima vez ingresa con el email nuevo
 *   (DEC-44).
 * - Un rechazo que se muestra dentro del diálogo (permiso, ficha inexistente,
 *   transacción ocupada, falla de conexión) refresca la página al cerrarlo.
 * - «Cancelar» y el botón de guardar van arriba a la derecha (prototipo).
 */

const CAMPOS = ["nombre", "apellido", "dni", "fechaNacimiento", "genero", "email", "telefono"] as const;
type Campo = (typeof CAMPOS)[number];
type Valores = Record<Campo, string>;
type Errores = Partial<Record<Campo, string>>;

/** Ficha precargada en el modo edición. */
export type GerenteEditable = {
  id: string;
  version: number;
  nombre: string;
  apellido: string;
  dni: string;
  /** `YYYY-MM-DD`. */
  fechaNacimiento: string;
  genero: string | null;
  telefono: string | null;
  email: string;
  /** La ficha es la del gerente autenticado (DEC-44). */
  esVos: boolean;
};

type GerenteFormProps = {
  dniLongitudMin: number;
  dniLongitudMax: number;
  titulo: string;
  bajada?: string;
  /** Sin `gerente`: modo alta. Con `gerente`: modo edición. */
  gerente?: GerenteEditable;
};

const GENEROS = [
  { valor: "MASCULINO", etiqueta: texto("ui.comun.genero.masculino") },
  { valor: "FEMENINO", etiqueta: texto("ui.comun.genero.femenino") },
  { valor: "OTRO", etiqueta: texto("ui.comun.genero.otro") },
  { valor: "PREFIERO_NO_INDICARLO", etiqueta: texto("ui.comun.genero.prefieroNoIndicarlo") },
];

const VACIO: Valores = { nombre: "", apellido: "", dni: "", fechaNacimiento: "", genero: "", email: "", telefono: "" };

const CLASE_SELECT = cn(
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function valoresIniciales(gerente?: GerenteEditable): Valores {
  if (!gerente) return VACIO;
  return {
    nombre: gerente.nombre,
    apellido: gerente.apellido,
    dni: gerente.dni,
    fechaNacimiento: gerente.fechaNacimiento,
    genero: gerente.genero ?? "",
    email: gerente.email,
    telefono: gerente.telefono ?? "",
  };
}

/** Valor tal como lo guardaría el servidor, para comparar contra la ficha. */
function normalizado(campo: Campo, valor: string): string | null {
  const recortado = valor.trim();
  switch (campo) {
    case "nombre":
    case "apellido":
      return normalizarTextoNombre(valor);
    case "email":
      return recortado.toLowerCase();
    case "telefono":
      return recortado === "" ? null : normalizarTelefono(recortado);
    case "genero":
      return valor === "" ? null : valor;
    default:
      return recortado;
  }
}

function primerErrorPorCampo(campos: Record<string, string[] | undefined>): Errores {
  const errores: Errores = {};
  for (const campo of CAMPOS) {
    const mensaje = campos[campo]?.[0];
    if (mensaje) errores[campo] = mensaje;
  }
  return errores;
}

type PendienteDeConfirmar = { payload: Record<string, unknown>; titulo: string; detalle?: string; form: HTMLFormElement };

export function GerenteForm({ dniLongitudMin, dniLongitudMax, titulo, bajada, gerente }: GerenteFormProps) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const edicion = gerente !== undefined;
  const rutaFicha = gerente ? `/gerentes/${gerente.id}` : null;

  const esquemaAlta = useMemo(() => construirAltaGerenteSchema(dniLongitudMin, dniLongitudMax), [dniLongitudMin, dniLongitudMax]);
  const esquemaModificar = useMemo(
    () => construirModificarGerenteSchema(dniLongitudMin, dniLongitudMax),
    [dniLongitudMin, dniLongitudMax],
  );

  const [valores, setValores] = useState<Valores>(() => valoresIniciales(gerente));
  const [errores, setErrores] = useState<Errores>({});
  const [noDisponible, setNoDisponible] = useState<{ dni: boolean; email: boolean }>({ dni: false, email: false });
  const [conflicto, setConflicto] = useState<string>();
  const [pendiente, setPendiente] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [pendienteDeConfirmar, setPendienteDeConfirmar] = useState<PendienteDeConfirmar | null>(null);
  // Un rechazo mostrado dentro del diálogo: al cerrarlo se refresca la página.
  const rechazado = useRef(false);

  const originales = useMemo(() => valoresIniciales(gerente), [gerente]);
  const cambios = Object.fromEntries(
    CAMPOS.map((campo) => [campo, normalizado(campo, valores[campo]) !== normalizado(campo, originales[campo])]),
  ) as Record<Campo, boolean>;
  const hayCambios = CAMPOS.some((campo) => cambios[campo]);
  // En el alta, «datos ingresados» = cualquier campo con algo escrito.
  const hayDatos = CAMPOS.some((campo) => valores[campo].trim() !== "");
  const sucio = edicion ? hayCambios : hayDatos;

  useEffect(() => {
    setDirty(sucio);
  }, [sucio, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  function cambiar(campo: Campo, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
    if (campo === "dni" || campo === "email") setNoDisponible((previo) => ({ ...previo, [campo]: false }));
  }

  /** Ayuda de UX al salir del campo: nunca bloquea si falla; el servidor repite la verificación. */
  async function verificarDisponibilidad(campo: "dni" | "email") {
    const valor = valores[campo].trim();
    if (!valor || (edicion && !cambios[campo])) return;
    try {
      const r = await verificarDisponibilidadGerente({ [campo]: valor, ...(gerente ? { excluirId: gerente.id } : {}) });
      if (!r.data) return;
      const disponible = campo === "dni" ? r.data.dni_disponible : r.data.email_disponible;
      setNoDisponible((previo) => ({ ...previo, [campo]: !disponible }));
    } catch {
      // Sin aviso: la verificación determinante es la del servidor al confirmar.
    }
  }

  function payloadAlta(): Record<string, unknown> {
    return { ...valores, genero: valores.genero === "" ? undefined : valores.genero };
  }

  /** Solo lo que cambió, más `version` (campo ausente = no se toca); género y teléfono vaciados viajan como `null`. */
  function payloadEdicion(): Record<string, unknown> {
    const payload: Record<string, unknown> = { version: gerente!.version };
    for (const campo of CAMPOS) {
      if (!cambios[campo]) continue;
      const vaciado = (campo === "genero" || campo === "telefono") && valores[campo].trim() === "";
      payload[campo] = vaciado ? null : valores[campo];
    }
    return payload;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || (edicion && !hayCambios)) return;
    const form = e.currentTarget;

    const payload = edicion ? payloadEdicion() : payloadAlta();
    const parsed = edicion ? esquemaModificar.safeParse(payload) : esquemaAlta.safeParse(payload);
    const nuevos: Errores = parsed.success
      ? {}
      : primerErrorPorCampo(flattenError(parsed.error as z.ZodError).fieldErrors as Record<string, string[] | undefined>);
    if (!nuevos.dni && noDisponible.dni) nuevos.dni = texto("errores.gerente.dniDuplicado");
    if (!nuevos.email && noDisponible.email) nuevos.email = texto("errores.cuenta.emailYaAsociado");
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos);
      enfocarPrimerCampoInvalido(form, nuevos);
      return;
    }

    setErrores({});
    setConflicto(undefined);
    rechazado.current = false;
    if (gerente) {
      const avisoEmail = gerente.esVos ? texto("ui.gerentes.edicion.avisoEmailPropio") : texto("ui.gerentes.edicion.avisoEmail");
      setPendienteDeConfirmar({
        payload,
        form,
        titulo: texto("ui.gerentes.edicion.confirmacionTitulo", { nombre: gerente.nombre, apellido: gerente.apellido }),
        detalle: cambios.email ? avisoEmail : undefined,
      });
    } else {
      setPendienteDeConfirmar({
        payload,
        form,
        titulo: texto("ui.gerentes.alta.confirmacionTitulo", {
          nombre: normalizarTextoNombre(valores.nombre),
          apellido: normalizarTextoNombre(valores.apellido),
        }),
        detalle: texto("ui.gerentes.alta.confirmacionDetalle", { email: normalizado("email", valores.email) }),
      });
    }
  }

  /**
   * Confirmación de HU-C-25. Un rechazo de campo (validación, DNI o email en
   * uso) o un conflicto de versión cierra el diálogo y se muestra en el
   * formulario; el resto (permiso, ficha inexistente, transacción ocupada,
   * falla de conexión) se muestra dentro del diálogo y, al cerrarlo, la página
   * se refresca.
   */
  async function confirmar() {
    if (!pendienteDeConfirmar) return;
    const { payload, form } = pendienteDeConfirmar;
    setPendiente(true);

    let resultado: ResultadoAccionGerente<{ id: string }>;
    try {
      resultado = gerente ? await modificarGerente(gerente.id, payload) : await crearGerente(payload);
    } catch {
      setPendiente(false);
      rechazado.current = true;
      throw new Error(texto("errores.gerente.comunicacion"));
    }

    if (!resultado.error) {
      // `pendiente` queda en true hasta que la navegación desmonte el formulario.
      setDirty(false);
      if (rutaFicha) router.replace(rutaTrasGuardar(rutaFicha));
      else router.push(`/gerentes/${resultado.data.id}?creado=1`);
      return;
    }

    setPendiente(false);
    const { code, message, detalles } = resultado.error;
    let deCampo: Errores | null = null;
    if (code === "VALIDATION_ERROR") deCampo = primerErrorPorCampo(detalles ?? {});
    else if (code === "DNI_DUPLICADO") deCampo = { dni: message };
    else if (code === "EMAIL_YA_ASOCIADO") deCampo = { email: message };
    if (deCampo) {
      setErrores(deCampo);
      enfocarPrimerCampoInvalido(form, deCampo);
      return;
    }
    if (code === "CONFLICTO_EDICION_CONCURRENTE") {
      setConflicto(message);
      return;
    }
    rechazado.current = true;
    throw new Error(message);
  }

  function cerrarConfirmacion() {
    setPendienteDeConfirmar(null);
    if (rechazado.current) {
      rechazado.current = false;
      router.refresh();
    }
  }

  function salir() {
    setDirty(false);
    router.push(rutaFicha ?? "/gerentes");
  }

  function handleCancelar() {
    if (sucio) {
      setConfirmandoCancelar(true);
      return;
    }
    salir();
  }

  function handleRecargar() {
    // Descarta lo tipeado: la página remonta el formulario con la `version` nueva (`key`).
    setDirty(false);
    router.refresh();
  }

  function error(campo: Campo): string | undefined {
    return (
      errores[campo] ??
      (campo === "dni" && noDisponible.dni ? texto("errores.gerente.dniDuplicado") : undefined) ??
      (campo === "email" && noDisponible.email ? texto("errores.cuenta.emailYaAsociado") : undefined)
    );
  }

  function mensajeDeError(campo: Campo) {
    const mensaje = error(campo);
    return mensaje ? (
      <p id={`${campo}-error`} className="text-sm text-destructive" role="alert">
        {mensaje}
      </p>
    ) : null;
  }

  function etiqueta(campo: Campo, textoEtiqueta: string, obligatorio: boolean) {
    return (
      <Label htmlFor={campo}>
        {textoEtiqueta}
        {obligatorio && (
          <span className="text-destructive" title={texto("ui.gerentes.form.obligatorio")}>
            {" "}
            <span aria-hidden="true">*</span>
          </span>
        )}
      </Label>
    );
  }

  function campoTexto(campo: Campo, textoEtiqueta: string, opciones: { tipo?: string; inputMode?: "numeric"; obligatorio?: boolean; ayuda?: string; alSalir?: () => void } = {}) {
    const { tipo = "text", inputMode, obligatorio = true, ayuda, alSalir } = opciones;
    const mensaje = error(campo);
    const describedBy = [ayuda ? `${campo}-ayuda` : null, mensaje ? `${campo}-error` : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="space-y-1.5">
        {etiqueta(campo, textoEtiqueta, obligatorio)}
        <Input
          id={campo}
          name={campo}
          type={tipo}
          inputMode={inputMode}
          autoComplete="off"
          value={valores[campo]}
          onChange={(e) => cambiar(campo, e.target.value)}
          onBlur={alSalir}
          aria-invalid={!!mensaje}
          aria-describedby={describedBy}
        />
        {ayuda && (
          <p id={`${campo}-ayuda`} className="text-xs text-muted-foreground">
            {ayuda}
          </p>
        )}
        {mensajeDeError(campo)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          {bajada && <p className="text-sm text-muted-foreground">{bajada}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={handleCancelar} disabled={pendiente}>
            {texto("ui.gerentes.form.cancelar")}
          </Button>
          <Button type="submit" disabled={pendiente || (edicion && !hayCambios)}>
            {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {edicion ? texto("ui.gerentes.edicion.guardar") : texto("ui.gerentes.alta.registrar")}
          </Button>
        </div>
      </div>

      {conflicto && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
          <span>{conflicto}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleRecargar}>
            {texto("ui.gerentes.edicion.recargar")}
          </Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <fieldset className="min-w-0 space-y-4 rounded-md border border-border bg-card p-5 text-card-foreground">
          <legend className="sr-only">{texto("ui.gerentes.form.identidad")}</legend>
          <h2 aria-hidden="true" className="text-lg font-semibold">
            {texto("ui.gerentes.form.identidad")}
          </h2>
          {campoTexto("nombre", texto("ui.gerentes.form.nombre"))}
          {campoTexto("apellido", texto("ui.gerentes.form.apellido"))}
          {campoTexto("dni", texto("ui.gerentes.form.dni"), { inputMode: "numeric", alSalir: () => void verificarDisponibilidad("dni") })}
          {campoTexto("fechaNacimiento", texto("ui.gerentes.form.fechaNacimiento"), { tipo: "date" })}
          <div className="space-y-1.5">
            {etiqueta("genero", texto("ui.gerentes.form.genero"), false)}
            <select
              id="genero"
              name="genero"
              value={valores.genero}
              onChange={(e) => cambiar("genero", e.target.value)}
              aria-invalid={!!error("genero")}
              className={CLASE_SELECT}
            >
              <option value="">{texto("ui.comun.genero.sinEspecificar")}</option>
              {GENEROS.map((genero) => (
                <option key={genero.valor} value={genero.valor}>
                  {genero.etiqueta}
                </option>
              ))}
            </select>
            {mensajeDeError("genero")}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-4 rounded-md border border-border bg-card p-5 text-card-foreground">
          <legend className="sr-only">{texto("ui.gerentes.form.contacto")}</legend>
          <h2 aria-hidden="true" className="text-lg font-semibold">
            {texto("ui.gerentes.form.contacto")}
          </h2>
          <p className="text-sm text-muted-foreground">{texto("ui.gerentes.form.contactoNota")}</p>
          {campoTexto("email", texto("ui.gerentes.form.email"), { tipo: "email", alSalir: () => void verificarDisponibilidad("email") })}
          {campoTexto("telefono", texto("ui.gerentes.form.telefono"), {
            tipo: "tel",
            obligatorio: false,
            ayuda: texto("ui.gerentes.form.telefonoAyuda"),
          })}
        </fieldset>
      </div>

      <ConfirmarAccionDialog
        abierto={pendienteDeConfirmar !== null}
        titulo={pendienteDeConfirmar?.titulo ?? ""}
        detalle={pendienteDeConfirmar?.detalle}
        textoConfirmar={edicion ? texto("ui.gerentes.edicion.confirmar") : texto("ui.gerentes.alta.confirmar")}
        onConfirmar={confirmar}
        onCerrar={cerrarConfirmacion}
      />

      <ConfirmarDescarteDialog abierto={confirmandoCancelar} onAbiertoChange={setConfirmandoCancelar} onConfirmar={salir} />
    </form>
  );
}
