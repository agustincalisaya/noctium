import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { texto } from "@/lib/textos";
import { obtenerDetalleIntegrante } from "@/server/personal/personal.service";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";
import { exigirPermiso } from "@/server/shared/with-permission";
import { IntegranteForm } from "../../integrante-form";

/**
 * Edición del integrante (P-46 modo edición, HU-F-01 c5): el mismo formulario
 * del alta, precargado, con el nombre como título. Se puede editar una ficha
 * inactiva (P-F6). Solo el Gerente (`personal:editar`).
 */
export default async function EditarIntegrantePage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso("personal:editar");
  const { id } = await params;

  let integrante;
  try {
    integrante = await obtenerDetalleIntegrante(id);
  } catch (error) {
    if (esErrorDeDominio(error, "errores.personal.noEncontrado")) notFound();
    throw error;
  }
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <Breadcrumb
        tramos={[
          { etiqueta: texto("ui.personal.listado.titulo"), href: "/personal" },
          { etiqueta: `${integrante.apellido}, ${integrante.nombre}`, href: `/personal/${integrante.id}` },
          { etiqueta: texto("ui.personal.ficha.editar") },
        ]}
      />
      {/* key: tras un conflicto de edición, «Recargar» trae una `version` nueva
          y el formulario se remonta con los datos actuales. */}
      <IntegranteForm
        key={integrante.version}
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
        titulo={`${integrante.nombre} ${integrante.apellido}`}
        integrante={{
          id: integrante.id,
          version: integrante.version,
          nombre: integrante.nombre,
          apellido: integrante.apellido,
          dni: integrante.dni,
          fechaNacimiento: integrante.fechaNacimiento,
          genero: integrante.genero,
          telefono: integrante.telefono,
          email: integrante.email,
        }}
      />
    </div>
  );
}
