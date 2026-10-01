type Resumen = { materia: string | null; profesor: string | null; fechaHorario: string | null; aula: string | null; alumnos: string | null; estadoInicial: string };
type ResumenRecurrente = { materia: string | null; profesor: string | null; franja: string | null; duracion: string | null; hora: string | null; aula: string | null; rango: string | null };

export function ResumenTurno(props: { modo?: "individual"; valores: Resumen } | { modo: "recurrente"; valores: ResumenRecurrente }) {
  const filas = props.modo === "recurrente" ? [
    ["MATERIA", props.valores.materia],
    ["PROFESOR", props.valores.profesor],
    ["FRANJA", props.valores.franja],
    ["DURACIÓN", props.valores.duracion],
    ["HORA", props.valores.hora],
    ["AULA", props.valores.aula],
    ["DESDE/HASTA", props.valores.rango],
  ] as const : [
    ["MATERIA", props.valores.materia],
    ["PROFESOR", props.valores.profesor],
    ["FECHA Y HORARIO", props.valores.fechaHorario],
    ["AULA", props.valores.aula],
    ["ALUMNOS", props.valores.alumnos],
    ["ESTADO INICIAL", props.valores.estadoInicial],
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
