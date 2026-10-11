import { redirect } from "next/navigation";
import { CambiarPasswordForm } from "@/components/sesion/cambiar-password-form";
import { LinkProtegido } from "@/components/sesion/link-protegido";
import { texto } from "@/lib/textos";
import { getParametroNumerico } from "@/server/shared/parametros";
import { RUTA_PRIMER_INGRESO } from "@/server/shared/rutas-por-rol";
import { exigirPermiso } from "@/server/shared/with-permission";
import { obtenerEstadoCuenta } from "@/server/usuarios/cuenta.service";

/**
 * «Mi cuenta» (HU-A-06, spec_modulo_A.md §2.6.6, P-05): los cuatro roles
 * cambian su contraseña con la actual, la nueva y la confirmación. Con la
 * marca todavía activa (valor de la base) corresponde el primer ingreso: el
 * proxy ya redirige con el token, y esto cubre el caso en que no lo haga.
 */
export default async function MiCuentaPage() {
  const { id } = await exigirPermiso("cuenta:cambiar_password");
  const cuenta = await obtenerEstadoCuenta(id);
  if (cuenta?.debe_cambiar_password) redirect(RUTA_PRIMER_INGRESO);

  const longitudMinima = await getParametroNumerico("password_longitud_minima", 8);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{texto("ui.sesion.miCuenta.titulo")}</h1>
        <p className="text-sm text-muted-foreground">{texto("ui.sesion.miCuenta.descripcion")}</p>
      </div>
      <section className="space-y-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-base font-semibold">{texto("ui.sesion.miCuenta.seccion")}</h2>
        <CambiarPasswordForm modo="miCuenta" longitudMinima={longitudMinima} />
        {/* HU-A-05 (cierra el criterio 4 de HU-A-06): respeta los cambios sin guardar. */}
        <p className="text-sm">
          <LinkProtegido href="/recuperar-contrasena" className="text-muted-foreground underline underline-offset-4">
            {texto("ui.sesion.recuperar.olvidaste")}
          </LinkProtegido>
        </p>
      </section>
    </div>
  );
}
