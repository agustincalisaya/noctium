"use client";
import { useEffect, useRef, useState } from "react";
import { texto } from "@/lib/textos";
export type RangoIndicador = { desde: string; hasta: string };
/** Una tarjeta es dueña de su carga y reintento; ni abortos ni respuestas tardías publican datos. */
export function useIndicador<T>(ruta: string, rango: RangoIndicador, activo = true) {
  const [resultado, setResultado] = useState<{datos: T | null; error: string | null; clave: string}>({datos:null,error:null,clave:""});
  const [intento, setIntento] = useState(0);
  const secuencia = useRef(0);
  const clave = `${ruta}${ruta.includes("?") ? "&" : "?"}desde=${rango.desde}&hasta=${rango.hasta}`;
  const identidad = `${clave}#${intento}`;
  useEffect(() => {
    if (!activo) return;
    const controlador = new AbortController();
    const numero = ++secuencia.current;
    void (async () => {
      try {
        const respuesta = await fetch(clave, { cache: "no-store", signal: controlador.signal });
        const cuerpo = await respuesta.json();
        if (!respuesta.ok || cuerpo.data == null) throw new Error(texto("indicadores.error"));
        if (!controlador.signal.aborted && numero === secuencia.current) setResultado({datos:cuerpo.data as T,error:null,clave:identidad});
      } catch (error) {
        if (!controlador.signal.aborted && numero === secuencia.current) setResultado({datos:null,error:error instanceof Error ? error.message : texto("indicadores.error"),clave:identidad});
      }
    })();
    return () => controlador.abort();
  }, [clave, identidad, activo]);
  return { datos: resultado.clave === identidad ? resultado.datos : null, error: resultado.clave === identidad ? resultado.error : null, cargando: resultado.clave !== identidad, reintentar: () => setIntento(i => i + 1) };
}
