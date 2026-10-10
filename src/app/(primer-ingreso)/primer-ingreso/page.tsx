import { redirect } from "next/navigation";
import { CambiarPasswordForm } from "@/components/sesion/cambiar-password-form";
import { texto } from "@/lib/textos";
import { getParametroNumerico } from "@/server/shared/parametros";
import { exigirPermiso } from "@/server/shared/with-permission";
import { obtenerEstadoCuenta } from "@/server/usuarios/cuenta.service";

/**
 * Primer ingreso (HU-A-06, spec_modulo_A.md §2.6.6, P-04): definir la
 * contraseña nueva antes de cualquier otra pantalla. `cuenta:cambiar_password`
 * es de las pocas acciones que la marca admite (§3.6). Sin la marca —valor de
 * la base, no del token— no hay nada que hacer acá: va a la pantalla inicial.
 */
export default async function PrimerIngresoPage() {
  const { id } = await exigirPermiso("cuenta:cambiar_password");
  const cuenta = await obtenerEstadoCuenta(id);
  if (!cuenta?.debe_cambiar_password) redirect("/home");

  const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{texto("ui.sesion.primerIngreso.titulo")}</h1>
        <p className="text-sm text-muted-foreground">{texto("ui.sesion.primerIngreso.descripcion")}</p>
        <p className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
          {texto("ui.sesion.primerIngreso.aviso")}
        </p>
      </div>
      <CambiarPasswordForm modo="primerIngreso" longitudMinima={longitudMinima} />
    </div>
  );
}
