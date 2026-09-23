/**
 * Pie de página del área autenticada. Server Component sin lógica ni
 * dependencia de sesión — no cubre ninguna HU puntual, es layout puro.
 */
export function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t px-4 py-3 text-center text-xs text-muted-foreground">
      Noctium © {anio} — Centro de Atención Académica.
    </footer>
  );
}
