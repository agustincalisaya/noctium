import bcrypt from "bcryptjs";

// TODO: alinear a costo 12 (RNF-SEG-02) cuando se implemente HU-A-01/HU-B-08
const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
