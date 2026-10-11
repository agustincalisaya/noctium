"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { texto } from "@/lib/textos";
import { solicitarRecuperacion } from "@/server/sesion/actions";
import { MINUTOS_VALIDEZ_ENLACE_RECUPERACION } from "@/server/sesion/recuperacion.constantes";
import { SolicitarRecuperacionSchema } from "@/server/sesion/sesion.schema";
import { ESTADO_INICIAL_SOLICITUD_RECUPERACION, type EstadoSolicitudRecuperacion } from "@/types/sesion.types";

/**
 * Pedido del enlace de recuperación (HU-A-05, spec_modulo_A.md §2.7.1 y
 * §2.7.6, figuras 88 y 89). Valida en el cliente con el mismo schema que la
 * Server Action y la invoca directamente, sin `useActionState`, como el login:
 * así una falla de transporte se muestra como error de comunicación en vez de
 * romper la pantalla. Con la respuesta uniforme, la misma tarjeta pasa a
 * «Revisá tu email» (DESIGN.md §6.4).
 */
export function RecuperarPasswordForm() {
  const [estado, setEstado] = useState<EstadoSolicitudRecuperacion>(ESTADO_INICIAL_SOLICITUD_RECUPERACION);
  const [pendiente, setPendiente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string>();
  const emailRef = useRef<HTMLInputElement>(null);
  const tituloEnviadaRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (estado.status === "enviada") tituloEnviadaRef.current?.focus();
  }, [estado.status]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // sin envíos duplicados

    const formData = new FormData(e.currentTarget);
    const parsed = SolicitarRecuperacionSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) {
      setErrorCliente(parsed.error.flatten().fieldErrors.email?.[0]);
      emailRef.current?.focus();
      return;
    }
    setErrorCliente(undefined);
    setPendiente(true);

    try {
      const resultado = await solicitarRecuperacion(estado, formData);
      setEstado(resultado);
      if (resultado.status === "error_validacion") emailRef.current?.focus();
    } catch {
      setEstado({ status: "error", mensaje: texto("ui.sesion.formPassword.errorComunicacion") });
    } finally {
      setPendiente(false);
    }
  }

  const volverLogin = (
    <p className="text-center text-sm text-muted-foreground">
      <Link href="/login" className="underline underline-offset-4">
        {texto("ui.sesion.recuperar.volverLogin")}
      </Link>
    </p>
  );

  if (estado.status === "enviada") {
    return (
      <div className="space-y-5">
        <h1 ref={tituloEnviadaRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          {texto("ui.sesion.recuperar.enviadaTitulo")}
        </h1>
        <p role="status" className="flex items-start gap-2 rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{texto("ui.sesion.recuperar.enviadaMensaje")}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {texto("ui.sesion.recuperar.enviadaNota", { minutos: MINUTOS_VALIDEZ_ENLACE_RECUPERACION })}
        </p>
        {volverLogin}
      </div>
    );
  }

  const errorEmail = errorCliente ?? (estado.status === "error_validacion" ? estado.errores.email?.[0] : undefined);
  const errorGeneral = estado.status === "error" ? estado.mensaje : undefined;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{texto("ui.sesion.recuperar.titulo")}</h1>
        <p className="text-sm text-muted-foreground">{texto("ui.sesion.recuperar.descripcion")}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{texto("ui.sesion.recuperar.email")}</Label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={!!errorEmail}
            aria-describedby={errorEmail ? "email-error" : undefined}
          />
          {errorEmail && (
            <p id="email-error" className="text-sm text-destructive" role="alert">
              {errorEmail}
            </p>
          )}
        </div>

        {errorGeneral && (
          <p className="text-sm text-destructive" role="alert">
            {errorGeneral}
          </p>
        )}

        <Button type="submit" disabled={pendiente} className="w-full">
          {pendiente && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {texto("ui.sesion.recuperar.enviar")}
        </Button>
      </form>

      {volverLogin}
    </div>
  );
}
