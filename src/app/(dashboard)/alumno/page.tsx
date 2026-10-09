import Link from "next/link";
import { texto as textoUi } from "@/lib/textos";
import type { ReactNode } from "react";
import { CalendarPlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exigirPermiso } from "@/server/shared/with-permission";
import { listarTurnosPropios } from "@/server/turnos/turno.service";
import { MisTurnosQuerySchema } from "@/server/turnos/turno.schema";

type TurnoPropio = Awaited<ReturnType<typeof listarTurnosPropios>>["items"][number];
type Vista = "proximos" | "anteriores";

export default async function AlumnoPage({
  searchParams,
}: {
  searchParams: Promise<{ inscripcion?: string; vista?: string; pagina?: string }>;
}) {
  const usuario = await exigirPermiso("turnos:leer_propios");
  const params = await searchParams;
  const parsed = MisTurnosQuerySchema.safeParse({ vista: params.vista, pagina: params.pagina });
  const query = parsed.success ? parsed.data : MisTurnosQuerySchema.parse({});
  const turnos = await listarTurnosPropios(query, usuario.id);
  const inscripcionExitosa = params.inscripcion === "exitosa";

  const crearHref = (vista: Vista, pagina: number) => {
    const queryString = new URLSearchParams({ vista, pagina: String(pagina) });
    if (inscripcionExitosa) queryString.set("inscripcion", "exitosa");
    return `/alumno?${queryString.toString()}`;
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 py-4 sm:py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mis turnos</h1>
          <p className="text-muted-foreground">Los turnos en los que estás inscripta, incluidos los cancelados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link href="/mi-historial" className={buttonVariants({ variant: "outline" })}>{textoUi("ui.historial.propio.titulo")}</Link>
        <Link href="/alumno/turnos/solicitar" className={buttonVariants({ className: "shrink-0 self-start" })}>
          <CalendarPlus2 className="size-4" aria-hidden />
          Solicitar turno
        </Link>
        </div>
      </header>

      {inscripcionExitosa && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-success p-4 text-success-foreground">
          <CalendarPlus2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Te inscribiste correctamente</p>
            <p className="mt-1 text-sm">El pago se abona en el centro</p>
          </div>
        </div>
      )}

      <nav aria-label="Turnos por fecha" className="flex gap-6 border-b border-border">
        <Link
          href={crearHref("proximos", 1)}
          aria-current={query.vista === "proximos" ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            query.vista === "proximos"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Próximos <span className="tabular-nums">({turnos.totales.proximos})</span>
        </Link>
        <Link
          href={crearHref("anteriores", 1)}
          aria-current={query.vista === "anteriores" ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            query.vista === "anteriores"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Anteriores <span className="tabular-nums">({turnos.totales.anteriores})</span>
        </Link>
      </nav>

      {turnos.items.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label={query.vista === "proximos" ? "Turnos próximos" : "Turnos anteriores"}>
            {turnos.items.map((turno) => (
              <li key={turno.turno_id}>
                <TarjetaTurno turno={turno} vista={query.vista} />
              </li>
            ))}
          </ul>
          <PaginacionTurnos
            pagina={turnos.paginacion.pagina_actual}
            totalPaginas={turnos.paginacion.total_paginas}
            total={turnos.paginacion.total}
            cantidad={turnos.items.length}
            href={(pagina) => crearHref(query.vista, pagina)}
          />
        </>
      ) : turnos.paginacion.total > 0 ? (
        <div role="status" className="rounded-xl border border-border bg-card p-5 text-sm">
          <p className="text-muted-foreground">No hay turnos en esta página.</p>
          <Link className="mt-2 inline-flex font-medium text-primary underline underline-offset-4" href={crearHref(query.vista, 1)}>
            Volver a la primera página
          </Link>
        </div>
      ) : query.vista === "proximos" ? (
        <div role="status" className="rounded-xl border border-border bg-card p-6">
          <p className="font-medium">Todavía no tenés turnos.</p>
          <Link href="/alumno/turnos/solicitar" className="mt-2 inline-flex font-medium text-primary underline underline-offset-4">
            Solicitá uno desde acá
          </Link>
        </div>
      ) : (
        <p role="status" className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          No tenés turnos anteriores.
        </p>
      )}
    </section>
  );
}

function TarjetaTurno({ turno, vista }: { turno: TurnoPropio; vista: Vista }) {
  const cancelado = turno.estado === "CANCELADO";
  const tarjetaCanceladaProxima = cancelado && vista === "proximos";
  const tarjetaCanceladaAnterior = cancelado && vista === "anteriores";

  return (
    <article
      className={cn(
        "flex min-h-32 items-center gap-5 rounded-xl border p-5 sm:p-6",
        tarjetaCanceladaProxima && "border-destructive bg-destructive-soft text-destructive-soft-foreground",
        tarjetaCanceladaAnterior && "border-border bg-muted/60 text-muted-foreground",
        !cancelado && "border-border bg-card text-card-foreground",
      )}
    >
      <FechaTurno fecha={turno.fecha} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold leading-snug">{turno.materia}</h2>
          <EstadoBadge estado={turno.estado} />
          {vista === "anteriores" && turno.clase_dictada && (
            <Badge variant="outline" className="bg-card font-normal text-card-foreground">Clase dictada</Badge>
          )}
        </div>
        <p className="text-sm tabular-nums">
          <time>{turno.hora_inicio}–{turno.hora_fin}</time>
          <span aria-hidden> · </span>{turno.profesor}
          <span aria-hidden> · </span>{turno.aula}
        </p>
      </div>
    </article>
  );
}

