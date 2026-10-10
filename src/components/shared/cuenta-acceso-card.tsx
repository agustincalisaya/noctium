import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ROL_LEGIBLE } from "@/components/layout/Navbar";
import { texto } from "@/lib/textos";
import type { ResumenCuenta } from "@/server/usuarios/cuenta.service";

/** Etiqueta de cada estado (HU-A-06 criterio 5). */
const ETIQUETAS = {
  SIN_CUENTA: "ui.sesion.cuentaAcceso.sinCuenta",
  INACTIVA: "ui.sesion.cuentaAcceso.inactiva",
  ACTIVA: "ui.sesion.cuentaAcceso.activa",
  ACTIVA_DEBE_CAMBIAR: "ui.sesion.cuentaAcceso.activaDebeCambiar",
} as const;

/** Estilo del estado: la marca en ámbar, como el prototipo (fig. 86). */
const VARIANTES: Record<keyof typeof ETIQUETAS, BadgeProps["variant"]> = {
  SIN_CUENTA: "outline",
  INACTIVA: "muted",
  ACTIVA: "success",
  ACTIVA_DEBE_CAMBIAR: "warning",
};

/**
 * Sección «Cuenta de acceso» de una ficha (HU-A-06 criterio 5,
 * spec_modulo_A.md §2.6.4, spec_modulo_B.md §2.12 y spec_modulo_D.md §2.12),
 * compartida por las fichas de alumno y de profesor (y más adelante las de F
 * y G). Recibe el resultado de `obtenerResumenCuenta()` del módulo A: estado,
 * email y rol, nunca el hash ni el DNI. Una ficha sin cuenta (anterior a
 * HU-A-06 o creada sin email) muestra «Sin cuenta», sin rol ni usuario y sin
 * acción para crearla (DEC-14).
 */
export function CuentaAccesoCard({ cuenta }: { cuenta: ResumenCuenta }) {
  const estado = cuenta.estado === "ACTIVA" && cuenta.debe_cambiar_password ? "ACTIVA_DEBE_CAMBIAR" : cuenta.estado;
  const conCuenta = cuenta.estado !== "SIN_CUENTA";

  return (
    <section
      aria-labelledby="cuenta-acceso-titulo"
      className="space-y-3 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <h2 id="cuenta-acceso-titulo" className="text-lg font-semibold">
        {texto("ui.sesion.cuentaAcceso.titulo")}
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{texto("ui.sesion.cuentaAcceso.estado")}</dt>
          <dd className="mt-1">
            <Badge variant={VARIANTES[estado]}>{texto(ETIQUETAS[estado])}</Badge>
          </dd>
        </div>
        {conCuenta && cuenta.rol && (
          <div>
            <dt className="text-sm text-muted-foreground">{texto("ui.sesion.cuentaAcceso.rol")}</dt>
            <dd className="font-medium">{ROL_LEGIBLE[cuenta.rol]}</dd>
          </div>
        )}
        {conCuenta && cuenta.email && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">{texto("ui.sesion.cuentaAcceso.usuario")}</dt>
            <dd className="break-words font-medium">{cuenta.email}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">{texto("ui.sesion.cuentaAcceso.nota")}</p>
    </section>
  );
}
