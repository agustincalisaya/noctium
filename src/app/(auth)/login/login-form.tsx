"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredencialesLoginSchema } from "@/server/sesion/sesion.schema";
import { iniciarSesion } from "@/server/sesion/actions";
import { ESTADO_INICIAL, type EstadoLogin } from "@/types/sesion.types";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";

export function LoginForm({ emailInicial }: { emailInicial?: string } = {}) {
  // No se usa useActionState/<form action>: cuando el fetch que invoca el
  // Server Action falla en el transporte (sin red, sin respuesta), ese
  // mecanismo no lo representa como estado — se escapa como una excepción no
  // controlada y tira abajo la UI. Se invoca la action directamente y se
  // envuelve en try/catch para poder mostrar el criterio 6 ("No se pudo
  // conectar...") en ese caso.
  const [estado, setEstado] = useState<EstadoLogin>(ESTADO_INICIAL);
  const [pendiente, setPendiente] = useState(false);
  const [erroresCliente, setErroresCliente] = useState<{ email?: string; password?: string }>({});
  const [mostrarPassword, setMostrarPassword] = useState(false);
  // HU-B-08: precarga tras crear la cuenta por autorregistro (?email= en
  // login/page.tsx) — único cambio de este componente para esa HU.
  const [email, setEmail] = useState(emailInicial ?? "");
  const [intentoId, setIntentoId] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const formData = new FormData(e.currentTarget);
    const parsed = CredencialesLoginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      const campos = parsed.error.flatten().fieldErrors;
      setErroresCliente({ email: campos.email?.[0], password: campos.password?.[0] });
      return;
    }
    setErroresCliente({});
    setPendiente(true);

    try {
      const resultado = await iniciarSesion(estado, formData);
      setEstado(resultado);
      if (resultado.status !== "idle") setEmail(resultado.email);
      setIntentoId((n) => n + 1);
    } catch (error) {
      // El redirect() del Server Action (login exitoso) se propaga como una
      // señal de control interna de Next.js, no como un error real — dejarla
      // pasar antes de tratar el resto como falla de comunicación.
      unstable_rethrow(error);
      setEstado({ status: "error_comunicacion", email: parsed.data.email });
      setIntentoId((n) => n + 1);
    } finally {
      setPendiente(false);
    }
  }

  const errorEmail =
    erroresCliente.email ??
    (estado.status === "error_validacion" ? estado.errores.email?.[0] : undefined);
  const errorPassword =
    erroresCliente.password ??
    (estado.status === "error_validacion" ? estado.errores.password?.[0] : undefined);
  const mensajeError =
    estado.status === "error"
      ? estado.mensaje
      : estado.status === "error_comunicacion"
        ? MENSAJE_ERROR_COMUNICACION
        : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errorEmail}
        />
        {errorEmail && (
          <p className="text-sm text-destructive" role="alert">
            {errorEmail}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          {/* key={intentoId}: cada intento fallido remonta el campo para
              vacíar la contraseña (criterio 4/5) sin controlar su value. */}
          <Input
            key={intentoId}
            id="password"
            name="password"
            type={mostrarPassword ? "text" : "password"}
            autoComplete="current-password"
            defaultValue=""
            aria-invalid={!!errorPassword}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setMostrarPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
            aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {mostrarPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errorPassword && (
          <p className="text-sm text-destructive" role="alert">
            {errorPassword}
          </p>
        )}
      </div>

      {mensajeError && (
        <p className="text-sm text-destructive" role="alert">
          {mensajeError}
        </p>
      )}

      <Button 
        type="submit" 
        disabled={pendiente} 
        className="w-full bg-gradient-to-tr from-cyan-800 to-cyan-500 text-white hover:opacity-90"
      >
        {pendiente && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
        Iniciar sesión
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/registro" className="underline underline-offset-4">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
