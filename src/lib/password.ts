import bcrypt from "bcryptjs";

// Factor de costo 12 (RNF-SEG-02, HU-Sprint-1.md HU-B-08 c2).
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
