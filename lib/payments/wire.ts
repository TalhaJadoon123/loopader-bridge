import { randomBytes } from "crypto";

export interface WireInstruction {
  reference: string;
  amountUsd: number;
  bankName: string;
  accountNumber: string;
  swift: string;
  iban?: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
}

export function generateWireInstruction(userId: string, amountUsd: number): WireInstruction {
  const reference = `WIRE_${Date.now()}_${randomBytes(6).toString("hex").toUpperCase()}`;

  return {
    reference,
    amountUsd,
    bankName: process.env.WIRE_BANK_NAME ?? "Loopader Bank",
    accountNumber: process.env.WIRE_BANK_ACCOUNT ?? "0000000000",
    swift: process.env.WIRE_BANK_SWIFT ?? "LOOPADERXX",
    iban: process.env.WIRE_BANK_IBAN ?? undefined,
    beneficiaryName: "Loopader Ltd.",
    beneficiaryAddress: "123 Financial District, London, UK",
  };
}