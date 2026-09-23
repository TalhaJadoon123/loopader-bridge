import { PrismaClient } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const prisma = new PrismaClient();

// Get user's default decrypted API key for the trading bot (BYOK)
export async function getUserApiKey(userId: string): Promise<{
  provider: string;
  key: string;
  baseUrl: string | null;
  model: string | null;
} | null> {
  const rec = await prisma.userApiKey.findFirst({
    where: { userId, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!rec) return null;
  try {
    return { provider: rec.provider, key: decrypt(rec.encryptedKey), baseUrl: rec.baseUrl, model: rec.model };
  } catch {
    return null;
  }
}