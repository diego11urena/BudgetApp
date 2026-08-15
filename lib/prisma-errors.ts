import { Prisma } from "@/app/generated/prisma/client";

/** True for a Postgres unique-constraint violation (P2002) — the signal every create-or-fetch race (Gmail import, draft cycle, income source, category) catches to re-read the winner instead of erroring out. */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
