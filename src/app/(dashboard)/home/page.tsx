import type { CSSProperties } from "react";
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

// Firma institucional del sistema: nombra el alcance real del producto
// (los módulos de la spec, A-L) en vocabulario de usuario. No son
// links todavía — falta confirmar ruta y permiso por rol de cada uno.
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

/* ===============================================================
   DECISIONES VISUALES COMPARTIDAS
   Todo color sale de tokens de DESIGN.md. Acá se fijan una sola vez
   el rótulo, el movimiento y las sombras, para que todas las
   secciones usen exactamente los mismos valores.
================================================================ */

/** Rótulo en versalitas: un único estilo (antes había cuatro variantes). */
const ROTULO =
  "text-[11px] font-semibold uppercase leading-4 tracking-[0.14em]";

/**
 * Movimiento: desaceleración suave (easeOutQuint). La salida dura
 * 400 ms; la entrada se acorta a 200 ms con `hover:` / `group-hover:`,
 * así el hover responde rápido y se retira sin brusquedad.
 */
const MOVIMIENTO =
  "transition-[color,background-color,border-color,box-shadow,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

/**
 * Sombras en dos capas teñidas con tokens (nunca negro puro): una de
 * contacto, corta y nítida, que asienta la card; y una ambiental,
 * amplia y difusa, en el tono de --primary. En hover crece solo la
 * ambiental: la card no se "levanta" porque todavía no es un link.
 */
const SOMBRA =
  "shadow-[0_1px_2px_-1px_color-mix(in_oklab,var(--foreground)_14%,transparent),0_6px_16px_-10px_color-mix(in_oklab,var(--primary)_18%,transparent)]";
const SOMBRA_HOVER =
  "hover:shadow-[0_1px_2px_-1px_color-mix(in_oklab,var(--foreground)_14%,transparent),0_16px_32px_-16px_color-mix(in_oklab,var(--primary)_32%,transparent)]";

/**
 * Ritmo vertical fluido: el espacio entre bloques escala con el alto de
 * la ventana (de 12 a 36 px). Así la página entra entera en una pantalla
 * de 720–768 px de alto y respira en un monitor de 1080 px, sin scroll.
 */
