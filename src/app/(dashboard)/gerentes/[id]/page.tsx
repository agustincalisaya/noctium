import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { CuentaAccesoCard } from "@/components/shared/cuenta-acceso-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fueActualizada } from "@/lib/modo-edicion";
import { texto } from "@/lib/textos";
import { fechaCorta, fechaHoraDeInstante } from "@/lib/turno-detalle";
import { obtenerDetalleGerente } from "@/server/gerentes/gerente.service";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import type { DetalleGerente } from "@/types/gerente.types";

const GENERO_LEGIBLE: Record<string, string> = {
  MASCULINO: texto("ui.comun.genero.masculino"),
  FEMENINO: texto("ui.comun.genero.femenino"),
  OTRO: texto("ui.comun.genero.otro"),
  PREFIERO_NO_INDICARLO: texto("ui.comun.genero.prefieroNoIndicarlo"),
};

/** La ficha del gerente, o `notFound()` si no existe (GERENTE_NO_ENCONTRADO). */
async function cargarGerente(id: string, sesionUsuarioId: string): Promise<DetalleGerente> {
  try {
    return await obtenerDetalleGerente(id, sesionUsuarioId);
  } catch (error) {
    if (esErrorDeDominio(error, "errores.gerente.noEncontrado")) notFound();
    throw error;
  }
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-5 text-card-foreground">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Datos({ datos }: { datos: [etiqueta: string, valor: string][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {datos.map(([etiqueta, valor]) => (
        <div className="min-w-0" key={etiqueta}>
          <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
          <dd className="break-words font-medium">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Ficha del gerente en modo consulta (P-48, HU-G-01; HU-A-06 c5): datos en
 * solo lectura, fechas de alta y de última modificación, y «Cuenta de acceso»
 * con `CuentaAccesoCard`. «Editar» solo con `gerentes:editar`. No ofrece
 * «Desactivar» ni «Reactivar» ni muestra historial de estados (HU-G-05). Los
 * banners de vuelta siguen el patrón de las otras fichas: `?creado=1` tras el
 * alta y `?actualizada=1` tras editar.
 */
export default async function FichaGerentePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: sesionUsuarioId } = await exigirPermiso("gerentes:leer");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const gerente = await cargarGerente(id, sesionUsuarioId);
  const puedeEditar = await tienePermiso("gerentes:editar");
  const ausente = texto("ui.gerentes.valorAusente");

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 p-6">
      <Breadcrumb
        tramos={[
          { etiqueta: texto("ui.gerentes.listado.titulo"), href: "/gerentes" },
          { etiqueta: `${gerente.apellido}, ${gerente.nombre}` },
        ]}
      />

      {query.creado === "1" && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          {texto("ui.gerentes.alta.exito")}
        </p>
      )}
      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          {texto("ui.gerentes.edicion.exito")}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{`${gerente.nombre} ${gerente.apellido}`}</h1>
          {!gerente.activo && <Badge variant="muted">{texto("ui.gerentes.estado.inactivo")}</Badge>}
        </div>
        {puedeEditar && (
          <Link href={`/gerentes/${gerente.id}/editar`} className={buttonVariants({ variant: "outline" })}>
            <Pencil className="size-4" aria-hidden />
            {texto("ui.gerentes.ficha.editar")}
          </Link>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Seccion titulo={texto("ui.gerentes.form.identidad")}>
          <Datos
            datos={[
              [texto("ui.gerentes.form.nombre"), gerente.nombre],
              [texto("ui.gerentes.form.apellido"), gerente.apellido],
              [texto("ui.gerentes.form.dni"), gerente.dni],
              [texto("ui.gerentes.form.fechaNacimiento"), fechaCorta(gerente.fechaNacimiento)],
              [
                texto("ui.gerentes.form.genero"),
                gerente.genero ? GENERO_LEGIBLE[gerente.genero] ?? gerente.genero : texto("ui.comun.genero.sinEspecificar"),
              ],
            ]}
          />
        </Seccion>
        <Seccion titulo={texto("ui.gerentes.form.contacto")}>
          <Datos
            datos={[
              [texto("ui.gerentes.form.email"), gerente.email],
              [texto("ui.gerentes.form.telefono"), gerente.telefono ?? ausente],
            ]}
          />
        </Seccion>
      </div>

      <Seccion titulo={texto("ui.gerentes.ficha.registro")}>
        <Datos
          datos={[
            [texto("ui.gerentes.ficha.fechaAlta"), fechaHoraDeInstante(gerente.creadoEl.toISOString())],
            [
              texto("ui.gerentes.ficha.ultimaModificacion"),
              gerente.modificadoEl ? fechaHoraDeInstante(gerente.modificadoEl.toISOString()) : texto("ui.gerentes.ficha.sinCambios"),
            ],
          ]}
        />
      </Seccion>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <CuentaAccesoCard cuenta={gerente.cuenta} />
      </div>
    </div>
  );
}