function FechaTurno({ fecha }: { fecha: string }) {
  const date = new Date(`${fecha}T00:00:00.000Z`);
  const partes = new Intl.DateTimeFormat("es-AR", {
    weekday: "short", month: "short", timeZone: "UTC",
  }).formatToParts(date);
  const diaSemana = partes.find((parte) => parte.type === "weekday")?.value.replace(/\.$/, "") ?? "";
  const mes = partes.find((parte) => parte.type === "month")?.value.replace(/\.$/, "") ?? "";
  const fechaLarga = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(date);

  return (
    <time
      dateTime={fecha}
      aria-label={fechaLarga}
      className="flex size-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground"
    >
      <span className="text-[0.65rem] font-medium uppercase tracking-wide">{diaSemana}</span>
      <span className="text-2xl font-semibold leading-none tabular-nums">{Number(fecha.slice(8, 10))}</span>
      <span className="text-[0.65rem] font-medium uppercase tracking-wide">{mes}</span>
    </time>
  );
}

function EstadoBadge({ estado }: { estado: TurnoPropio["estado"] }) {
  if (estado === "CANCELADO") {
    return <Badge variant="outline" className="border-destructive bg-card text-destructive">Cancelado</Badge>;
  }
  const variant = estado === "DISPONIBLE" ? "success" : estado === "PENDIENTE" ? "warning" : "default";
  const texto = estado === "DISPONIBLE" ? "Disponible" : estado === "PENDIENTE" ? "Pendiente" : "Completo";
  return <Badge variant={variant}>{texto}</Badge>;
}

function PaginacionTurnos({
  pagina,
  totalPaginas,
  total,
  cantidad,
  href,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  cantidad: number;
  href: (pagina: number) => string;
}) {
  if (total <= 10 || totalPaginas <= 1) return null;
  const inicio = (pagina - 1) * 10 + 1;
  const fin = inicio + cantidad - 1;
  const paginas = paginasVisibles(pagina, totalPaginas);

  return (
    <nav aria-label="Paginación de turnos" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">
        Mostrando <span className="tabular-nums">{inicio}–{fin}</span> de <span className="tabular-nums">{total}</span>
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <EnlacePagina href={pagina > 1 ? href(pagina - 1) : null} ariaLabel="Página anterior">Anterior</EnlacePagina>
        {paginas.map((numero, indice) => typeof numero === "number" ? (
          <Link
            key={numero}
            href={href(numero)}
            aria-label={`Página ${numero}`}
            aria-current={pagina === numero ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: pagina === numero ? "default" : "outline", size: "sm" }),
              "min-w-9 tabular-nums",
            )}
          >
            {numero}
          </Link>
        ) : <span key={`${numero}-${indice}`} aria-hidden className="px-1 text-muted-foreground">…</span>)}
        <EnlacePagina href={pagina < totalPaginas ? href(pagina + 1) : null} ariaLabel="Página siguiente">Siguiente</EnlacePagina>
      </div>
    </nav>
  );
}

function paginasVisibles(actual: number, total: number): Array<number | "ellipsis"> {
  const visibles = new Set([1, total]);
  for (let pagina = actual - 1; pagina <= actual + 1; pagina++) {
    if (pagina >= 1 && pagina <= total) visibles.add(pagina);
  }
  if (actual <= 3) [2, 3].forEach((pagina) => pagina <= total && visibles.add(pagina));
  if (actual >= total - 2) [total - 2, total - 1].forEach((pagina) => pagina >= 1 && visibles.add(pagina));
  const ordenadas = [...visibles].sort((a, b) => a - b);
  const resultado: Array<number | "ellipsis"> = [];
  ordenadas.forEach((pagina, indice) => {
    if (indice > 0 && pagina - ordenadas[indice - 1]! > 1) resultado.push("ellipsis");
    resultado.push(pagina);
  });
  return resultado;
}

function EnlacePagina({
  href,
  children,
  ariaLabel,
}: { href: string | null; children: ReactNode; ariaLabel: string }) {
  const className = buttonVariants({ variant: "outline", size: "sm" });
  if (href === null) {
    return <span aria-label={ariaLabel} aria-disabled="true" className={cn(className, "pointer-events-none opacity-50")}>{children}</span>;
  }
  return <Link href={href} aria-label={ariaLabel} className={className}>{children}</Link>;
}
