import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { texto } from "@/lib/textos";
import { obtenerDetalleGerente } from "@/server/gerentes/gerente.service";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { getParametroNumerico } from "@/server/shared/parametros";
import { exigirPermiso } from "@/server/shared/with-permission";
import { GerenteForm } from "../../gerente-form";

/**
 * Edición del gerente (P-48 modo edición, HU-G-01 c4): el mismo formulario
 * del alta, precargado, con el nombre como título. Se puede editar una ficha
 * inactiva (P-G4) y la propia (DEC-44: `esVos` cambia el aviso del email).
 * Solo el Gerente (`gerentes:editar`).
 */
export default async function EditarGerentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sesionUsuarioId } = await exigirPermiso("gerentes:editar");
  const { id } = await params;

  let gerente;
  try {
    gerente = await obtenerDetalleGerente(id, sesionUsuarioId);
  } catch (error) {
    if (esErrorDeDominio(error, "errores.gerente.noEncontrado")) notFound();
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
          { etiqueta: texto("ui.gerentes.listado.titulo"), href: "/gerentes" },
          { etiqueta: `${gerente.apellido}, ${gerente.nombre}`, href: `/gerentes/${gerente.id}` },
          { etiqueta: texto("ui.gerentes.ficha.editar") },
        ]}
      />
      {/* key: tras un conflicto de edición, «Recargar» trae una `version` nueva
          y el formulario se remonta con los datos actuales. */}
      <GerenteForm
        key={gerente.version}
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
        titulo={`${gerente.nombre} ${gerente.apellido}`}
        gerente={{
          id: gerente.id,
          version: gerente.version,
          nombre: gerente.nombre,
          apellido: gerente.apellido,
          dni: gerente.dni,
          fechaNacimiento: gerente.fechaNacimiento,
          genero: gerente.genero,
          telefono: gerente.telefono,
          email: gerente.email,
          esVos: gerente.esVos,
        }}
      />
    </div>
  );
}
