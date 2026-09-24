"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flattenError } from "zod";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enfocarPrimerCampoInvalido } from "@/lib/enfocar-primer-invalido";
import { construirAutorregistroAlumnoSchema } from "@/server/alumnos/alumno.schema";
import {
  iniciarAutorregistro as iniciarAutorregistroAction,
  confirmarCodigoAutorregistro as confirmarCodigoAction,
  reenviarCodigoAutorregistro as reenviarCodigoAction,
} from "./actions";

const MENSAJE_ERROR_COMUNICACION = "No se pudo conectar. Intentá nuevamente";
const MENSAJE_EXITO = "Tu cuenta fue creada correctamente";
const MENSAJE_DERIVADO =
  "No pudimos completar el registro en línea. Acercate a mesa de entrada para vincular tu cuenta.";

type CamposError = {
  nombre?: string;
  apellido?: string;
  dni?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  password?: string;
  confirmacion_password?: string;
  acepta_terminos?: string;
};

type Paso =
  | { tipo: "formulario" }
  | { tipo: "verificacion"; solicitudId: string; emailEnmascarado: string }
  | { tipo: "exito"; email: string }
  | { tipo: "derivado" };

type RequisitosPassword = { longitud: boolean; mayuscula: boolean; minuscula: boolean; numero: boolean };

function evaluarRequisitosPassword(password: string, longitudMinima: number): RequisitosPassword {
  return {
    longitud: password.length >= longitudMinima,
    mayuscula: /[A-Z]/.test(password),
    minuscula: /[a-z]/.test(password),
    numero: /[0-9]/.test(password),
  };
}

