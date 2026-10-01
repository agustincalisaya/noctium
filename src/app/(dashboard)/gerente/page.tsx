import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { IndicadoresClient } from "./indicadores-client";

export default async function GerentePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "GERENTE") redirect("/home");

  return <IndicadoresClient />;
}
