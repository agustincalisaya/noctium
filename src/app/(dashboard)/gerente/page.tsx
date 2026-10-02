import { exigirPermiso } from "@/server/shared/with-permission";
import { IndicadoresClient } from "./indicadores-client";

/** Pantalla "Indicadores" del Gerente (spec_modulo_H.md §2.2 y §2.3): permiso granular, no rol (Regla N.° 10). */
export default async function GerentePage() {
  await exigirPermiso("indicadores:leer");

  return <IndicadoresClient />;
}
