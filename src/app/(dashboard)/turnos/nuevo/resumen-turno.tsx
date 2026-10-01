type Resumen = { materia: string | null; profesor: string | null; fechaHorario: string | null; aula: string | null; alumnos: string | null; estadoInicial: string };

export function ResumenTurno({ valores }: { valores: Resumen }) {
  const filas = [
    ["MATERIA", valores.materia],
    ["PROFESOR", valores.profesor],
    ["FECHA Y HORARIO", valores.fechaHorario],
    ["AULA", valores.aula],
    ["ALUMNOS", valores.alumnos],
    ["ESTADO INICIAL", valores.estadoInicial],
  ] as const;
  return <aside aria-labelledby="titulo-resumen-turno" className="rounded-xl border border-border bg-card p-5 text-card-foreground lg:sticky lg:top-6">
    <h2 id="titulo-resumen-turno" className="text-lg font-semibold">Resumen</h2>
    <dl className="mt-2 space-y-1">
      {filas.map(([etiqueta, valor]) => <div key={etiqueta} className="space-y-0.5 py-1">
        <dt className="text-xs font-semibold tracking-wide text-muted-foreground">{etiqueta}</dt>
        <dd className={valor ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{valor || "Sin elegir"}</dd>
      </div>)}
    </dl>
  </aside>;
}
