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
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    rol: RolUsuario;
  }
}
