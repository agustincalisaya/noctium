"use server";

import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { auth, signIn } from "@/auth";
import { CredencialesLoginSchema } from "@/server/sesion/sesion.schema";
import type { EstadoLogin } from "@/types/sesion.types";

// Traducción código de servicio -> texto exacto para el usuario (spec_modulo_A.md §2.1).
// Vive acá, no en el servicio, para no acoplar la capa de negocio al copy de UI.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  CREDENCIALES_INVALIDAS: "Usuario o contraseña incorrectos",
  CUENTA_INACTIVA: "La cuenta está inactiva. Comunicate con la administración",
  RATE_LIMIT_EXCEDIDO: "Demasiados intentos. Esperá unos minutos e intentá nuevamente",
};

export async function iniciarSesion(
  _estadoAnterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const emailIngresado = String(formData.get("email") ?? "");
  const parsed = CredencialesLoginSchema.safeParse({
    email: emailIngresado,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error_validacion",
      errores: parsed.error.flatten().fieldErrors,
      email: emailIngresado,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const mensaje = MENSAJES_POR_CODIGO[error.code] ?? MENSAJES_POR_CODIGO.CREDENCIALES_INVALIDAS!;
      return { status: "error", mensaje, email: parsed.data.email };
    }
    // Error de comunicación/infraestructura: nunca un detalle técnico (criterio 6).
    return { status: "error_comunicacion", email: parsed.data.email };
  }

  const session = await auth();
  redirect(session?.user ? "/home" : "/login");
}
