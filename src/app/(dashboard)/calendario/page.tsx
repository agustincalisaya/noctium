import { redirect } from "next/navigation";

// La sección Calendario tiene dos vistas: por profesor (HU-J-01) y por
// materia (HU-J-02, /calendario/materia). La entrada genérica abre la
// primera.
export default function CalendarioPage() {
  redirect("/calendario/profesor");
}
