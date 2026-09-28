"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function DesplazamientoGrilla({
  primeraHora,
  apertura,
  granularidadMinutos,
  children,
}: {
  primeraHora: string | null;
  apertura: string;
  granularidadMinutos: number;
  children: ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [hora, minutos] = (primeraHora ?? apertura).split(":").map(Number);
    const [horaApertura, minutosApertura] = apertura.split(":").map(Number);
    const diferencia = hora * 60 + minutos - horaApertura * 60 - minutosApertura;
    if (contenedor.current) {
      const altoFranja = parseFloat(getComputedStyle(contenedor.current).fontSize) * 3;
      contenedor.current.scrollTop = Math.max(0, diferencia / granularidadMinutos * altoFranja - 72);
    }
  }, [primeraHora, apertura, granularidadMinutos]);

  return (
    <div ref={contenedor} className="max-h-[min(68vh,42rem)] overflow-auto rounded-md border border-border bg-card" aria-label="Horarios de la semana">
      {children}
    </div>
  );
}