const RITMO_GAP = "gap-[clamp(0.75rem,4.5svh_-_0.75rem,2.25rem)]";
const RITMO_MT = "mt-[clamp(0.75rem,4.5svh_-_0.75rem,2.25rem)]";

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/** Saludo según la hora real en Argentina — no es decoración, es dato. */
function saludoPorHora(hora: number): string {
  if (hora < 6) return "Buenas noches";
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Fecha y hora reales en Buenos Aires, sin depender de la zona horaria
 * del servidor. (El cálculo anterior, `new Date(toLocaleString(...))`,
 * volvía a aplicar el huso al formatear la fecha: con el servidor en
 * UTC — Docker, Vercel — mostraba el día anterior entre las 00 y las 03.)
 */
function ahoraEnArgentina() {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "00";

  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ahora);

  return {
    hora: Number(parte("hour")),
    minuto: Number(parte("minute")),
    horaLegible: `${parte("hour")}:${parte("minute")}`,
    fechaIso: `${parte("year")}-${parte("month")}-${parte("day")}`,
    fechaLegible: fecha.charAt(0).toUpperCase() + fecha.slice(1),
  };
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

  const { hora, minuto, horaLegible, fechaIso, fechaLegible } =
    ahoraEnArgentina();

  // Accesos e Información comparten la misma grilla, así los gutters de
  // ambas secciones quedan alineados en vertical. Con 3 accesos se pasa a
  // 3 columnas (antes el tercero quedaba huérfano en una segunda fila) y
  // "Novedades" ocupa 2. Son container queries (@container): el ancho útil
  // lo decide el sidebar, no el viewport.
  const tresColumnas = accesos.length >= 3;
  const grilla = `grid gap-4 @xl:grid-cols-2 ${tresColumnas ? "@4xl:grid-cols-3" : ""}`;
  const spanPrincipal =
    accesos.length === 1
      ? "@xl:col-span-2"
      : tresColumnas
        ? "@xl:col-span-2 @4xl:col-span-1"
        : "";

  return (
    // En mobile el contenido no puede entrar en una pantalla: ahí scrollea
    // en vez de recortarse. Desde md queda fijo, sin scroll.
    <main className="relative isolate mx-auto flex h-full w-full max-w-[1180px] flex-col overflow-x-hidden overflow-y-auto px-4 py-[clamp(0.875rem,4svh_-_0.5rem,1.75rem)] md:overflow-y-hidden md:px-8 lg:px-10">
      <FondoDePuntos />
      <RelojDeFondo anguloHoraria={((hora % 12) + minuto / 60) * 30} />

      {/* =========================================================
          ENCABEZADO — compacto, con fecha y hora reales
      ========================================================= */}
      <header className="relative shrink-0">
        <p
          className={`${ROTULO} flex items-center gap-2 text-muted-foreground`}
        >
          <time dateTime={fechaIso}>{fechaLegible}</time>
          <Separador />
          <time dateTime={horaLegible} className="tabular-nums">
            {horaLegible} hs
          </time>
        </p>

        <h1 className="mt-2 text-balance text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.022em] text-foreground md:text-[2.125rem]">
          {saludoPorHora(hora)},{" "}
          <span className="text-muted-foreground">{nombre}</span>
        </h1>

        <p className="mt-3 flex items-center gap-2 text-[13px] leading-5 text-muted-foreground">
          <span aria-hidden="true" className="mr-1 h-px w-8 bg-primary" />
          <span className="font-medium text-foreground">{rolLegible}</span>
          <Separador />
          Centro de Atención Académica
        </p>
      </header>

      {/* =========================================================
          CONTENIDO PRINCIPAL — compacto, sin scroll
      ========================================================= */}
      <div
        className={`@container flex min-h-0 flex-1 flex-col ${RITMO_MT} ${RITMO_GAP}`}
      >
        {tieneAccesos && (
          <section aria-labelledby="accesos-heading" className="shrink-0">
            {/* Título y bajada alineados por la línea base de su última
                línea (items-baseline-last), no por el borde de la caja. */}
            <header className="mb-3.5 flex flex-col gap-1.5 @2xl:flex-row @2xl:items-baseline-last @2xl:justify-between @2xl:gap-10">
              <div className="min-w-0">
                <p className={`${ROTULO} flex items-center gap-2 text-primary`}>
                  Accesos
                  <Separador />
                  <span className="tabular-nums">{accesos.length}</span>
                </p>
                <h2
                  id="accesos-heading"
                  className="mt-1 text-[1.375rem] font-semibold leading-7 tracking-[-0.018em] text-foreground"
                >
                  {contexto?.titulo || "Tus accesos"}
                </h2>
              </div>
              <p className="max-w-md text-pretty text-[13px] leading-5 text-muted-foreground @2xl:text-right">
                {contexto?.descripcion ||
                  "Funciones disponibles según tu rol en el centro."}
              </p>
            </header>

            <div className={grilla}>
              {accesos.map((item, i) => (
                <TarjetaAcceso
                  key={item.titulo}
                  item={item}
                  destacada={i === 0}
                  className={i === 0 ? spanPrincipal : ""}
                />
              ))}
            </div>
          </section>
        )}

        {/* =========================================================
            INFORMACIÓN — sección secundaria: rótulo + filete
        ========================================================= */}
        <section aria-labelledby="informacion-heading" className="shrink-0">
          <header className="mb-3 flex items-center gap-3">
            <h2
              id="informacion-heading"
              className={`${ROTULO} text-muted-foreground`}
            >
              Información
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </header>

          <div className={grilla}>
            <EstadoVacio
              icono={Megaphone}
              titulo="Novedades del centro"
              descripcion="No hay novedades publicadas por el momento."
              className={tresColumnas ? "@4xl:col-span-2" : ""}
            />
            <EstadoVacio
              icono={Bell}
              titulo="Notificaciones"
              descripcion="No tenés notificaciones nuevas."
            />
          </div>
        </section>

        {/* =========================================================
            COLOFÓN — MÓDULOS DE NOCTIUM
        ========================================================= */}
        <footer className="mt-auto flex shrink-0 flex-col gap-2.5 border-t border-border pt-4 @4xl:flex-row @4xl:items-center @4xl:justify-between @4xl:gap-8">
          <p className={`${ROTULO} flex items-center gap-2 text-muted-foreground`}>
            <span className="text-foreground">Noctium</span>
            {/* El lema cede su lugar solo en la franja en que comparte fila
                con los módulos y no hay ancho para ambos. */}
            <span className="contents @4xl:hidden @5xl:contents">
              <Separador />
              Gestión integral del centro
            </span>
          </p>
          <ul
            aria-label="Módulos de Noctium"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
          >
            {MODULOS_NOCTIUM.map((modulo) => (
              <li
                key={modulo.label}
                className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground"
              >
                <modulo.icono
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-brand-accent"
                  strokeWidth={1.75}
                />
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
   FONDO: grilla de puntos
   Acotada al <main> (antes era `fixed` y cubría todo el viewport,
   sidebar y navbar incluidos) y desvanecida con una máscara radial
   que nace detrás del reloj: textura arriba, calma abajo.
================================================================ */

function FondoDePuntos() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle,var(--border)_1px,transparent_1.5px)] bg-size-[24px_24px] mask-radial-[120%_100%] mask-radial-at-top-right mask-radial-from-10% mask-radial-to-75%"
    />
  );
}

/* ===============================================================
   RELOJ DE FONDO: esfera con la hora real
================================================================ */

// Al cargar, la manecilla entra girando desde las 12 hasta la hora real
// (una sola vez, vía @starting-style). Con "reducir movimiento", quieta.
const AGUJA =
  "origin-[200px_200px] rotate-(--angulo) transition-[rotate] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:starting:rotate-0 motion-reduce:transition-none";

function RelojDeFondo({ anguloHoraria }: { anguloHoraria: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 text-border md:size-72"
    >
      {/* Esfera: trazos de 1 px reales a cualquier tamaño (non-scaling-stroke) */}
      <circle
        cx="200"
        cy="200"
        r="180"
        fill="none"
        stroke="currentColor"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="200"
        cy="200"
        r="150"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: 12 }, (_, i) => {
        const rad = (i * 30 * Math.PI) / 180;
        const cuarto = i % 3 === 0; // 12, 3, 6 y 9: marcas más largas
        const interior = cuarto ? 158 : 167;
        return (
          <line
            key={i}
            x1={200 + 180 * Math.sin(rad)}
            y1={200 - 180 * Math.cos(rad)}
            x2={200 + interior * Math.sin(rad)}
            y2={200 - interior * Math.cos(rad)}
            stroke="currentColor"
            strokeWidth={cuarto ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {/* Manecilla horaria: apunta a la hora real en Buenos Aires */}
      <line
        x1="200"
        y1="200"
        x2="200"
        y2="96"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinecap="round"
        className={AGUJA}
        style={{ "--angulo": `${anguloHoraria}deg` } as CSSProperties}
      />
      {/* Eje: pivote sólido con el centro calado */}
      <circle cx="200" cy="200" r="6" fill="var(--primary)" />
      <circle cx="200" cy="200" r="2" fill="var(--background)" />
    </svg>
  );
}

/* ===============================================================
   SEPARADOR de metadatos: punto de 3 px, visible pero discreto
   (el "·" en text-border casi no se veía sobre Marfil)
================================================================ */

function Separador() {
  return (
    <span
      aria-hidden="true"
      className="size-[3px] shrink-0 rounded-full bg-current opacity-40"
    />
  );
}

/* ===============================================================
   TARJETA DE ACCESO
   Una sola anatomía para la principal y las secundarias: títulos y
   descripciones quedan en la misma línea entre cards de una fila. La
   principal se distingue por superficie (tinte + ícono sólido en
   --primary, el único de la vista) y por el rótulo "Principal",
   alineado a la línea base del título.

   Todavía no es un link: el hover solo tiñe borde, sombra e ícono —
   sin cursor de mano, sin flecha, sin "levantar" la card — para no
   prometer una navegación que no existe. Cuando la ruta esté
   confirmada: envolver el texto del <h3> en <Link> con
   `after:absolute after:inset-0` (card clickeable accesible); el
   anillo de foco ya está preparado con `has-focus-visible:`.
================================================================ */

function TarjetaAcceso({
  item,
  destacada,
  className = "",
}: {
  item: Acceso;
  destacada: boolean;
  className?: string;
}) {
  const Icono = item.icono;

  return (
    <article
      className={`group @container relative isolate overflow-hidden rounded-2xl border bg-card p-5 ${SOMBRA} ${SOMBRA_HOVER} ${MOVIMIENTO} hover:duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring ${
        destacada
          ? "border-primary/15 hover:border-primary/30"
          : "border-border hover:border-primary/20"
      } ${className}`}
    >
      {destacada && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 bg-radial-[at_100%_0%] from-primary/8 to-transparent to-70% opacity-70 group-hover:opacity-100 group-hover:duration-200 ${MOVIMIENTO}`}
        />
      )}

      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl group-hover:duration-200 ${MOVIMIENTO} ${
            destacada
              ? "bg-primary text-primary-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--primary-foreground)_18%,transparent),0_2px_6px_-2px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
              : "bg-brand-accent/10 text-brand-accent ring-1 ring-brand-accent/15 ring-inset group-hover:bg-brand-accent/15 group-hover:ring-brand-accent/30"
          }`}
        >
          <Icono className="size-[18px]" strokeWidth={1.75} />
        </span>

        {/* pt-2: centra la primera línea del título con el ícono */}
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline pt-2">
          <h3 className="text-base font-semibold leading-6 tracking-[-0.011em] text-foreground">
            {item.titulo}
          </h3>
          {/* En cards angostas (3 columnas) el rótulo se oculta antes que
              obligar al título a partirse; el ícono sólido ya la distingue. */}
          {destacada && (
            <span className={`${ROTULO} hidden pl-3 text-primary @sm:inline`}>
              Principal
            </span>
          )}
          <p className="col-span-2 mt-1 text-pretty text-sm leading-5 text-muted-foreground">
            {item.detalle}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ===============================================================
   ESTADO VACÍO
   Honesto: no simula contenido (sin skeletons ni contadores). El
   borde punteado lo marca como espacio reservado y lo deja un escalón
   por debajo de las cards de acceso. En hover el ícono se balancea
   desde arriba, como una campana: un guiño, no una promesa de acción.
================================================================ */

function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  className = "",
}: {
  icono: typeof Megaphone;
  titulo: string;
  descripcion: string;
  className?: string;
}) {
  return (
    <article
      className={`group relative isolate overflow-hidden rounded-2xl border border-dashed border-border bg-card/70 p-5 hover:border-primary/25 hover:bg-card hover:duration-200 ${MOVIMIENTO} ${className}`}
    >
      {/* Marca de agua: el mismo ícono, grande y casi transparente */}
      <Icono
        aria-hidden="true"
        strokeWidth={1}
        className="pointer-events-none absolute -bottom-8 -right-6 -z-10 size-32 -rotate-12 text-primary/[0.045]"
      />

      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border ring-inset"
        >
          <Icono
            className="size-[18px] origin-[50%_15%] transition-[rotate] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none motion-safe:group-hover:-rotate-12"
            strokeWidth={1.75}
          />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-foreground">
            {titulo}
          </h3>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            {descripcion}
          </p>
        </div>
      </div>
    </article>
  );
}