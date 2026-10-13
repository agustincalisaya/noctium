import { Breadcrumb } from "@/components/shared/breadcrumb";
import { texto } from "@/lib/textos";
import { getParametroNumerico } from "@/server/shared/parametros";
import { exigirPermiso } from "@/server/shared/with-permission";
import { GerenteForm } from "../gerente-form";

/**
 * Alta de un gerente (P-48 modo alta, HU-G-01; prototipo figura 95). La
 * longitud del DNI sale de `ParametroSistema`, igual que en la Server Action y
 * en la ruta. Solo el Gerente (`gerentes:crear`).
 */
export default async function NuevoGerentePage() {
  await exigirPermiso("gerentes:crear");
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <Breadcrumb
        tramos={[
          { etiqueta: texto("ui.gerentes.listado.titulo"), href: "/gerentes" },
          { etiqueta: texto("ui.gerentes.alta.titulo") },
        ]}
      />
      <GerenteForm
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
        titulo={texto("ui.gerentes.alta.titulo")}
        bajada={texto("ui.gerentes.alta.bajada")}
      />
    </div>
  );
}
