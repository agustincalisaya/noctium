import NextAuth, { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SignJWT, jwtVerify } from "jose";
import type { JWT } from "@auth/core/jwt";
import { CredencialesLoginSchema } from "@/server/sesion/sesion.schema";
import { verificarCredenciales } from "@/server/sesion/autenticacion.service";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";

/**
 * NextAuth v5 con `strategy: "jwt"` emite por default un JWE cifrado
 * (alg "dir", enc "A256CBC-HS512" — ver node_modules/@auth/core/jwt.js),
 * no un JWT firmado. El criterio 3 de HU-A-01 exige explícitamente
 * "JWT HS256", así que se reemplaza encode/decode por una firma HS256
 * real vía `jose`, en vez de confiar en el default de la librería.
 */
// Validación lazy (no a nivel de módulo): `next build` importa este archivo
// para recolectar metadata de rutas (p. ej. `/login`, `/api/auth/[...nextauth]`)
// sin necesitar el valor real de AUTH_SECRET — un `throw` en el scope del
// módulo rompería ese paso del build aunque la ruta nunca se renderice.
// Se resuelve y memoiza recién cuando algo intenta firmar/verificar un JWT
// de verdad (primer login, primera lectura de sesión), preservando la
// Regla N.° 9 de docs/RULES.md: sigue fallando fuerte, solo que en runtime.
let claveHS256Cache: Uint8Array | undefined;
function getClaveHS256(): Uint8Array {
  if (claveHS256Cache) return claveHS256Cache;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno AUTH_SECRET (docs/RULES.md Regla N.° 9)");
  }
  claveHS256Cache = new TextEncoder().encode(secret);
  return claveHS256Cache;
}

// Códigos de error recuperables desde el Server Action de login (spec_modulo_A.md §2.1).
// CredentialsSignin.code viaja en la excepción cuando signIn() se invoca desde un
// Server Action (framework que maneja el form server-side) — confirmado contra
// node_modules/@auth/core/index.js: se relanza el AuthError original en ese contexto.
export class ErrorCredencialesInvalidas extends CredentialsSignin {
  code = "CREDENCIALES_INVALIDAS";
}
export class ErrorCuentaInactiva extends CredentialsSignin {
  code = "CUENTA_INACTIVA";
}
export class ErrorRateLimitExcedido extends CredentialsSignin {
  code = "RATE_LIMIT_EXCEDIDO";
}

function obtenerIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = CredencialesLoginSchema.safeParse(credentials);
        if (!parsed.success) throw new ErrorCredencialesInvalidas();

        const ip = obtenerIp(request);

        try {
          const { id, rol } = await verificarCredenciales(
            parsed.data.email,
            parsed.data.password,
            ip,
          );
          return { id, rol } satisfies User;
        } catch (error) {
          if (error instanceof ServiceError) {
            if (error.code === "CUENTA_INACTIVA") throw new ErrorCuentaInactiva();
            if (error.code === "RATE_LIMIT_EXCEDIDO") throw new ErrorRateLimitExcedido();
            throw new ErrorCredencialesInvalidas();
          }
          throw error;
        }
      },
    }),
  ],
  jwt: {
    async encode({ token }) {
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .sign(getClaveHS256());
    },
    async decode({ token }) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, getClaveHS256(), {
          algorithms: ["HS256"],
        });
        return payload as JWT;
      } catch {
        return null;
      }
    },
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
      },
    },
  },
  callbacks: {
    // Solo exige sesión iniciada; la autorización por rol se define HU por HU (HU-A-02).
    authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      // Rama de sign-in inicial exclusivamente (spec_modulo_A.md §2.2). La
      // renovación deslizante en solicitudes subsecuentes es HU-A-02: fuera
      // de alcance acá, así que en cualquier otra invocación el token vuelve
      // sin tocarse.
      if (user) {
        const ahora = Math.floor(Date.now() / 1000);
        const inactividadMin = await getParametroNumerico("sesion_inactividad_minutos", 30);

        token.id = user.id as string;
        token.rol = user.rol;
        token.jti = crypto.randomUUID();
        token.iat_sesion = ahora;
        token.iat = ahora;
        token.exp = ahora + inactividadMin * 60;
      }
      return token;
    },
    session({ session, token }) {
      // Nunca expone password_hash ni otro dato sensible (spec_modulo_A.md §2.2).
      session.user.id = token.id;
      session.user.rol = token.rol;
      return session;
    },
  },
});
