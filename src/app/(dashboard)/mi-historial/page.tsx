import { exigirPermiso } from "@/server/shared/with-permission";
import { MiHistorial } from "./mi-historial";
export default async function MiHistorialPage() {
  await exigirPermiso("historial:leer_propio");
  return <MiHistorial />;
}
