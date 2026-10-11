"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { flattenError } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { texto } from "@/lib/textos";
import { restablecerPassword } from "@/server/sesion/actions";
import { construirRestablecerPasswordSchema } from "@/server/sesion/sesion.schema";
import { ESTADO_INICIAL_RESTABLECER_PASSWORD } from "@/types/sesion.types";
import { EnlaceInvalido } from "./enlace-invalido";

type Campo = "password_nueva" | "confirmacion";
type Errores = Partial<Record<Campo, string>>;

/** Mismo aviso que usa HU-A-06 cuando la contraseña cambió sin sesión. */
const DESTINO_EXITO = "/login?contrasena=actualizada";

/**
 * Contraseña nueva con el enlace de recuperación (HU-A-05, spec_modulo_A.md
 * §2.7.3 y §2.7.6, figura 90). Valida en el cliente con el mismo schema que
 * la Server Action y recién entonces abre la confirmación de HU-C-25. Al
 * confirmar invoca la acción directamente, porque `ConfirmarAccionDialog`
 * espera el resultado:
 *  - un error general se muestra dentro del diálogo;
 *  - «igual a la anterior» (422), junto al campo: el enlace sigue valiendo;
 *  - enlace inválido (410), la tarjeta pasa al mensaje de enlace inválido;
 *  - éxito: cierra cualquier sesión abierta en este navegador (ya quedó
 *    revocada, decisión 10) y va al login con el aviso de éxito.
 */
export function RestablecerPasswordForm({ token, longitudMinima }: { token: string; longitudMinima: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const datosRef = useRef<FormData | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [confirmando, setConfirmando] = useState(false);
  const [invalido, setInvalido] = useState(false);

  const schema = useMemo(() => construirRestablecerPasswordSchema(longitudMinima), [longitudMinima]);

  function mostrarErrores(campos: Errores) {
    setErrores(campos);
    const primero = (["password_nueva", "confirmacion"] as const).find((campo) => campos[campo]);
    if (primero) formRef.current?.querySelector<HTMLInputElement>(`[name="${primero}"]`)?.focus();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmando) return;
    const datos = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      token: datos.get("token"),
      password_nueva: datos.get("password_nueva"),
      confirmacion: datos.get("confirmacion"),
    });
    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      if (campos.token) {
        setInvalido(true);
        return;
      }
      mostrarErrores({ password_nueva: campos.password_nueva?.[0], confirmacion: campos.confirmacion?.[0] });
      return; // no se abre la confirmación ni se envía nada
    }
    setErrores({});
    datosRef.current = datos;
    setConfirmando(true);
  }

  async function confirmar() {
    let resultado;
    try {
      resultado = await restablecerPassword(ESTADO_INICIAL_RESTABLECER_PASSWORD, datosRef.current!);
    } catch {
      throw new Error(texto("ui.sesion.formPassword.errorComunicacion"));
    }
    if (resultado.status === "error") throw new Error(resultado.mensaje);
    if (resultado.status === "error_validacion") {
      mostrarErrores({ password_nueva: resultado.errores.password_nueva?.[0], confirmacion: resultado.errores.confirmacion?.[0] });
      return;
    }
    if (resultado.status === "enlace_invalido") {
      setInvalido(true);
      return;
    }
    if (resultado.status !== "exito") return;

    try {
      // Tolera que no haya sesión: logout responde 200 igual (HU-A-03).
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Sin red, el cambio ya está hecho: se informa igual en el login.
    }
    // Navegación dura, como LogoutButton: descarta cualquier estado autenticado.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = DESTINO_EXITO;
  }

  if (invalido) return <EnlaceInvalido />;

  const campo = (nombre: Campo, etiqueta: string, ayuda?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={nombre}>
        {etiqueta} <span aria-hidden="true" className="text-destructive">*</span>
      </Label>
      <Input
        id={nombre}
        name={nombre}
        type="password"
        autoComplete="new-password"
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
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{texto("ui.sesion.restablecer.titulo")}</h1>
        <p className="text-sm text-muted-foreground">{texto("ui.sesion.restablecer.descripcion")}</p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {campo(
          "password_nueva",
          texto("ui.sesion.formPassword.passwordNueva"),
          texto("ui.sesion.formPassword.ayudaPolitica", { minimo: longitudMinima }),
        )}
        {campo("confirmacion", texto("ui.sesion.formPassword.confirmacion"), texto("ui.sesion.formPassword.ayudaConfirmacion"))}
        <Button type="submit" disabled={confirmando} className="w-full">
          {texto("ui.sesion.restablecer.guardar")}
        </Button>
      </form>

      <ConfirmarAccionDialog
        abierto={confirmando}
        titulo={texto("ui.sesion.primerIngreso.confirmacion")}
        textoConfirmar={texto("ui.sesion.formPassword.confirmar")}
        onConfirmar={confirmar}
        onCerrar={() => setConfirmando(false)}
      />
    </div>
  );
}
