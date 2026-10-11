import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { texto } from "@/lib/textos";

/**
 * Enlace vencido, usado, invalidado o inexistente (HU-A-05 criterio 3,
 * spec_modulo_A.md §2.7.2): reemplaza el formulario, al abrir la página o
 * cuando el servidor responde 410 al guardar (DESIGN.md §6.4).
 */
export function EnlaceInvalido() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{texto("ui.sesion.restablecer.invalidoTitulo")}</h1>
      <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{texto("errores.sesion.enlaceInvalido")}</span>
      </p>
      <div className="space-y-3 text-center text-sm">
        <p>
          <Link href="/recuperar-contrasena" className="font-medium underline underline-offset-4">
            {texto("ui.sesion.restablecer.pedirOtro")}
          </Link>
        </p>
        <p className="text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4">
            {texto("ui.sesion.recuperar.volverLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
