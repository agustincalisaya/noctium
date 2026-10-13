import AlumnoDetallePage from "../page";
import { exigirPermiso } from "@/server/shared/with-permission";

export default async function PagosDeAlumnoPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string; q?: string; volver?: string; materia_id?: string; desde?: string; hasta?: string; forma_pago_id?: string; estado_pago?: string }>;
}) {
  await exigirPermiso("pagos:leer");
  const filtros = await searchParams;
  return AlumnoDetallePage({ params, searchParams: Promise.resolve({ ...filtros, tab: "pagos" }) });
}
