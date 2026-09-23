import * as admin from "firebase-admin";

// ── Push notification sender ──
// Supports two transports (used automatically if configured):
//  1. Expo Push API — tokens starting with "Expo" (mobile app via expo-notifications)
//  2. FCM via firebase-admin — web/device tokens, if FIREBASE_* env vars are set
// Degrades silently to a no-op when nothing is configured (free-tier friendly).

let firebaseApp: admin.app.App | null = null;
function getFirebase(): admin.app.App | null {
  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) return null;
  if (!firebaseApp) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID ?? "",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }
  return firebaseApp;
}

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, any>): Promise<void> {
  const messages = tokens.slice(0, 100).map((token) => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: data ?? {},
    channelId: "default",
  }));
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error("Expo push failed:", res.status, await res.text().catch(() => ""));
  }
}

async function sendFcmPush(tokens: string[], title: string, body: string, data?: Record<string, any>): Promise<void> {
  const app = getFirebase();
  if (!app) return;
  await app.messaging().sendEachForMulticast({
    tokens: tokens.slice(0, 500),
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, String(v)])),
    apns: { payload: { aps: { sound: "default" } } },
  });
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send a push notification to a user across all registered devices.
 * Never throws — push is best-effort and must not break business flows.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const tokens = await prisma.pushToken.findMany({
        where: { userId, isActive: true },
        select: { token: true, platform: true },
      });
      if (!tokens.length) return;

      const expoTokens = tokens.filter((t) => t.token.startsWith("Expo")).map((t) => t.token);
      const fcmTokens = tokens.filter((t) => !t.token.startsWith("Expo")).map((t) => t.token);

      if (expoTokens.length) await sendExpoPush(expoTokens, payload.title, payload.body, payload.data);
      if (fcmTokens.length) await sendFcmPush(fcmTokens, payload.title, payload.body, payload.data);
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    console.error("sendPushToUser failed:", e);
  }
}
