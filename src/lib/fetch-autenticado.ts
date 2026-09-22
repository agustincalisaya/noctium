/**
 * Wrapper mínimo de fetch para llamadas del cliente a rutas protegidas por
 * withPermission(). Si el server rechaza por sesión inválida (401), redirige
 * a /login con el motivo en vez de que cada llamador repita el manejo
 * (HU-A-02 criterio 5: "Tu sesión expiró. Iniciá sesión nuevamente").
 */
export async function fetchAutenticado(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    // Navegación dura intencional: esta función no es un componente (no hay
    // useRouter disponible) y el objetivo es descartar todo estado de
    // cliente ante una sesión inválida, no una transición optimista.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?motivo=expirada";
  }
  return response;
}
