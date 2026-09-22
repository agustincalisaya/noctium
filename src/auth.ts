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
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error("Falta la variable de entorno AUTH_SECRET (docs/RULES.md Regla N.° 9)");
}
const claveHS256 = new TextEncoder().encode(AUTH_SECRET);

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
        .sign(claveHS256);
    },
    async decode({ token }) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, claveHS256, {
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
