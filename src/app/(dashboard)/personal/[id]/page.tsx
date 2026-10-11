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
import { obtenerDetalleIntegrante } from "@/server/personal/personal.service";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import type { DetalleIntegrante } from "@/types/personal.types";
import { EstadoIntegranteDialog } from "./estado-integrante-dialog";
import { HistorialEstadosIntegrante } from "./historial-estados-integrante";

const GENERO_LEGIBLE: Record<string, string> = {
  MASCULINO: texto("ui.comun.genero.masculino"),
  FEMENINO: texto("ui.comun.genero.femenino"),
  OTRO: texto("ui.comun.genero.otro"),
  PREFIERO_NO_INDICARLO: texto("ui.comun.genero.prefieroNoIndicarlo"),
};

/** La ficha del integrante, o `notFound()` si no existe (INTEGRANTE_NO_ENCONTRADO). */
async function cargarIntegrante(id: string): Promise<DetalleIntegrante> {
  try {
    return await obtenerDetalleIntegrante(id);
  } catch (error) {
    if (esErrorDeDominio(error, "errores.personal.noEncontrado")) notFound();
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
 * Ficha del integrante en modo consulta (P-46, HU-F-01; HU-A-06 c5): datos en
 * solo lectura, fechas de alta y de última modificación, y «Cuenta de acceso»
 * con `CuentaAccesoCard`. «Editar» solo con `personal:editar`. HU-F-05 suma,
 * junto a «Editar», «Desactivar» o «Reactivar» solo con
 * `personal:cambiar_estado`, y el «Historial de estados» al lado de «Cuenta de
 * acceso». Los banners de vuelta siguen el patrón de las otras fichas:
 * `?creado=1` tras el alta y `?actualizada=1` tras editar.
 */
export default async function FichaIntegrantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPermiso("personal:leer");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const integrante = await cargarIntegrante(id);
  const [puedeEditar, puedeCambiarEstado] = await Promise.all([
    tienePermiso("personal:editar"),
    tienePermiso("personal:cambiar_estado"),
  ]);
  const ausente = texto("ui.personal.valorAusente");
  const nombreCompleto = `${integrante.nombre} ${integrante.apellido}`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 p-6">
      <Breadcrumb
        tramos={[
          { etiqueta: texto("ui.personal.listado.titulo"), href: "/personal" },
          { etiqueta: `${integrante.apellido}, ${integrante.nombre}` },
        ]}
      />

      {query.creado === "1" && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          {texto("ui.personal.alta.exito")}
        </p>
      )}
      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          {texto("ui.personal.edicion.exito")}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{nombreCompleto}</h1>
          {!integrante.activo && <Badge variant="muted">{texto("ui.personal.estado.inactivo")}</Badge>}
        </div>
        {(puedeEditar || puedeCambiarEstado) && (
          <div className="flex flex-wrap items-center gap-2">
            {puedeEditar && (
              <Link href={`/personal/${integrante.id}/editar`} className={buttonVariants({ variant: "outline" })}>
                <Pencil className="size-4" aria-hidden />
                {texto("ui.personal.ficha.editar")}
              </Link>
            )}
            {puedeCambiarEstado && (
              <EstadoIntegranteDialog
                integrante={{
                  id: integrante.id,
                  nombre: integrante.nombre,
                  apellido: integrante.apellido,
                  activo: integrante.activo,
                  version: integrante.version,
                  tieneCuenta: integrante.cuenta.estado !== "SIN_CUENTA",
                  cajaAbierta: integrante.cajaAbierta,
                  motivoObligatorio: integrante.motivoObligatorioAlDesactivar,
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Seccion titulo={texto("ui.personal.form.identidad")}>
          <Datos
            datos={[
              [texto("ui.personal.form.nombre"), integrante.nombre],
              [texto("ui.personal.form.apellido"), integrante.apellido],
              [texto("ui.personal.form.dni"), integrante.dni],
              [texto("ui.personal.form.fechaNacimiento"), fechaCorta(integrante.fechaNacimiento)],
              [
                texto("ui.personal.form.genero"),
                integrante.genero ? GENERO_LEGIBLE[integrante.genero] ?? integrante.genero : texto("ui.comun.genero.sinEspecificar"),
              ],
            ]}
          />
        </Seccion>
        <Seccion titulo={texto("ui.personal.form.contacto")}>
          <Datos
            datos={[
              [texto("ui.personal.form.email"), integrante.email],
              [texto("ui.personal.form.telefono"), integrante.telefono ?? ausente],
            ]}
          />
        </Seccion>
      </div>

      <Seccion titulo={texto("ui.personal.ficha.registro")}>
        <Datos
          datos={[
            [texto("ui.personal.ficha.fechaAlta"), fechaHoraDeInstante(integrante.creadoEl.toISOString())],
            [
              texto("ui.personal.ficha.ultimaModificacion"),
              integrante.modificadoEl ? fechaHoraDeInstante(integrante.modificadoEl.toISOString()) : texto("ui.personal.ficha.sinCambios"),
            ],
          ]}
        />
      </Seccion>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <CuentaAccesoCard cuenta={integrante.cuenta} />
        <HistorialEstadosIntegrante historial={integrante.historialEstados} />
      </div>
    </div>
  );
}
