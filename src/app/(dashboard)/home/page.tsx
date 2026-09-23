import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";

import { auth } from "@/auth";
import { obtenerNombreVisible } from "@/server/usuarios/usuario.service";
import { ROL_LEGIBLE } from "@/components/layout/Navbar";

/**
 * Pantalla principal única post-login (HU-A-01 criterio 3):
 * todos los roles llegan acá después de iniciar sesión.
 */
export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const nombre = await obtenerNombreVisible(
    session.user.id,
    session.user.rol
  );

  const rol = ROL_LEGIBLE[session.user.rol] || "Usuario";

  /*
   * Fecha actual de Argentina.
   *
   * Se utiliza explícitamente la zona horaria
   * de Argentina para que la fecha no dependa
   * de la zona horaria del servidor.
   */
  const fechaArgentina = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const fechaArgentinaFormateada =
    fechaArgentina.charAt(0).toUpperCase() + fechaArgentina.slice(1);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6 lg:p-8">

      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

        {/* Decoración de fondo */}
        <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative p-6 md:p-8">

          {/* Badge de estado */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sistema operativo
          </div>

          {/* Título */}
          <div className="mt-4">
            <h1 className="text-3xl font-bold tracking-tight text-card-foreground md:text-4xl lg:text-[42px]">
              Hola,{" "}
              <span className="text-brand-accent">
                {nombre}
              </span>
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Bienvenido/a a Noctium. Estás operando como{" "}
              <span className="font-semibold text-foreground">
                {rol}
              </span>
              . Desde aquí puedes acceder rápidamente a las herramientas
              principales de tu área.
            </p>
          </div>

          {/* Información secundaria */}
          <div className="mt-5 flex flex-wrap gap-4">

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Jornada disponible
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Sin alertas
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================
          RESUMEN
      ========================================================= */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Estado actual */}
        <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Estado actual
              </p>

              <p className="mt-2 text-2xl font-bold text-card-foreground">
                Disponible
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>

          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Todo funcionando correctamente
          </div>

        </div>

        {/* Jornada */}
        <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">

          <div className="flex items-start justify-between">

            <div className="min-w-0">

              <p className="text-sm font-medium text-muted-foreground">
                Jornada
              </p>

              <p className="mt-2 text-xl font-bold capitalize leading-tight text-card-foreground">
                {fechaArgentinaFormateada}
              </p>

            </div>

            <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
              <CalendarDays className="h-5 w-5" />
            </div>

          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Jornada correspondiente al día de hoy.
          </p>

        </div>

        {/* Actividad */}
        <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Actividad
              </p>

              <p className="mt-2 text-2xl font-bold text-card-foreground">
                0
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>

          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Acciones registradas durante tu jornada.
          </p>

        </div>

        {/* Notificaciones */}
        <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Notificaciones
              </p>

              <p className="mt-2 text-2xl font-bold text-card-foreground">
                0
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <Bell className="h-5 w-5" />
            </div>

          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            No tienes nuevas notificaciones.
          </p>

        </div>

      </section>

      {/* =========================================================
          CONTENIDO PRINCIPAL
      ========================================================= */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* =======================================================
            ACTIVIDAD RECIENTE
        ======================================================= */}
        <div className="flex min-h-[320px] flex-col rounded-2xl border border-border bg-card shadow-sm lg:col-span-2">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 md:px-6">

            <div>
              <h2 className="font-semibold text-card-foreground">
                Actividad reciente
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Resumen de las últimas acciones realizadas.
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>

          </div>

          {/* Empty state */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-card-foreground">
              Todavía no hay actividad
            </h3>

            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Cuando realices acciones dentro de Noctium, aquí aparecerá
              un resumen de tu actividad reciente.
            </p>

          </div>

        </div>

        {/* =======================================================
            ACCESOS RÁPIDOS
        ======================================================= */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">

          {/* Header */}
          <div className="border-b border-border px-5 py-4 md:px-6">

            <h2 className="font-semibold text-card-foreground">
              Accesos rápidos
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Herramientas frecuentes
            </p>

          </div>

          {/* Links */}
          <div className="space-y-2 p-4">

            {/* Reportes */}
            <Link
              href="#"
              className="
                group flex items-center gap-3 rounded-xl
                border border-transparent p-3.5
                transition-all
                hover:border-border hover:bg-muted/60
              "
            >

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-sm font-medium text-card-foreground">
                  Ver reportes
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Consulta los reportes de hoy
                </p>

              </div>

              <ArrowRight
                className="
                  h-4 w-4 text-muted-foreground
                  transition-transform
                  group-hover:translate-x-1
                "
              />

            </Link>

            {/* Configuración */}
            <Link
              href="#"
              className="
                group flex items-center gap-3 rounded-xl
                border border-transparent p-3.5
                transition-all
                hover:border-border hover:bg-muted/60
              "
            >

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                <Settings className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-sm font-medium text-card-foreground">
                  Configuración
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Gestiona las preferencias del sistema
                </p>

              </div>

              <ArrowRight
                className="
                  h-4 w-4 text-muted-foreground
                  transition-transform
                  group-hover:translate-x-1
                "
              />

            </Link>

            {/* Agenda */}
            <Link
              href="#"
              className="
                group flex items-center gap-3 rounded-xl
                border border-transparent p-3.5
                transition-all
                hover:border-border hover:bg-muted/60
              "
            >

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <CalendarDays className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">

                <p className="text-sm font-medium text-card-foreground">
                  Agenda
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Consulta las actividades programadas
                </p>

              </div>

              <ArrowRight
                className="
                  h-4 w-4 text-muted-foreground
                  transition-transform
                  group-hover:translate-x-1
                "
              />

            </Link>

          </div>
        </div>

      </section>

      {/* =========================================================
          ESTADO DEL SISTEMA
      ========================================================= */}
      <section className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-emerald-50/70 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">

          <div className="flex items-start gap-4">

            {/* Icono */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>

            {/* Información */}
            <div>

              <div className="flex flex-wrap items-center gap-2">

                <h2 className="font-semibold text-emerald-950 dark:text-emerald-100">
                  Estado del sistema
                </h2>

                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Operativo
                </span>

              </div>

              <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/70">
                Todos los servicios funcionan correctamente. No hay alertas
                ni acciones pendientes para tu rol.
              </p>

            </div>

          </div>

          {/* Estado online */}
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">

            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            Sistema online

          </div>

        </div>

      </section>

    </main>
  );
}