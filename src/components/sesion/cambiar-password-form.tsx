"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { texto } from "@/lib/textos";
import { construirCambiarPasswordSchema } from "@/server/sesion/sesion.schema";
import { cambiarPasswordPropia } from "@/server/sesion/actions";
import { ESTADO_INICIAL_CAMBIO_PASSWORD, type EstadoCambioPassword } from "@/types/sesion.types";

type Campo = "password_actual" | "password_nueva" | "confirmacion";
type Errores = Partial<Record<Campo, string>>;

/** Destino del primer ingreso y aviso del login: mismo parámetro en las dos pantallas. */
const DESTINO_PRIMER_INGRESO = "/home?contrasena=actualizada";
const DESTINO_SIN_SESION = "/login?contrasena=actualizada";

function primerError(errores: Extract<EstadoCambioPassword, { status: "error_validacion" }>["errores"]): Errores {
  return {
    password_actual: errores.password_actual?.[0],
    password_nueva: errores.password_nueva?.[0],
    confirmacion: errores.confirmacion?.[0],
  };
}

/**
 * Formulario de cambio de la propia contraseña (HU-A-06, spec_modulo_A.md
 * §2.6.6), compartido por `/primer-ingreso` y `/mi-cuenta`. En «Mi cuenta»
 * pide además la contraseña actual (P-A9).
 *
 * Valida en el cliente con el mismo schema que la Server Action y recién
 * entonces abre la confirmación de HU-C-25. Al confirmar invoca la acción
 * directamente (su firma es la de `useActionState`, igual que el alta de
 * profesor) porque `ConfirmarAccionDialog` necesita esperar el resultado: un
 * rechazo general se muestra dentro del diálogo y uno de campo, junto al
 * campo. Éxito: el primer ingreso navega a `/home` con el banner; «Mi
 * cuenta» muestra el banner inline. Si la sesión no se pudo reemitir, cierra
 * la sesión y lleva al login con el aviso de éxito.
 */
export function CambiarPasswordForm({
  modo,
  longitudMinima,
}: {
  modo: "primerIngreso" | "miCuenta";
  longitudMinima: number;
}) {
  const router = useRouter();
  const { setDirty } = useDirtyState();
  const formRef = useRef<HTMLFormElement>(null);
  const datosRef = useRef<FormData | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [confirmando, setConfirmando] = useState(false);
  const [exito, setExito] = useState(false);

  const pideActual = modo === "miCuenta";
  const schema = useMemo(() => construirCambiarPasswordSchema(longitudMinima), [longitudMinima]);

  function enfocar(campos: Errores) {
    const primero = (["password_actual", "password_nueva", "confirmacion"] as const).find((campo) => campos[campo]);
    if (primero) formRef.current?.querySelector<HTMLInputElement>(`[name="${primero}"]`)?.focus();
  }

  function mostrarErrores(campos: Errores) {
    setErrores(campos);
    enfocar(campos);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      password_actual: pideActual ? datos.get("password_actual") : undefined,
      password_nueva: datos.get("password_nueva"),
      confirmacion: datos.get("confirmacion"),
    });
    const campos: Errores = parsed.success ? {} : primerError(flattenError(parsed.error).fieldErrors);
    if (pideActual && !String(datos.get("password_actual") ?? "")) {
      campos.password_actual = texto("ui.sesion.formPassword.actualRequerida");
    }
    if (Object.values(campos).some(Boolean)) {
      mostrarErrores(campos);
      return; // no se abre la confirmación ni se envía nada
    }
    setErrores({});
    datosRef.current = datos;
    setConfirmando(true);
  }

  async function confirmar() {
    const resultado = await cambiarPasswordPropia(ESTADO_INICIAL_CAMBIO_PASSWORD, datosRef.current!);
    if (resultado.status === "error") throw new Error(resultado.mensaje);
    if (resultado.status === "error_validacion") {
      mostrarErrores(primerError(resultado.errores));
      return;
    }
    if (resultado.status !== "exito") return;

    setDirty(false);
    if (!resultado.sesion_conservada) {
      // El cambio ya está hecho pero esta sesión quedó revocada: se cierra
      // como en HU-A-03 y se informa el éxito en el login.
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } finally {
        // Navegación dura, como LogoutButton: descarta el estado del árbol autenticado.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = DESTINO_SIN_SESION;
      }
      return;
    }
    if (modo === "primerIngreso") {
      router.replace(DESTINO_PRIMER_INGRESO);
      return;
    }
    formRef.current?.reset();
    setExito(true);
  }

  const campo = (nombre: Campo, etiqueta: string, ayuda?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={nombre}>
        {etiqueta} <span aria-hidden="true" className="text-destructive">*</span>
      </Label>
      <Input
        id={nombre}
        name={nombre}
        type="password"
        autoComplete={nombre === "password_actual" ? "current-password" : "new-password"}
        aria-invalid={!!errores[nombre]}
        aria-describedby={[ayuda ? `${nombre}-ayuda` : null, errores[nombre] ? `${nombre}-error` : null].filter(Boolean).join(" ") || undefined}
      />
      {ayuda && (
        <p id={`${nombre}-ayuda`} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      )}
      {errores[nombre] && (
        <p id={`${nombre}-error`} className="text-sm text-destructive" role="alert">
          {errores[nombre]}
        </p>
      )}
    </div>
  );

  return (
    <>
      {exito && (
        <p role="status" className="mb-4 rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          {texto("ui.sesion.miCuenta.exito")}
        </p>
      )}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onChange={() => {
          setDirty(true);
          setExito(false);
        }}
        noValidate
        className="space-y-4"
      >
        {pideActual && campo("password_actual", texto("ui.sesion.formPassword.passwordActual"))}
        {campo(
          "password_nueva",
          texto("ui.sesion.formPassword.passwordNueva"),
          texto("ui.sesion.formPassword.ayudaPolitica", { minimo: longitudMinima }),
        )}
        {campo("confirmacion", texto("ui.sesion.formPassword.confirmacion"), texto("ui.sesion.formPassword.ayudaConfirmacion"))}
        <Button type="submit" className={modo === "primerIngreso" ? "w-full" : undefined}>
          {texto(modo === "primerIngreso" ? "ui.sesion.primerIngreso.enviar" : "ui.sesion.miCuenta.enviar")}
        </Button>
      </form>

      <ConfirmarAccionDialog
        abierto={confirmando}
        titulo={texto(modo === "primerIngreso" ? "ui.sesion.primerIngreso.confirmacion" : "ui.sesion.miCuenta.confirmacion")}
        textoConfirmar={texto("ui.sesion.formPassword.confirmar")}
        onConfirmar={confirmar}
        onCerrar={() => setConfirmando(false)}
      />
    </>
  );
}
