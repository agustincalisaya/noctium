import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { texto } from "@/lib/textos";

export async function pedirDatos<T>(url: string, body?: unknown): Promise<T> {
  const respuesta = await fetchAutenticado(url, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await respuesta.json();
  if (!respuesta.ok || result.error) {
    const error = new Error(result.error?.message ?? texto("ui.profesores.estado.error"));
    Object.assign(error, { code: result.error?.code });
    throw error;
  }
  return result.data as T;
}