function RequisitoItem({ cumplido, children }: { cumplido: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5", cumplido ? "text-success-foreground" : "text-muted-foreground")}>
      {cumplido ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
      {children}
    </li>
  );
}

type RegistroFormProps = {
  dniLongitudMin: number;
  dniLongitudMax: number;
  passwordLongitudMinima: number;
  reenvioEsperaSegundos: number;
};

/**
 * Formulario de autorregistro (HU-B-08 §5). Reemplaza el stub de
 * `page.tsx`. Mismo patrón que `AlumnoForm`/`ContactoAlumnoForm` (HU-B-01/
 * 02): formulario no controlado salvo los campos que necesitan estado vivo
 * (contraseña, para el indicador de requisitos), validación de cliente con
 * el mismo schema que el servidor, invocación directa de la Server Action
 * dentro de un `try/catch` (sin `useActionState`), foco al primer campo
 * inválido, sin guardado parcial si la validación de cliente falla.
 *
 * Estados de la máquina (`Paso`): `formulario` → `verificacion` (rama b) o
 * `exito` (rama a) o `derivado` (rama d) — un solo componente, sin rutas
 * separadas, porque el `solicitud_id` y el email enmascarado solo existen
 * en memoria del cliente entre un paso y el otro.
 */
export function RegistroForm({
  dniLongitudMin,
  dniLongitudMax,
  passwordLongitudMinima,
  reenvioEsperaSegundos,
}: RegistroFormProps) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ tipo: "formulario" });

  const [password, setPassword] = useState("");
  const [confirmacionPassword, setConfirmacionPassword] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [errores, setErrores] = useState<CamposError>({});
  const [errorGeneral, setErrorGeneral] = useState<string | undefined>();

  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | undefined>();
  const [pendienteCodigo, setPendienteCodigo] = useState(false);
  const [pendienteReenvio, setPendienteReenvio] = useState(false);
  const [segundosParaReenviar, setSegundosParaReenviar] = useState(reenvioEsperaSegundos);

  const nombreRef = useRef<HTMLInputElement>(null);
  const apellidoRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmacionRef = useRef<HTMLInputElement>(null);
  const aceptaTerminosRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const requisitos = evaluarRequisitosPassword(password, passwordLongitudMinima);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  // Countdown del botón de reenvío — arranca al entrar al paso de
  // verificación y se reinicia tras cada reenvío exitoso.
  useEffect(() => {
    if (paso.tipo !== "verificacion" || segundosParaReenviar <= 0) return;
    const id = setTimeout(() => setSegundosParaReenviar((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [paso.tipo, segundosParaReenviar]);

  // Éxito -> redirige a /login con el email precompletado, en las dos
  // ramas (directa y post-verificación).
  useEffect(() => {
    if (paso.tipo !== "exito") return;
    const id = setTimeout(() => {
      router.push(`/login?email=${encodeURIComponent(paso.email)}`);
    }, 2000);
    return () => clearTimeout(id);
  }, [paso, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return; // evita envíos duplicados (doble clic / Enter repetido)

    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      dni: formData.get("dni"),
      fecha_nacimiento: formData.get("fecha_nacimiento"),
      telefono: formData.get("telefono"),
      email: formData.get("email"),
      password,
      confirmacion_password: confirmacionPassword,
      acepta_terminos: formData.get("acepta_terminos") === "on",
    };

    const parsed = construirAutorregistroAlumnoSchema(
      dniLongitudMin,
      dniLongitudMax,
      passwordLongitudMinima,
    ).safeParse(payload);

    if (!parsed.success) {
      const campos = flattenError(parsed.error).fieldErrors;
      const erroresCliente: CamposError = {
        nombre: campos.nombre?.[0],
        apellido: campos.apellido?.[0],
        dni: campos.dni?.[0],
        fecha_nacimiento: campos.fecha_nacimiento?.[0],
        telefono: campos.telefono?.[0],
        email: campos.email?.[0],
        password: campos.password?.[0],
        confirmacion_password: campos.confirmacion_password?.[0],
        acepta_terminos: campos.acepta_terminos?.[0],
      };
      setErrores(erroresCliente);
      setErrorGeneral(undefined);
      enfocarPrimerCampoInvalido(form, erroresCliente);
      return; // sin guardado parcial: no se envía nada al servidor
    }
    setErrores({});
    setErrorGeneral(undefined);
    setPendiente(true);

    try {
      // `payload` crudo, no `parsed.data`: el .safeParse() de arriba ya
      // TRANSFORMÓ fecha_nacimiento de string a Date (fechaCalendarioValidaSchema),
      // y el Server Action vuelve a correr el mismo schema server-side, que
      // espera el string original como entrada — mandar parsed.data rompía
      // con "Invalid input: expected string, received Date". Mismo criterio
      // que AlumnoForm, que manda los valores crudos de FormData sin pasar
      // por ningún parseo de cliente.
      const resultado = await iniciarAutorregistroAction(payload);

      if (!resultado.error) {
        if (resultado.data.via === "DIRECTO") {
          setPaso({ tipo: "exito", email: resultado.data.email });
        } else if (resultado.data.via === "VERIFICACION_REQUERIDA") {
          setSegundosParaReenviar(reenvioEsperaSegundos);
          setPaso({
            tipo: "verificacion",
            solicitudId: resultado.data.solicitud_id,
            emailEnmascarado: resultado.data.email_enmascarado,
          });
        } else {
          setPaso({ tipo: "derivado" });
        }
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
          telefono: campos.telefono?.[0],
          email: campos.email?.[0],
          password: campos.password?.[0],
          confirmacion_password: campos.confirmacion_password?.[0],
          acepta_terminos: campos.acepta_terminos?.[0],
        };
        setErrores(erroresServidor);
        enfocarPrimerCampoInvalido(form, erroresServidor);
        return;
      }

      // Cualquier código que no sea VALIDACION (DNI_DUPLICADO,
      // CUENTA_YA_EXISTE, RATE_LIMIT_EXCEDIDO, ERROR_INTERNO, cualquier
      // otro): criterio 8 de la HU — se limpian las contraseñas, se
      // conserva el resto de los datos ingresados (campos no controlados,
      // no se tocan solos).
      if (resultado.error.code === "DNI_DUPLICADO") {
        setErrores({ dni: resultado.error.message });
        dniRef.current?.focus();
      } else {
        // CUENTA_YA_EXISTE no se ata al campo email a propósito (criterio
        // 4, anti-enumeración: no señalar visualmente cuál dato coincidió
        // con una cuenta existente).
        setErrorGeneral(resultado.error.message);
      }
      setPassword("");
      setConfirmacionPassword("");
    } catch {
      setErrorGeneral(MENSAJE_ERROR_COMUNICACION);
      setPassword("");
      setConfirmacionPassword("");
    } finally {
      setPendiente(false);
    }
  }

  async function handleSubmitCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendienteCodigo || paso.tipo !== "verificacion") return;

    if (!/^\d{6}$/.test(codigo)) {
      setErrorCodigo("Ingresá los 6 dígitos del código");
      codigoRef.current?.focus();
      return;
    }
    setErrorCodigo(undefined);
    setPendienteCodigo(true);

    try {
      const resultado = await confirmarCodigoAction({ solicitud_id: paso.solicitudId, codigo });
      if (!resultado.error) {
        setPaso({ tipo: "exito", email: resultado.data.email });
        return;
      }
      setErrorCodigo(resultado.error.message);
      setCodigo("");
      codigoRef.current?.focus();
    } catch {
      setErrorCodigo(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setPendienteCodigo(false);
    }
  }

  async function handleReenviar() {
    if (paso.tipo !== "verificacion" || segundosParaReenviar > 0 || pendienteReenvio) return;
    setPendienteReenvio(true);
    setErrorCodigo(undefined);

    try {
      const resultado = await reenviarCodigoAction({ solicitud_id: paso.solicitudId });
      if (!resultado.error) {
        setSegundosParaReenviar(reenvioEsperaSegundos);
      } else {
        setErrorCodigo(resultado.error.message);
      }
    } catch {
      setErrorCodigo(MENSAJE_ERROR_COMUNICACION);
    } finally {
      setPendienteReenvio(false);
    }
  }

  if (paso.tipo === "exito") {
    return (
      <div className="space-y-4" role="status">
        <p className="rounded-md bg-success px-3 py-2 text-sm font-medium text-success-foreground">
          {MENSAJE_EXITO}
        </p>
        <p className="text-sm text-muted-foreground">Te estamos llevando a iniciar sesión...</p>
      </div>
    );
  }

  if (paso.tipo === "derivado") {
    return (
      <div className="space-y-4" role="status">
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">{MENSAJE_DERIVADO}</p>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  if (paso.tipo === "verificacion") {
    return (
      <form onSubmit={handleSubmitCodigo} noValidate className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Te enviamos un código de 6 dígitos a{" "}
          <span className="font-medium text-foreground">{paso.emailEnmascarado}</span>.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="codigo">Código de verificación</Label>
          <Input
            ref={codigoRef}
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            aria-invalid={!!errorCodigo}
            aria-describedby={errorCodigo ? "codigo-error" : undefined}
          />
          {errorCodigo && (
            <p id="codigo-error" className="text-sm text-destructive" role="alert">
              {errorCodigo}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pendienteCodigo}>
            {pendienteCodigo && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Confirmar código
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={segundosParaReenviar > 0 || pendienteReenvio}
            onClick={handleReenviar}
          >
            {pendienteReenvio && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {segundosParaReenviar > 0 ? `Reenviar código (${segundosParaReenviar}s)` : "Reenviar código"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
          aria-invalid={!!errores.nombre}
        />
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
          aria-invalid={!!errores.apellido}
        />
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
          aria-invalid={!!errores.fecha_nacimiento}
        />
        {errores.fecha_nacimiento && (
          <p className="text-sm text-destructive" role="alert">
            {errores.fecha_nacimiento}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email <span aria-hidden="true">*</span>
        </Label>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={!!errores.email}
        />
        {errores.email && (
          <p className="text-sm text-destructive" role="alert">
            {errores.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          ref={telefonoRef}
          id="telefono"
          name="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="Ej.: (0387) 15-412-3456"
          aria-invalid={!!errores.telefono}
        />
        <p className="text-xs text-muted-foreground">Opcional.</p>
        {errores.telefono && (
          <p className="text-sm text-destructive" role="alert">
            {errores.telefono}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          Contraseña <span aria-hidden="true">*</span>
        </Label>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errores.password}
          aria-describedby="requisitos-password"
        />
        <ul id="requisitos-password" className="space-y-0.5 text-xs">
          <RequisitoItem cumplido={requisitos.longitud}>
            Al menos {passwordLongitudMinima} caracteres
          </RequisitoItem>
          <RequisitoItem cumplido={requisitos.mayuscula}>Una mayúscula</RequisitoItem>
          <RequisitoItem cumplido={requisitos.minuscula}>Una minúscula</RequisitoItem>
          <RequisitoItem cumplido={requisitos.numero}>Un número</RequisitoItem>
        </ul>
        {errores.password && (
          <p className="text-sm text-destructive" role="alert">
            {errores.password}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmacion_password">
          Confirmación de contraseña <span aria-hidden="true">*</span>
        </Label>
        <Input
          ref={confirmacionRef}
          id="confirmacion_password"
          name="confirmacion_password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmacionPassword}
          onChange={(e) => setConfirmacionPassword(e.target.value)}
          aria-invalid={!!errores.confirmacion_password}
        />
        {errores.confirmacion_password && (
          <p className="text-sm text-destructive" role="alert">
            {errores.confirmacion_password}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <input
            ref={aceptaTerminosRef}
            id="acepta_terminos"
            name="acepta_terminos"
            type="checkbox"
            className={cn(
              "mt-0.5 size-4 shrink-0 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              errores.acepta_terminos && "border-destructive",
            )}
            aria-invalid={!!errores.acepta_terminos}
          />
          <Label htmlFor="acepta_terminos" className="text-sm font-normal">
            Acepto los{" "}
            {/* Sin página de términos todavía — link placeholder pendiente
                de contenido legal real (no se inventa acá). */}
            <a href="#" title="Pendiente" className="underline underline-offset-4">
              términos de uso y tratamiento de datos
            </a>
            .
          </Label>
        </div>
        {errores.acepta_terminos && (
          <p className="text-sm text-destructive" role="alert">
            {errores.acepta_terminos}
          </p>
        )}
      </div>

      {errorGeneral && (
        <p className="text-sm text-destructive" role="alert">
          {errorGeneral}
        </p>
      )}

      <Button type="submit" disabled={pendiente} className="w-full">
        {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
