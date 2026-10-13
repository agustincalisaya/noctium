"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { texto } from "@/lib/textos";
import type { IntegranteCaja } from "@/types/caja.types";

type Filtros = { integrante_id?: string; desde?: string; hasta?: string };

/**
 * Filtros de los cierres del gerente (HU-I-12 criterio 11, DEC-30): un
 * selector simple de integrante (los que tienen alguna caja, incluidos los
 * inactivos) y el rango de fechas de cierre. Cada cambio navega a la página 1
 * con los filtros en la URL (DESIGN.md §8.1); los datos los arma el servidor.
 */
export function FiltrosCierres({ integrantes, inicial, rangoInvalido }: { integrantes: IntegranteCaja[]; inicial: Filtros; rangoInvalido: boolean }) {
  const router = useRouter();
  const [filtros, setFiltros] = useState<Filtros>(inicial);
  const invalido = rangoInvalido || Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);

  const aplicar = (cambio: Filtros) => {
    const nuevos = { ...filtros, ...cambio };
    setFiltros(nuevos);
    if (nuevos.desde && nuevos.hasta && nuevos.desde > nuevos.hasta) return;
    const query = new URLSearchParams();
    for (const [clave, valor] of Object.entries(nuevos)) if (valor) query.set(clave, valor);
    const cadena = query.toString();
    router.push(cadena ? `/cajas?${cadena}` : "/cajas");
  };

  const campo = "flex items-center gap-2 rounded-md border border-input bg-card px-3 text-sm";
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={texto("ui.cajas.cierres.titulo")}>
      <label className={campo}>
        <span className="text-muted-foreground">{texto("ui.cajas.filtros.integrante")}</span>
        <select value={filtros.integrante_id ?? ""} onChange={(evento) => aplicar({ integrante_id: evento.target.value || undefined })}
          className="h-9 bg-transparent font-medium outline-none">
          <option value="">{texto("ui.cajas.filtros.todos")}</option>
          {integrantes.map((integrante) => <option key={integrante.id} value={integrante.id}>
            {integrante.nombre_completo ?? texto("ui.caja.detalle.sinNombre")}
          </option>)}
        </select>
      </label>
      <label className={campo}>
        <span className="text-muted-foreground">{texto("ui.cajas.filtros.desde")}</span>
        <Input type="date" value={filtros.desde ?? ""} aria-invalid={invalido}
          onChange={(evento) => aplicar({ desde: evento.target.value || undefined })} className="h-9 border-0 px-0 shadow-none" />
      </label>
      <label className={campo}>
        <span className="text-muted-foreground">{texto("ui.cajas.filtros.hasta")}</span>
        <Input type="date" value={filtros.hasta ?? ""} aria-invalid={invalido}
          onChange={(evento) => aplicar({ hasta: evento.target.value || undefined })} className="h-9 border-0 px-0 shadow-none" />
      </label>
      {(filtros.integrante_id || filtros.desde || filtros.hasta) && (
        <Button type="button" variant="outline" size="sm" onClick={() => aplicar({ integrante_id: undefined, desde: undefined, hasta: undefined })}>
          {texto("ui.cajas.filtros.limpiar")}
        </Button>
      )}
    </div>
    {invalido && <p role="alert" className="text-xs text-destructive">{texto("ui.cajas.filtros.rangoInvalido")}</p>}
  </div>;
}
