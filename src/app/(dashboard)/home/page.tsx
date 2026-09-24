import { redirect } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";

import { auth } from "@/auth";
import { obtenerNombreVisible } from "@/server/usuarios/usuario.service";
import { ROL_LEGIBLE } from "@/components/layout/Navbar";

type Acceso = {
  titulo: string;
  detalle: string;
  icono: typeof CalendarClock;
};

type Rol = keyof typeof ROL_LEGIBLE;

const ACCESOS_POR_ROL: Partial<Record<Rol, Acceso[]>> = {
  ALUMNO: [
    {
      titulo: "Tus próximos turnos",
      detalle: "Revisá los turnos que tenés reservados y su horario.",
      icono: CalendarClock,
    },
    {
      titulo: "Tus materias",
      detalle: "Consultá las materias del centro y su información.",
      icono: BookOpen,
    },
  ],

  PROFESOR: [
    {
      titulo: "Tu agenda de atención",
      detalle: "Consultá los turnos asignados a tus horarios de atención.",
      icono: CalendarClock,
    },
    {
      titulo: "Materias que dictás",
      detalle: "Revisá las materias asignadas a tu perfil.",
      icono: BookOpen,
    },
  ],

  MESA_ENTRADA: [
    {
      titulo: "Gestión de turnos",
      detalle: "Cargá, modificá o cancelá turnos de alumnos y profesores.",
      icono: ClipboardList,
    },
    {
      titulo: "Alumnos y profesores",
      detalle: "Consultá y actualizá las fichas del centro.",
      icono: Users,
    },
    {
      titulo: "Aulas y materias",
      detalle: "Gestioná la disponibilidad de espacios y la oferta académica.",
      icono: DoorOpen,
    },
  ],

  GERENTE: [
    {
      titulo: "Indicadores del centro",
      detalle: "Seguimiento de turnos, pagos y ocupación (módulo H).",
      icono: GraduationCap,
    },
    {
      titulo: "Gestión de pagos",
      detalle: "Revisá los pagos registrados y su estado.",
      icono: Wallet,
    },
  ],
};

const CONTEXTO_POR_ROL: Partial<
  Record<Rol, { titulo: string; descripcion: string }>
> = {
  ALUMNO: {
    titulo: "Tu jornada académica",
    descripcion:
      "Todo lo que necesitás consultar para organizar tus próximas atenciones.",
  },
  PROFESOR: {
    titulo: "Tu jornada de atención",
    descripcion:
      "Una vista rápida de los espacios de atención que tenés asignados.",
  },
  MESA_ENTRADA: {
    titulo: "Centro de operaciones",
    descripcion:
      "Accesos principales para resolver la operación diaria del centro.",
  },
  GERENTE: {
    titulo: "Visión del centro",
    descripcion:
      "Herramientas disponibles para acompañar la gestión y el seguimiento.",
  },
};

const MODULOS_NOCTIUM = [
  { label: "Turnos", icono: CalendarClock },
  { label: "Alumnos", icono: Users },
  { label: "Profesores", icono: GraduationCap },
  { label: "Materias", icono: BookOpen },
  { label: "Aulas", icono: DoorOpen },
  { label: "Calendario", icono: CalendarRange },
  { label: "Pagos", icono: Wallet },
  { label: "Indicadores", icono: BarChart3 },
];

