// Compliance & legal configuration — REAL values required before going live.
// Fill these in after company registration + partner broker agreement.

export const COMPLIANCE = {
  // ── Company identity (MUST be real before launch) ──
  companyName: process.env.COMPANY_NAME ?? "Loopader",
  legalEntity: process.env.LEGAL_ENTITY ?? "Loopader Technologies", // e.g. "Loopader Technologies (Pvt) Ltd" or "Loopader Ltd (Seychelles)"
  registrationNumber: process.env.REGISTRATION_NUMBER ?? "", // e.g. SECP / Companies House / FSA reg no.
  registeredAddress: process.env.REGISTERED_ADDRESS ?? "",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@loopader.com",

  // ── Regulatory status ──
  // UNLICENSED = platform only, trades routed to licensed partner (IB model)
  // LICENSED = you hold your own license (fill licenseNumber)
  mode: (process.env.REGULATORY_MODE ?? "IB") as "IB" | "WHITELABEL" | "LICENSED",
  regulator: process.env.REGULATOR_NAME ?? "", // e.g. "FSA Seychelles", "FCA (UK)"
  licenseNumber: process.env.LICENSE_NUMBER ?? "",

  // ── Partner broker (IB / white-label model) ──
  partnerBroker: process.env.PARTNER_BROKER_NAME ?? "", // e.g. "Exness", "IC Markets"
  partnerDisclosure:
    process.env.PARTNER_DISCLOSURE ??
    "Trading services are provided by a licensed third-party broker. Loopader is a technology platform and does not hold client funds.",

  // ── Client money & risk ──
  riskWarning:
    "Trading foreign exchange, commodities, indices, cryptocurrencies and CFDs carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience and risk appetite. You could sustain a loss of some or all of your initial investment; therefore, you should not invest money that you cannot afford to lose. Seek independent advice if necessary.",
  jurisdictionNote:
    process.env.JURISDICTION_NOTE ??
    "Loopader is not intended for residents of jurisdictions where its use would be contrary to local law or regulation. It is your responsibility to ensure compliance with local laws.",
  // ── KYC / AML limits (enforced in code) ──
  kyc: {
    depositLimitUnverified: 500, // USD lifetime, without KYC
    withdrawalRequiresVerified: true,
    maxRiskScoreBeforeBlock: 80,
  },

  // ── Prohibited jurisdictions (OFAC + common broker exclusions) ──
  prohibitedCountries: ["US", "IR", "KP", "SY", "CU"],
};

export function isCountryProhibited(country: string | null | undefined): boolean {
  if (!country) return false;
  return COMPLIANCE.prohibitedCountries.includes(country.toUpperCase());
}

export function regulatoryDisclosureLines(): string[] {
  const lines = [COMPLIANCE.riskWarning];
  if (COMPLIANCE.mode === "IB" && COMPLIANCE.partnerBroker) {
    lines.push(`Loopader is an introducing broker for ${COMPLIANCE.partnerBroker}. ${COMPLIANCE.partnerDisclosure}`);
  }
  if (COMPLIANCE.mode === "LICENSED" && COMPLIANCE.regulator) {
    lines.push(`${COMPLIANCE.legalEntity} is authorised and regulated by ${COMPLIANCE.regulator}${COMPLIANCE.licenseNumber ? ` (License No. ${COMPLIANCE.licenseNumber})` : ""}.`);
  }
  lines.push(COMPLIANCE.jurisdictionNote);
  return lines;
}
