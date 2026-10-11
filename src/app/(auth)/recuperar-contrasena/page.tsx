import { TarjetaSesionPublica } from "@/components/sesion/tarjeta-sesion-publica";
import { RecuperarPasswordForm } from "./recuperar-password-form";

/**
 * «¿Olvidaste tu contraseña?» (HU-A-05, spec_modulo_A.md §2.7.6, P-02,
 * figuras 88 y 89). Pública: no exige sesión y, a diferencia del login, no
 * redirige si hay una abierta, porque «Mi cuenta» enlaza acá (decisión 10).
 */
export default function RecuperarContrasenaPage() {
  return (
    <TarjetaSesionPublica>
      <RecuperarPasswordForm />
    </TarjetaSesionPublica>
  );
}
