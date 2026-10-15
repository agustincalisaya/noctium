"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { texto } from "@/lib/textos";
import { guardarConfiguracion } from "@/server/configuracion/actions";
import type { CampoConfigurable, ClaveConfigurable } from "@/server/configuracion/parametros-configurables";
import type { HistorialConfiguracion, ParametroConfiguracion, ValoresConfiguracion } from "@/types/configuracion.types";

const CAMPOS: CampoConfigurable[] = ["plazoPagoHoras", "cancelacionAnticipacionHoras", "umbralPresentismo"];
const NOMBRES: Record<CampoConfigurable, "ui.configuracion.plazoPagoHoras" | "ui.configuracion.cancelacionAnticipacionHoras" | "ui.configuracion.umbralPresentismo"> = {
  plazoPagoHoras: "ui.configuracion.plazoPagoHoras",
  cancelacionAnticipacionHoras: "ui.configuracion.cancelacionAnticipacionHoras",
  umbralPresentismo: "ui.configuracion.umbralPresentismo",
};
const AYUDAS = {
  plazoPagoHoras: "ui.configuracion.ayudaPlazo",
  cancelacionAnticipacionHoras: "ui.configuracion.ayudaCancelacion",
  umbralPresentismo: "ui.configuracion.ayudaPresentismo",
} as const;

type Formato = Record<CampoConfigurable, string>;
type Errores = Partial<Record<CampoConfigurable, string>>;

async function leerApi<T>(url: string): Promise<T> {
  const respuesta = await fetch(url, { cache: "no-store" });
  if (!respuesta.ok) throw new Error(String(respuesta.status));
  const cuerpo = await respuesta.json();
  return cuerpo.data as T;
}

function valoresDe(parametros: ParametroConfiguracion[]): ValoresConfiguracion {
  return Object.fromEntries(parametros.map(({ campo, valor }) => [campo, valor])) as ValoresConfiguracion;
}

function formatoDe(parametros: ParametroConfiguracion[]): Formato {
  return Object.fromEntries(parametros.map(({ campo, valor }) => [campo, String(valor)])) as Formato;
}

function validar(parametros: ParametroConfiguracion[], inputs: Formato): { valores: ValoresConfiguracion; errores: Errores } {
  const valores = {} as ValoresConfiguracion;
  const errores: Errores = {};
  for (const parametro of parametros) {
    const escrito = inputs[parametro.campo].trim();
    if (!/^\d+$/.test(escrito) || !Number.isSafeInteger(Number(escrito))) {
      errores[parametro.campo] = texto("ui.configuracion.enteroRequerido");
      continue;
    }
    const numero = Number(escrito);
    if (numero < parametro.min || numero > parametro.max) {
      errores[parametro.campo] = texto("ui.configuracion.fueraDeRango", { min: parametro.min, max: parametro.max });
      continue;
    }
    valores[parametro.campo] = numero;
  }
  return { valores, errores };
}

