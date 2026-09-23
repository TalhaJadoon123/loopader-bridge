import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { verifyPassword, validatePasswordStrength } from "@/lib/security/password";
import { calculateRisk, logSecurityEvent } from "@/lib/security/risk";
import { verifyTotp, decryptSecret } from "@/lib/security/totp";
import { getClientIp } from "@/lib/security/rate-limit";
import { hashFingerprint, parseDeviceInfo } from "@/lib/security/device";
import { getGeoInfo } from "@/lib/security/geo";
import { encrypt, decrypt } from "@/lib/crypto";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt", maxAge: 15 * 60 },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code-verifier",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    },
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
    encode: async ({ token, secret }) => {
      const payload = { ...token, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 };
      return encrypt(JSON.stringify(payload));
    },
    decode: async ({ token, secret }) => {
      if (!token) return null;
      try {
        return JSON.parse(decrypt(token));
      } catch {
        return null;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "2FA Code", type: "text" },
        deviceFingerprint: { label: "Device Fingerprint", type: "text" },
        turnstileToken: { label: "Turnstile Token", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = getClientIp(req!);
        const userAgent = req?.headers?.get?.("user-agent") ?? "";
        const fp = credentials.deviceFingerprint ?? "";
        const fpHash = fp ? hashFingerprint(fp) : null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) {
          await logSecurityEvent(null, "LOGIN_FAILED_INVALID_CREDENTIALS", ip, userAgent, fpHash, null, 0);
          return null;
        }

        const pwdValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!pwdValid) {
          await logSecurityEvent(user.id, "LOGIN_FAILED_INVALID_PASSWORD", ip, userAgent, fpHash, null, 10);
          return null;
        }

        if (user.kycStatus === "REJECTED") {
          await logSecurityEvent(user.id, "LOGIN_BLOCKED_KYC_REJECTED", ip, userAgent, fpHash, null, 50);
          return null;
        }

        const risk = await calculateRisk({
          userId: user.id,
          ip,
          userAgent,
          deviceFingerprint: fp,
          action: "LOGIN",
        });

        if (risk.require2FA && user.twoFactorSecret) {
          if (!credentials.totp) {
            await logSecurityEvent(user.id, "LOGIN_REQUIRES_2FA", ip, userAgent, fpHash, null, risk.score);
            throw new Error("REQUIRES_2FA");
          }
          const secret = decryptSecret(user.twoFactorSecret);
          if (!verifyTotp(credentials.totp, secret)) {
            await logSecurityEvent(user.id, "LOGIN_FAILED_2FA", ip, userAgent, fpHash, null, risk.score + 20);
            return null;
          }
        }

        await logSecurityEvent(user.id, "LOGIN_SUCCESS", ip, userAgent, fpHash, (await getGeoInfo(ip))?.country ?? null, risk.score);

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          kycStatus: user.kycStatus,
          passkeyEnabled: user.passkeyEnabled,
          twoFactorEnabled: !!user.twoFactorSecret,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // OAuth (Google/Apple) — upsert user + provision trading account + streak
      // NOTE: PrismaAdapter creates the OAuth User row itself, so we must NOT
      // create User again (unique email crash). We link by email and provision extras.
      if (account && account.provider !== "credentials") {
        const email = user.email;
        if (!email) return false;
        try {
          let dbUser = await prisma.user.findUnique({ where: { email } });
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email,
                fullName: user.name ?? email.split("@")[0],
                avatarUrl: user.image ?? null,
                country: null,
                kycStatus: "PENDING",
              },
            });
          }
          // Provision trading extras once
          const hasAccount = await prisma.tradingAccount.findFirst({ where: { userId: dbUser.id } });
          if (!hasAccount) {
            await prisma.tradingAccount.create({
              data: { userId: dbUser.id, type: "DEMO", tier: "STANDARD", balance: 10000, currency: "USD", leverage: 30, isActive: true },
            });
            await prisma.streak.create({ data: { userId: dbUser.id, current: 0, longest: 0, freezes: 2 } });
            const missions = await prisma.mission.findMany({ where: { isActive: true } });
            for (const m of missions) {
              await prisma.userMission.create({ data: { userId: dbUser.id, missionId: m.id } });
            }
          }
          user.id = dbUser.id;
          (user as any).role = dbUser.role;
          (user as any).kycStatus = dbUser.kycStatus;
          return true;
        } catch (e) {
          console.error("[auth] OAuth signIn provisioning failed:", e);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "USER";
        token.kycStatus = (user as any).kycStatus ?? "PENDING";
        token.passkeyEnabled = (user as any).passkeyEnabled ?? false;
        token.twoFactorEnabled = (user as any).twoFactorEnabled ?? false;
        // OAuth users: enrich token from DB (adapter-created user lacks role fields)
        if (!(user as any).role && user.email) {
          try {
            const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
              token.kycStatus = dbUser.kycStatus;
            }
          } catch {}
        }
      }
      if (trigger === "update" && session) {
        token.kycStatus = session.kycStatus;
        token.passkeyEnabled = session.passkeyEnabled;
        token.twoFactorEnabled = session.twoFactorEnabled;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          kycStatus: token.kycStatus as string,
          passkeyEnabled: token.passkeyEnabled as boolean,
          twoFactorEnabled: token.twoFactorEnabled as boolean,
        };
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        const ip = "unknown";
        await logSecurityEvent(
          token.id as string,
          "LOGOUT",
          ip,
          "",
          null,
          null,
          0
        );
      }
    },
  },
};