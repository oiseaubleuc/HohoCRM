import { PrismaClient } from '@prisma/client';

let prisma;

/** Singleton; null if DATABASE_URL ontbreekt. */
export function getPrisma() {
  if (!process.env.DATABASE_URL?.trim()) return null;
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }
  return prisma;
}
