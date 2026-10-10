import { RegistrarPagoWizard } from "./registrar-pago-wizard";

const valor = (parametro: string | string[] | undefined) => (typeof parametro === "string" && parametro.trim() ? parametro.trim() : undefined);

/** «Registrar pago» (HU-I-10): acepta alumno y clase preelegidos, `?alumno=<id>&clase=<id>`. */
export default async function RegistrarPagoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const alumno = valor(parametros.alumno);
  return <RegistrarPagoWizard alumnoInicialId={alumno} claseInicialId={alumno ? valor(parametros.clase) : undefined} />;
}
