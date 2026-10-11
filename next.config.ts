import type { NextConfig } from "next";

// HU-A-05 (spec_modulo_A.md §2.7.2 y §3.11): las pantallas públicas de la
// recuperación no se guardan en caché, y `/restablecer-contrasena` no manda
// el enlace (con su token) en el encabezado `Referer`. Un Server Component no
// puede fijar encabezados de respuesta, por eso van acá.
const SIN_CACHE = { key: "Cache-Control", value: "no-store, must-revalidate" };

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/restablecer-contrasena",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }, SIN_CACHE],
      },
      {
        source: "/recuperar-contrasena",
        headers: [SIN_CACHE],
      },
    ];
  },
};

export default nextConfig;
