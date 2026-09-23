import { redirect } from "next/navigation";

// La sección Calendario tiene, por ahora, una sola vista (HU-J-01). La
// agenda por materia (HU-J-02) se sumará como /calendario/materia.
export default function CalendarioPage() {
  redirect("/calendario/profesor");
}