function saludoPorHora(hora: number): string {
  if (hora < 6) return "Buenas noches";
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const rol = session.user.rol as Rol;
  const rolLegible = ROL_LEGIBLE[rol] || "Usuario";

  const nombre =
    (await obtenerNombreVisible(session.user.id, session.user.rol)) ||
    rolLegible;

  const accesos = ACCESOS_POR_ROL[rol] ?? [];
  const contexto = CONTEXTO_POR_ROL[rol];
  const tieneAccesos = accesos.length > 0;
  const tieneUnAcceso = accesos.length === 1;

  const ahoraArgentina = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    })
  );
  const hora = ahoraArgentina.getHours();
  const minuto = ahoraArgentina.getMinutes();
  const horaLegible = `${String(hora).padStart(2, "0")}:${String(
    minuto
  ).padStart(2, "0")}`;

  const fechaFormateada = (() => {
    const f = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(ahoraArgentina);
    return f.charAt(0).toUpperCase() + f.slice(1);
  })();

  const anguloHoraria = ((hora % 12) + minuto / 60) * 30;

  return (
    <main className="relative isolate mx-auto flex h-full w-full max-w-[1180px] flex-col overflow-hidden px-6 py-6 md:px-8 md:py-8 lg:px-10">
      {/* =========================================================
          FONDO
      ========================================================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.3,
        }}
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 text-border/40 mix-blend-multiply transition-transform duration-1000 ease-out md:h-72 md:w-72 dark:mix-blend-screen"
      >
        <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeWidth="1" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 200 + 180 * Math.sin(angle);
          const y1 = 200 - 180 * Math.cos(angle);
          const x2 = 200 + 165 * Math.sin(angle);
          const y2 = 200 - 165 * Math.cos(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" />
          );
        })}
        <line
          x1="200"
          y1="200"
          x2={200 + 105 * Math.sin((anguloHoraria * Math.PI) / 180)}
          y2={200 - 105 * Math.cos((anguloHoraria * Math.PI) / 180)}
          className="stroke-primary/80"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="200" cy="200" r="5" className="fill-primary/80" />
      </svg>

      {/* =========================================================
          ENCABEZADO
      ========================================================= */}
      <header className="relative mb-8 shrink-0">
        <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          {fechaFormateada}
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border" />
          <span className="text-foreground/80">{horaLegible} hs</span>
        </p>

        <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl">
          {saludoPorHora(hora)},{" "}
          <span className="font-extrabold text-brand-accent">{nombre}</span>
        </h1>

        <div className="mt-4 flex items-center gap-4">
          <span aria-hidden="true" className="h-px w-8 bg-border" />
          <p className="text-sm font-medium tracking-wide text-muted-foreground">
            {rolLegible}
            <span className="mx-3 font-light text-border/80">|</span>
            Centro de Atención Académica
          </p>
        </div>
      </header>

      {/* =========================================================
          CONTENIDO PRINCIPAL
      ========================================================= */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
        {tieneAccesos && (
          <section aria-labelledby="accesos-heading" className="relative shrink-0">
            <header className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary/70">
                  Accesos ({accesos.length})
                </p>
                <h2
                  id="accesos-heading"
                  className="text-xl font-bold tracking-tight text-foreground md:text-2xl"
                >
                  {contexto?.titulo || "Tus accesos"}
                </h2>
              </div>
              <p className="max-w-sm text-xs font-medium leading-relaxed text-muted-foreground md:text-right">
                {contexto?.descripcion ||
                  "Funciones disponibles según tu rol en el centro."}
              </p>
            </header>

            {tieneUnAcceso ? (
              <PrincipalAcceso item={accesos[0]} />
            ) : (
              <div className="grid gap-4 md:gap-5 md:grid-cols-2">
                <PrincipalAcceso item={accesos[0]} />
                {accesos.slice(1).map((item) => (
                  <AccesoSecundario key={item.titulo} item={item} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            INFORMACIÓN
        ========================================================= */}
        <section aria-labelledby="informacion-heading" className="relative shrink-0">
          <header className="mb-5 flex items-center gap-4">
            <h2
              id="informacion-heading"
              className="text-lg font-bold tracking-tight text-foreground md:text-xl"
            >
              Información
            </h2>
            <span aria-hidden="true" className="hidden h-px flex-1 bg-border/40 md:block" />
          </header>

          <div className="grid gap-4 md:gap-5 md:grid-cols-2">
            <EstadoVacio
              icono={Megaphone}
              titulo="Novedades del centro"
              descripcion="No hay novedades publicadas por el momento."
            />
            <EstadoVacio
              icono={Bell}
              titulo="Notificaciones"
              descripcion="No tenés notificaciones nuevas."
            />
          </div>
        </section>

        {/* =========================================================
            COLOFÓN
        ========================================================= */}
        <footer className="mt-auto shrink-0 border-t border-border/40 pt-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
            Noctium · Gestión integral del centro
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {MODULOS_NOCTIUM.map((modulo) => (
              <li
                key={modulo.label}
                className="group flex cursor-default items-center gap-2 text-xs font-medium text-muted-foreground/80 transition-colors duration-300 hover:text-foreground"
              >
                <modulo.icono className="h-3.5 w-3.5 text-brand-accent/50 transition-colors duration-300 group-hover:text-brand-accent" />
                {modulo.label}
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </main>
  );
}

/* ===============================================================
   ACCESO PRINCIPAL
================================================================ */

function PrincipalAcceso({ item }: { item: Acceso }) {
  const Icono = item.icono;

  return (
    <article
      tabIndex={0}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.02] p-5 shadow-sm transition-all duration-400 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl transition-transform duration-700 ease-out group-hover:scale-150 group-hover:bg-primary/15"
      />

      <div className="relative z-10 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent ring-1 ring-brand-accent/20 transition-all duration-500 ease-out group-hover:scale-105 group-hover:bg-brand-accent/15 group-hover:ring-brand-accent/30">
          <Icono className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary/70 transition-colors duration-300 group-hover:text-primary">
            Acceso principal
          </p>
          <h3 className="text-lg font-bold tracking-tight text-foreground md:text-xl">
            {item.titulo}
          </h3>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/90">
            {item.detalle}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ===============================================================
   ACCESOS SECUNDARIOS
================================================================ */

function AccesoSecundario({ item }: { item: Acceso }) {
  const Icono = item.icono;

  return (
    <article
      tabIndex={0}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-400 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/30 hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full border-[12px] border-brand-accent/[0.02] transition-transform duration-700 ease-out group-hover:scale-125 group-hover:border-brand-accent/[0.04]"
      />

      <div className="relative z-10 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10 transition-all duration-500 ease-out group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-brand-accent group-hover:ring-brand-accent/20">
          <Icono className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold tracking-tight text-foreground md:text-lg">
            {item.titulo}
          </h3>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/90">
            {item.detalle}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ===============================================================
   ESTADOS VACÍOS
================================================================ */

function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
}: {
  icono: typeof Megaphone;
  titulo: string;
  descripcion: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-transparent p-5 transition-all duration-400 ease-out hover:border-border/80 hover:bg-muted/30">
      <Icono
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-4 -right-2 h-24 w-24 text-border/20 transition-transform duration-700 ease-out group-hover:-translate-y-1 group-hover:-rotate-3 group-hover:scale-105 group-hover:text-border/30"
        strokeWidth={1}
      />
      <div className="relative z-10 flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm ring-1 ring-border/50 transition-all duration-500 group-hover:bg-brand-accent/5 group-hover:text-brand-accent group-hover:ring-brand-accent/20"
        >
          <Icono className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold tracking-tight text-foreground">{titulo}</h3>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted-foreground">
            {descripcion}
          </p>
        </div>
      </div>
    </article>
  );
}