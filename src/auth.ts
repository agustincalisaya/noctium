import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const usuario = await prisma.usuario.findUnique({
          where: { emailUsuario: email },
        });
        if (!usuario) return null;

        const passwordValida = await comparePassword(
          password,
          usuario.passwordHashUsuario,
        );
        if (!passwordValida) return null;

        return {
          id: usuario.idUsuario,
          email: usuario.emailUsuario,
          rol: usuario.rolUsuario,
        };
      },
    }),
  ],
  callbacks: {
    // Solo exige sesión iniciada; la autorización por rol se define HU por HU.
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.rol = user.rol;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      return session;
    },
  },
});
