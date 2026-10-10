"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { hoyEnZonaCentro } from "@/lib/calendario-semana";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { formatearMonto } from "@/lib/moneda";
import { texto } from "@/lib/textos";
import type { ClasesPendientesDePago, OperacionDePagoRegistrada } from "@/types/pago.types";
import type { AlumnoBuscado } from "../../turnos/buscador-alumnos";
import { PasoBuscarAlumno } from "./paso-buscar-alumno";
import { PasoClasesAlumno } from "./paso-clases-alumno";
import { PasoConfirmacion } from "./paso-confirmacion";
import { ProgresoRegistrarPago, type PasoRegistrarPago } from "./progreso-registrar-pago";
import {
  claveDeClase, clasesElegidas, erroresDeSeleccion, importeDeFila, itemsDeOperacion, motivoDeFila,
  seleccionInicial, totalElegido, type FilaElegible, type Seleccion,
} from "./seleccion-clases";

const MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente.";

type Carga = { alumnoId: string; turnoId?: string };

/**
 * «Registrar pago» (HU-I-10, spec_modulo_I.md §2.7): flujo de página completa
 * Alumno → Clases → Confirmación. Acepta alumno y clase preelegidos
 * (`?alumno=&clase=`): con alumno arranca en el paso 2. El éxito se informa
 * con el banner inline de DESIGN.md §6.2 y el flujo vuelve al paso 1.
 */
