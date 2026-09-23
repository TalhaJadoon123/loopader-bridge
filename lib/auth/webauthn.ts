import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { PrismaClient } from "@prisma/client";
import { hashFingerprint } from "@/lib/security/device";

function base64urlEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Buffer {
  str += "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

const prisma = new PrismaClient();
const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? "Loopader";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}

export async function startRegistration(userId: string, userName: string, displayName: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { passkeyCredentials: true },
  });

  const creds = (existing?.passkeyCredentials as unknown as PasskeyCredential[]) ?? [];
  const excludeCredentials = creds.map((c) => ({
    id: c.id,
    type: "public-key" as const,
    transports: c.transports as any,
  }));

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

const options = await generateRegistrationOptions({
  rpName: RP_NAME,
  rpID: RP_ID,
  userID: stringToUint8Array(userId),
  userName,
  userDisplayName: displayName,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257],
    timeout: 60000,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { passkeyChallenge: options.challenge },
  });

  return options;
}

export async function finishRegistration(userId: string, body: any, deviceFingerprint?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passkeyChallenge) throw new Error("No challenge found");

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: user.passkeyChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const credential: PasskeyCredential = {
    id: base64urlEncode(Buffer.from(credentialID)),
    publicKey: Buffer.from(credentialPublicKey).toString("base64"),
    counter,
  };

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { passkeyCredentials: true } });
    const creds = (existing?.passkeyCredentials as unknown as PasskeyCredential[]) ?? [];
    creds.push(credential);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passkeyEnabled: true,
        passkeyCredentials: creds as any,
        passkeyChallenge: null,
      },
    });

  if (deviceFingerprint) {
    await prisma.securityEvent.create({
      data: {
        userId,
        event: "PASSKEY_REGISTERED",
        deviceFingerprint: hashFingerprint(deviceFingerprint),
        riskScore: 0,
      },
    });
  }

  return { verified: true };
}

export async function startAuthentication(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passkeyEnabled) throw new Error("Passkey not enabled");

  const creds = (user.passkeyCredentials as unknown as PasskeyCredential[]) ?? [];
  const credentials = creds.map((c) => ({
    id: c.id,
    type: "public-key" as const,
    transports: c.transports as any,
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials,
    userVerification: "preferred",
    timeout: 60000,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { passkeyChallenge: options.challenge },
  });

  return options;
}

export async function finishAuthentication(userId: string, body: any, deviceFingerprint?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passkeyChallenge || !user.passkeyEnabled) throw new Error("No challenge or passkey disabled");

  const creds = (user.passkeyCredentials as unknown as PasskeyCredential[]) ?? [];
  const credentials = creds.map((c) => ({
    id: Buffer.from(c.id, "base64url"),
    type: "public-key" as const,
    publicKey: Buffer.from(c.publicKey, "base64"),
    transports: c.transports as any,
  }));

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: user.passkeyChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    authenticator: {
      credentialID: creds[0]?.id ?? "",
      credentialPublicKey: Buffer.from(creds[0]?.publicKey ?? "", "base64"),
      counter: creds[0]?.counter ?? 0,
    },
    requireUserVerification: false,
  });

  if (!verification.verified) throw new Error("Authentication verification failed");

  const cred = creds.find(
    (c) => c.id === base64urlEncode(Buffer.from(verification.authenticationInfo!.credentialID))
  );
  if (cred) {
    cred.counter = verification.authenticationInfo!.newCounter;
    await prisma.user.update({
      where: { id: userId },
      data: { passkeyCredentials: user.passkeyCredentials as any, passkeyChallenge: null },
    });
  }

  if (deviceFingerprint) {
    await prisma.securityEvent.create({
      data: {
        userId,
        event: "PASSKEY_LOGIN",
        deviceFingerprint: hashFingerprint(deviceFingerprint),
        riskScore: 0,
      },
    });
  }

  return { verified: true };
}