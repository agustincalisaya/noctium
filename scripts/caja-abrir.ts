// Abre la caja de una cuenta de mesa de entrada (PR-0.md §2.15). Hasta que
// exista la pantalla de HU-I-12, es la forma de volver a abrir la caja de una
// cuenta de prueba creada por el seed después de cerrarla.
//
//   npm run caja:abrir -- mesa.entrada@noctium.local          (fondo inicial 0)
//   npm run caja:abrir -- mesa.entrada@noctium.local 5000.00
//
// Llama al servicio `abrirCaja`, con sus mismas reglas: la cuenta tiene que
// tener su ficha de mesa de entrada activa y no puede tener otra caja abierta.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { abrirCaja } from "../src/server/pagos/caja.service";
import { esErrorDeDominio } from "../src/server/shared/error-dominio";
import { transaccion } from "../src/server/shared/transaccion";

async function main() {
  const [email, fondoInicial = "0"] = process.argv.slice(2);
  if (!email) {
    console.error("Uso: npm run caja:abrir -- <email> [fondo inicial]");
    return 1;
  }
  const usuario = await prisma.usuario.findUnique({ where: { emailUsuario: email.trim().toLowerCase() }, select: { idUsuario: true } });
  if (!usuario) {
    console.error(`No existe una cuenta con el email ${email}`);
    return 1;
  }
  try {
    const caja = await transaccion((tx) => abrirCaja(tx, { usuarioId: usuario.idUsuario, fondoInicial }));
    console.log(`Caja abierta para ${email}: ${caja.id} (fondo inicial $ ${caja.fondoInicial})`);
    return 0;
  } catch (error) {
    if (esErrorDeDominio(error)) {
      console.error(`No se abrió la caja: ${error.message} (${error.code})`);
      return 1;
    }
    throw error;
  }
}

main()
  .then((codigo) => { process.exitCode = codigo; })
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
