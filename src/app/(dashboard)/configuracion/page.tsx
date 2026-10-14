import { exigirPermiso } from "@/server/shared/with-permission";
import { ConfiguracionForm } from "@/app/(dashboard)/configuracion/configuracion-form";

export default async function ConfiguracionPage() {
  await exigirPermiso("configuracion:leer");
  return <ConfiguracionForm />;
}
