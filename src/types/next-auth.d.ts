import type { DefaultSession } from "next-auth";
import type { RolUsuario } from "@prisma/client";

declare module "next-auth" {
  interface User {
    rol: RolUsuario;
  }

  interface Session {
    user: {
      id: string;
      rol: RolUsuario;
      /** Marca «Debe cambiar la contraseña», copiada del token (HU-A-06). Sin el claim vale `false`. */
      debeCambiarPassword?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    rol: RolUsuario;
    /** Identificador único del token, para revocación (HU-A-03). */
    jti: string;
    /** Timestamp (segundos) de inicio de sesión — inmutable durante la renovación. */
    iat_sesion: number;
    /**
     * Marca «Debe cambiar la contraseña» (HU-A-06), copiada solo al ingresar.
     * Opcional: un token emitido antes de existir el claim vale `false`.
     */
    debeCambiarPassword?: boolean;
  }
}