export function ConfiguracionForm() {
  const [parametros, setParametros] = useState<ParametroConfiguracion[] | null>(null);
  const [inputs, setInputs] = useState<Formato | null>(null);
  const [historial, setHistorial] = useState<HistorialConfiguracion | null>(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [confirmando, setConfirmando] = useState(false);
  const [conflicto, setConflicto] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const enviando = useRef(false);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const data = await leerApi<{ parametros: ParametroConfiguracion[] }>("/api/configuracion");
      setParametros(data.parametros);
      setInputs(formatoDe(data.parametros));
      setErrores({});
      setErrorCarga(false);
    } catch {
      setErrorCarga(true);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarHistorial = useCallback(async (numeroPagina: number) => {
    try {
      setHistorial(await leerApi<HistorialConfiguracion>(`/api/configuracion/historial?pagina=${numeroPagina}`));
      setErrorHistorial(false);
    } catch {
      setErrorHistorial(true);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    leerApi<{ parametros: ParametroConfiguracion[] }>("/api/configuracion")
      .then((data) => {
        if (!activo) return;
        setParametros(data.parametros);
        setInputs(formatoDe(data.parametros));
        setErrorCarga(false);
      })
      .catch(() => { if (activo) setErrorCarga(true); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);
  useEffect(() => {
    let activo = true;
    leerApi<HistorialConfiguracion>(`/api/configuracion/historial?pagina=${pagina}`)
      .then((data) => { if (activo) { setHistorial(data); setErrorHistorial(false); } })
      .catch(() => { if (activo) setErrorHistorial(true); });
    return () => { activo = false; };
  }, [pagina]);

  const evaluacion = useMemo(() => parametros && inputs ? validar(parametros, inputs) : null, [parametros, inputs]);
  const erroresVisibles = { ...errores, ...evaluacion?.errores };
  const cambios = useMemo(() => parametros && evaluacion && Object.keys(evaluacion.errores).length === 0
    ? parametros.filter((parametro) => evaluacion.valores[parametro.campo] !== parametro.valor) : [], [parametros, evaluacion]);

  const abrirConfirmacion = () => {
    if (!parametros || !inputs || !evaluacion) return;
    setErrores(evaluacion.errores);
    if (Object.keys(evaluacion.errores).length || cambios.length === 0) return;
    setConflicto(false);
    setConfirmando(true);
  };

  const confirmar = async () => {
    if (enviando.current || !parametros || !evaluacion) return;
    enviando.current = true;
    try {
      const respuesta = await guardarConfiguracion({ valores: evaluacion.valores, esperados: valoresDe(parametros) });
      if (respuesta.error) {
        if (respuesta.error.code === "CONFLICTO_EDICION_CONCURRENTE") setConflicto(true);
        if ("detalles" in respuesta.error && respuesta.error.detalles && "issues" in respuesta.error.detalles) {
          const nuevos: Errores = {};
          for (const issue of respuesta.error.detalles.issues as { path: (string | number)[]; message: string }[]) {
            if (issue.path[0] === "valores" && CAMPOS.includes(issue.path[1] as CampoConfigurable)) {
              nuevos[issue.path[1] as CampoConfigurable] = issue.message;
            }
          }
          setErrores(nuevos);
        }
        throw new Error(respuesta.error.message);
      }
      setGuardada(respuesta.data.cambios.length > 0);
      setCargando(true);
      await cargarConfiguracion();
      setPagina(1);
      await cargarHistorial(1);
    } finally {
      enviando.current = false;
    }
  };

  const recargar = async () => {
    setConfirmando(false);
    setConflicto(false);
    setGuardada(false);
    setCargando(true);
    await cargarConfiguracion();
    await cargarHistorial(1);
    setPagina(1);
  };

  const porClave = new Map(parametros?.map((parametro) => [parametro.clave, parametro]));
  const nombreClave = (clave: ClaveConfigurable) => {
    const campo = porClave.get(clave)?.campo;
    return campo ? texto(NOMBRES[campo]) : clave;
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{texto("ui.configuracion.titulo")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{texto("ui.configuracion.descripcion")}</p>
        </div>
        <Button type="button" disabled={cargando || errorCarga || !parametros || cambios.length === 0 || confirmando} onClick={abrirConfirmacion}>
          {texto("ui.configuracion.guardar")}
        </Button>
      </div>

      {guardada && <div role="status" className="rounded-md bg-success px-4 py-3 text-sm text-success-foreground">{texto("ui.configuracion.guardada")}</div>}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 text-card-foreground md:p-6" aria-labelledby="parametros-titulo">
          <h2 id="parametros-titulo" className="sr-only">{texto("ui.configuracion.parametros")}</h2>
          {cargando && <p className="text-sm text-muted-foreground">{texto("ui.configuracion.cargando")}</p>}
          {errorCarga && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{texto("ui.configuracion.errorCarga")}</p><Button type="button" variant="outline" onClick={() => { setCargando(true); void cargarConfiguracion(); }}>{texto("ui.configuracion.reintentar")}</Button></div>}
          {parametros && inputs && !cargando && !errorCarga && <div className="space-y-5">
            {parametros.map((parametro) => (
              <div key={parametro.clave} className="space-y-1.5">
                <label htmlFor={parametro.campo} className="block text-sm font-medium">{texto(NOMBRES[parametro.campo])}</label>
                <p className="text-xs text-muted-foreground">{texto(parametro.unidad === "h" ? "ui.configuracion.rangoHoras" : "ui.configuracion.rangoPorcentaje", { min: parametro.min, max: parametro.max, defecto: parametro.porDefecto })}</p>
                <div className="flex items-center gap-2">
                  <input id={parametro.campo} type="number" step="1" min={parametro.min} max={parametro.max} value={inputs[parametro.campo]} aria-invalid={Boolean(erroresVisibles[parametro.campo])} aria-describedby={`${parametro.campo}-ayuda ${parametro.campo}-error`} onChange={(event) => { setInputs({ ...inputs, [parametro.campo]: event.target.value }); setErrores({ ...errores, [parametro.campo]: undefined }); setGuardada(false); }} className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  <span className="text-sm text-muted-foreground">{texto(parametro.unidad === "h" ? "ui.configuracion.unidadHoras" : "ui.configuracion.unidadPorcentaje")}</span>
                </div>
                {erroresVisibles[parametro.campo] && <p id={`${parametro.campo}-error`} role="alert" className="text-xs text-destructive">{erroresVisibles[parametro.campo]}</p>}
                <p id={`${parametro.campo}-ayuda`} className="text-xs leading-relaxed text-muted-foreground">{texto(AYUDAS[parametro.campo])}</p>
              </div>
            ))}
          </div>}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 text-card-foreground md:p-6" aria-labelledby="historial-titulo">
          <h2 id="historial-titulo" className="text-base font-semibold">{texto("ui.configuracion.historial")}</h2>
          {!historial && !errorHistorial && <p className="mt-3 text-sm text-muted-foreground">{texto("ui.configuracion.cargandoHistorial")}</p>}
          {errorHistorial && <div role="alert" className="mt-3 space-y-2 text-sm text-destructive"><p>{texto("ui.configuracion.errorHistorial")}</p><Button type="button" variant="outline" onClick={() => void cargarHistorial(pagina)}>{texto("ui.configuracion.reintentar")}</Button></div>}
          {!errorHistorial && historial?.items.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{texto("ui.configuracion.historialVacio")}</p>}
          {!errorHistorial && historial && historial.items.length > 0 && <>
            <ol className="mt-3 divide-y divide-border">
              {historial.items.map((item) => <li key={item.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium">{nombreClave(item.clave)}</p>
                <p>{texto("ui.configuracion.historialAnteriorNuevo", { anterior: item.valorAnterior, nuevo: item.valorNuevo })}</p>
                <p className="text-xs text-muted-foreground">{item.usuario.nombre} · {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(item.fecha))}</p>
              </li>)}
            </ol>
            <div className="mt-4">
              <Pagination paginaActual={pagina} totalPaginas={historial.total_paginas} total={historial.total} porPagina={historial.por_pagina}
                mostrarRango mostrarNumeros buildHref={(numero) => `?pagina=${numero}`} onPageChange={setPagina} />
            </div>
          </>}
        </section>
      </div>

      <ConfirmarAccionDialog abierto={confirmando} onCerrar={() => { setConfirmando(false); setConflicto(false); }} titulo={texto("confirmaciones.configuracion.guardar")} textoConfirmar={texto("ui.configuracion.guardarConfiguracion")} detalle={<ul className="space-y-1">{cambios.map((parametro) => <li key={parametro.clave}>{texto(NOMBRES[parametro.campo])}: {texto(parametro.unidad === "h" ? "ui.configuracion.cambioHoras" : "ui.configuracion.cambioPorcentaje", { anterior: parametro.valor, nuevo: evaluacion?.valores[parametro.campo] })}</li>)}</ul>} onConfirmar={confirmar} accionError={conflicto ? <Button type="button" variant="outline" onClick={() => void recargar()}>{texto("ui.configuracion.recargar")}</Button> : undefined} />
    </div>
  );
}
