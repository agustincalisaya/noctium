import { exigirPermiso } from "@/server/shared/with-permission";
import { MisPagos } from "./mis-pagos";

/** «Mis pagos» del alumno (HU-I-05, spec_modulo_I.md §2.15): solo consulta. */
export default async function MisPagosPage() {
  await exigirPermiso("pagos:leer_propios");
  return <MisPagos />;
}
