import AlumnoDetallePage from "../page";
export default async function ClasesPage({ params }: { params: Promise<{ id: string }> }) {
  return AlumnoDetallePage({ params, searchParams: Promise.resolve({ tab: "clases" }) });
}