export function RegistrarPagoWizard({ alumnoInicialId, claseInicialId }: { alumnoInicialId?: string; claseInicialId?: string }) {
  const router = useRouter();
  const hoy = hoyEnZonaCentro();
  const [paso, setPaso] = useState<PasoRegistrarPago>(alumnoInicialId ? 2 : 1);
  const [carga, setCarga] = useState<Carga | null>(alumnoInicialId ? { alumnoId: alumnoInicialId, turnoId: claseInicialId } : null);
  const [datos, setDatos] = useState<ClasesPendientesDePago | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [intentoContinuar, setIntentoContinuar] = useState(false);
  const [formaPagoId, setFormaPagoId] = useState("");
  const [fechaPago, setFechaPago] = useState(hoy);
  const [registradas, setRegistradas] = useState<number | null>(null);
  const resultado = useRef<OperacionDePagoRegistrada | null>(null);

  useEffect(() => {
    if (!carga) return;
    const controller = new AbortController();
    const parametros = new URLSearchParams({ alumno_id: carga.alumnoId, ...(carga.turnoId ? { turno_id: carga.turnoId } : {}) });
    (async () => {
      try {
        const respuesta = await fetchAutenticado(`/api/pagos/pendientes?${parametros}`, { signal: controller.signal, cache: "no-store" });
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok) throw new Error(cuerpo?.error?.message ?? texto("ui.pagos.clases.errorCarga"));
        const pendientes = cuerpo.data as ClasesPendientesDePago;
        setDatos(pendientes);
        setSeleccion(seleccionInicial(pendientes.clases));
        setFormaPagoId(pendientes.alumno.forma_pago_preferida_id ?? "");
      } catch (error) {
        if (!controller.signal.aborted) setErrorCarga(error instanceof Error ? error.message : texto("ui.pagos.clases.errorCarga"));
      }
    })();
    return () => controller.abort();
  }, [carga]);

  const clases = datos?.clases ?? [];
  const elegidas = clasesElegidas(clases, seleccion);
  const total = totalElegido(clases, seleccion);
  const errores = erroresDeSeleccion(clases, seleccion);

  const volverAlPaso1 = () => {
    setPaso(1); setCarga(null); setDatos(null); setErrorCarga(""); setSeleccion({});
    setIntentoContinuar(false); setFormaPagoId(""); setFechaPago(hoyEnZonaCentro());
  };
  const elegirAlumno = (alumno: AlumnoBuscado) => {
    setRegistradas(null); setDatos(null); setErrorCarga(""); setIntentoContinuar(false);
    setCarga({ alumnoId: alumno.id }); setPaso(2);
  };
  const cambiarFila = (clave: string, cambio: Partial<FilaElegible>) =>
    setSeleccion((anterior) => ({ ...anterior, [clave]: { ...anterior[clave]!, ...cambio } }));
  const continuar = () => {
    setIntentoContinuar(true);
    if (elegidas.length > 0 && Object.keys(errores).length === 0) setPaso(3);
  };

  const registrar = async () => {
    if (!datos) return;
    const respuesta = await fetchAutenticado("/api/pagos/operaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alumno_id: datos.alumno.id, items: itemsDeOperacion(clases, seleccion), forma_pago_id: formaPagoId, fecha_pago: fechaPago }),
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = cuerpo?.error;
      const detalles = error?.detalles as { turno_id?: string; materia?: string; precio_vigente?: number } | undefined;
      // DEC-28: la tarifa cambió entre que se abrió el flujo y se confirmó. Se
      // recarga el precio de la clase y el diálogo muestra el aviso sin cerrarse.
      if (error?.code === "MOTIVO_AJUSTE_REQUERIDO" && typeof detalles?.precio_vigente === "number") {
        const precio = detalles.precio_vigente;
        setDatos((anterior) => anterior && {
          ...anterior,
          clases: anterior.clases.map((clase) => clase.turno_id === detalles.turno_id ? { ...clase, precio } : clase),
        });
        throw new Error(texto("ui.pagos.tarifaCambio", { materia: detalles.materia ?? "" }));
      }
      throw new Error(error?.message ?? MENSAJE_ERROR_GENERICO);
    }
    resultado.current = cuerpo.data as OperacionDePagoRegistrada;
  };
  const registrado = () => {
    setRegistradas(resultado.current?.pagos.length ?? elegidas.length);
    volverAlPaso1();
    if (alumnoInicialId) router.replace("/pagos/registrar");
    window.scrollTo({ top: 0 });
  };

  const nombreAlumno = datos?.alumno.nombre_completo ?? "";
  return <div className="space-y-6">
    {registradas !== null && (
      <div role="status" className="flex items-center gap-3 rounded-lg bg-success px-4 py-3 text-sm text-success-foreground">
        <Check className="size-4 shrink-0" aria-hidden />
        <p className="flex-1 font-medium">
          {registradas === 1 ? texto("ui.pagos.registrado.una") : texto("ui.pagos.registrado.varias", { n: registradas })}
        </p>
        <button type="button" className="rounded-sm p-1 hover:bg-success-foreground/10 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={texto("ui.pagos.registrado.cerrar")} onClick={() => setRegistradas(null)}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )}
    <Breadcrumb tramos={[{ etiqueta: texto("ui.pagos.registrar.migaClases"), href: "/turnos" }, { etiqueta: texto("ui.pagos.registrar.titulo") }]} />
    <header className="space-y-1">
      <h1 className="text-3xl font-semibold">{texto("ui.pagos.registrar.titulo")}</h1>
      <p className="text-sm text-muted-foreground">{texto("ui.pagos.registrar.descripcion")}</p>
    </header>
    <ProgresoRegistrarPago paso={paso} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-7">
        {paso === 1 ? <PasoBuscarAlumno onSeleccionar={elegirAlumno} /> :
          errorCarga ? <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">{errorCarga}</p>
            <Button type="button" variant="outline" onClick={volverAlPaso1}>{texto("ui.pagos.clases.buscarOtro")}</Button>
          </div> :
          !datos ? <p role="status" className="text-sm text-muted-foreground">{texto("ui.pagos.clases.cargando")}</p> :
          paso === 2 ? <PasoClasesAlumno nombreAlumno={nombreAlumno} clases={clases} seleccion={seleccion}
            errores={intentoContinuar ? errores : {}} avisoSinElegir={intentoContinuar && elegidas.length === 0}
            onCambiarFila={cambiarFila} onBuscarOtro={volverAlPaso1} onVolver={volverAlPaso1} onContinuar={continuar} /> :
          <PasoConfirmacion nombreAlumno={nombreAlumno} total={total} formas={datos.formas_pago}
            clases={elegidas.map((clase) => {
              const fila = seleccion[claveDeClase(clase)];
              return { clase, importe: importeDeFila(clase, fila) ?? String(clase.precio), motivo: motivoDeFila(clase, fila) };
            })}
            formaPagoId={formaPagoId} fechaPago={fechaPago} hoy={hoy}
            onCambiarForma={setFormaPagoId} onCambiarFecha={setFechaPago} onVolver={() => setPaso(2)}
            onRegistrar={registrar} onRegistrado={registrado} />}
      </div>
      <aside className="rounded-xl border border-border bg-card p-5 text-card-foreground" aria-labelledby="resumen-registrar-pago">
        <h2 id="resumen-registrar-pago" className="text-lg font-semibold">{texto("ui.pagos.resumen.titulo")}</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">{texto("ui.pagos.resumen.alumno")}</dt>
            <dd className="mt-1">{datos ? <>{nombreAlumno} <span className="text-xs text-muted-foreground">{datos.alumno.dni}</span></> : <span className="text-muted-foreground">{texto("ui.pagos.resumen.sinElegir")}</span>}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">{texto("ui.pagos.resumen.clases")}</dt>
            <dd className="mt-1">{!datos ? "—" : elegidas.length === 1 ? texto("ui.pagos.resumen.clases.una") : texto("ui.pagos.resumen.clases.varias", { n: elegidas.length })}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">{texto("ui.pagos.resumen.total")}</dt>
            <dd className="mt-1 font-mono font-semibold" data-testid="total-resumen">{formatearMonto(total)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </div>;
}
