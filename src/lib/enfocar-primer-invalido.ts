/**
 * Lleva el foco al primer campo inválido del formulario (criterio común de
 * Sprint 1: "foco al primer campo inválido"). Recorre `form.elements` en
 * orden de documento — no en el orden de las claves de `errores` — y enfoca
 * el primero cuyo `name` tenga un mensaje de error. No depende de que React
 * ya haya pintado los errores, así que se puede llamar en el mismo handler
 * que hace el `setState`, tanto para errores de cliente como de servidor.
 */
export function enfocarPrimerCampoInvalido(
  form: HTMLFormElement | null,
  errores: Record<string, string | string[] | undefined>,
): void {
  if (!form) return;

  const conError = new Set(
    Object.entries(errores)
      .filter(([, mensaje]) => (Array.isArray(mensaje) ? mensaje.length > 0 : !!mensaje))
      .map(([campo]) => campo),
  );
  if (conError.size === 0) return;

  for (const elemento of Array.from(form.elements)) {
    if (
      (elemento instanceof HTMLInputElement ||
        elemento instanceof HTMLSelectElement ||
        elemento instanceof HTMLTextAreaElement) &&
      conError.has(elemento.name)
    ) {
      elemento.focus();
      return;
    }
  }
}
