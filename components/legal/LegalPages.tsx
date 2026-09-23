import { COMPLIANCE, regulatoryDisclosureLines } from "@/lib/compliance";
import Link from "next/link";

function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#070b14] text-slate-200">
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">Loopader</Link>
          <Link href="/register" className="text-sm text-emerald-400 hover:underline">Create account</Link>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {updated}</p>
        <div className="prose-invert space-y-6 text-slate-300 leading-relaxed text-[15px]">{children}</div>
        <div className="mt-12 p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-200/80 leading-relaxed">
          {regulatoryDisclosureLines().map((l, i) => <p key={i} className={i > 0 ? "mt-3" : ""}>{l}</p>)}
        </div>
      </div>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-600">
        © 2026 {COMPLIANCE.legalEntity}. All rights reserved.
      </footer>
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mt-8 mb-3">{children}</h2>;
}

// ── /legal/terms ──
export function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="September 2026">
      <p>Welcome to {COMPLIANCE.companyName}. By creating an account you agree to these terms. Please read them carefully.</p>

      <H2>1. Who we are</H2>
      <p>
        {COMPLIANCE.legalEntity}{COMPLIANCE.registrationNumber ? ` (registration no. ${COMPLIANCE.registrationNumber})` : ""} operates the {COMPLIANCE.companyName} platform.{" "}
        {COMPLIANCE.mode === "LICENSED" && COMPLIANCE.regulator
          ? `We are authorised and regulated by ${COMPLIANCE.regulator}${COMPLIANCE.licenseNumber ? ` (License No. ${COMPLIANCE.licenseNumber})` : ""}.`
          : COMPLIANCE.partnerDisclosure}
      </p>

      <H2>2. Eligibility</H2>
      <p>You must be at least 18 years old and legally capable of entering binding contracts. The service is not available to residents of {COMPLIANCE.prohibitedCountries.join(", ")} and other jurisdictions where prohibited by law. You are responsible for ensuring your use complies with local regulations.</p>

      <H2>3. Demo accounts</H2>
      <p>Demo accounts are provided with virtual funds for practice and education only. No real money is at risk and no real profits can be withdrawn from demo accounts. We may reset, limit or discontinue demo accounts at any time.</p>

      <H2>4. Live accounts, deposits and withdrawals</H2>
      <p>Deposits are held by our partner liquidity provider/broker, not by {COMPLIANCE.companyName}, unless stated otherwise. Withdrawals are processed to the verified source and may require identity verification (KYC). Withdrawal limits and processing times are described in the platform. We may delay or refuse a withdrawal where fraud, money laundering or a breach of these terms is suspected, and will notify you where legally permitted.</p>

      <H2>5. Trading risk</H2>
      <p>Leveraged trading carries a high level of risk. Prices are provided on a best-efforts basis and may be delayed. You may lose more than you deposit on certain products. You alone are responsible for your trading decisions. Nothing on the platform — including AI Coach output, signals, forecasts or sentiment scores — is financial advice.</p>

      <H2>6. AI features</H2>
      <p>The AI Coach, AI Trade Analyzer, insights, signals and Market Mood are educational tools powered by third-party AI models. They can be wrong. They do not consider your personal circumstances. Never rely on them as a sole basis for a trading decision.</p>

      <H2>7. Acceptable use</H2>
      <p>You must not: use the platform for money laundering, terrorist financing or fraud; scrape or abuse our APIs; exploit bugs for unfair profit (we may reverse such trades); share your account; or use automated systems except through our official API within published rate limits.</p>

      <H2>8. Account suspension and closure</H2>
      <p>You may freeze or close your account at any time. We may suspend or close accounts that breach these terms, are subject to sanctions, or create legal risk, with notice where possible.</p>

      <H2>9. Liability</H2>
      <p>To the maximum extent permitted by law, {COMPLIANCE.companyName} is not liable for indirect or consequential losses, lost profits, or losses caused by third-party providers, network outages, or market disruptions. Our total liability is limited to the fees you paid us in the preceding 12 months.</p>

      <H2>10. Changes</H2>
      <p>We may update these terms. Material changes will be notified in-app or by email. Continued use after changes means acceptance.</p>

      <H2>11. Contact</H2>
      <p>Questions: {COMPLIANCE.supportEmail}</p>
    </LegalShell>
  );
}

// ── /legal/privacy ──
export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="September 2026">
      <p>This policy explains what personal data {COMPLIANCE.companyName} collects, why, and your rights.</p>

      <H2>1. Data we collect</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Account data:</strong> name, email, phone, country, profile photo (if you sign in with Google/Apple).</li>
        <li><strong>KYC documents:</strong> ID images and selfie — required before withdrawals.</li>
        <li><strong>Trading data:</strong> orders, positions, balances, journal notes.</li>
        <li><strong>Security data:</strong> device fingerprints, IP addresses, login history, 2FA status. Used for fraud prevention and new-device alerts.</li>
        <li><strong>Usage data:</strong> analytics events (via PostHog) to improve the product.</li>
      </ul>

      <H2>2. Why we process it</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>To provide the service (contract performance)</li>
        <li>Legal identity verification and AML compliance (legal obligation)</li>
        <li>Security, fraud prevention and account recovery (legitimate interest)</li>
        <li>Product improvement (consent, withdrawable anytime)</li>
      </ul>

      <H2>3. AI processing</H2>
      <p>Journal notes, trade history and questions you send to the AI Coach are processed by our AI providers (Groq / Google). Do not include information in the AI Coach that you would not want shared with a third-party processor. We do not sell your data.</p>

      <H2>4. Sharing</H2>
      <p>We share data only with: our partner broker/liquidity provider (to execute your trades), payment processors (to move your money), identity-verification services, cloud/hosting providers (Neon, Vercel, Render, Cloudflare), and authorities where legally required.</p>

      <H2>5. Security</H2>
      <p>Passwords are hashed with bcrypt; sensitive fields are encrypted at rest (AES-256-GCM); all traffic is TLS-encrypted; sessions are httpOnly with strict same-site policy. No system is perfectly secure — use a unique password and enable 2FA.</p>

      <H2>6. Retention</H2>
      <p>Account and transaction records are retained as required by AML law (typically 5–7 years after account closure). You may request deletion of other personal data by contacting {COMPLIANCE.supportEmail}.</p>

      <H2>7. Your rights</H2>
      <p>You may request access, correction, export, or deletion of your personal data, and object to marketing. Contact {COMPLIANCE.supportEmail} — we respond within 30 days.</p>

      <H2>8. Cookies</H2>
      <p>We use strictly-necessary cookies for login sessions, and optional analytics cookies (you can decline). Security features like Cloudflare Turnstile set functional cookies.</p>
    </LegalShell>
  );
}

// ── /legal/risk ──
export function RiskPage() {
  return (
    <LegalShell title="Risk Disclosure" updated="September 2026">
      <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-200/90 font-medium">
        {COMPLIANCE.riskWarning}
      </div>

      <H2>Leverage</H2>
      <p>Leverage of up to 1:3000 means a 0.04% adverse price move can wipe out your margin. Higher leverage amplifies both gains and losses. Most retail traders lose money trading leveraged products — regulators in the EU/UK report 70–85% of retail accounts lose money.</p>

      <H2>Stop-loss orders are not guaranteed</H2>
      <p>Unless you explicitly use a Guaranteed Stop, stop-loss orders execute at the next available price. During gaps, news events or low liquidity, execution can be significantly worse than your stop level. Guaranteed stops may carry a premium.</p>

      <H2>Simulated and delayed data</H2>
      <p>Where live market-data providers are unavailable, prices may be simulated or delayed. Indicator calculations, sentiment scores and forecasts are informational only and may be inaccurate.</p>

      <H2>AI limitations</H2>
      <p>AI models can hallucinate, be outdated, or misread market context. Their output is educational content, not advice, and must not be your only input.</p>

      <H2>Cryptocurrencies</H2>
      <p>Crypto markets trade 24/7, are extremely volatile, largely unregulated, and can lose most or all of their value rapidly.</p>

      <H2>Before you trade, ask yourself</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Can I afford to lose the money I deposit?</li>
        <li>Do I understand how leverage, margin and stop-outs work?</li>
        <li>Am I trading with a plan or on emotion?</li>
        <li>Have I tried the strategy on a demo account first?</li>
      </ul>
      <p>If any answer is no, practice on the demo account and study our Education Academy first.</p>
    </LegalShell>
  );
}

// ── /legal/aml ──
export function AmlPage() {
  return (
    <LegalShell title="AML / KYC Policy" updated="September 2026">
      <p>{COMPLIANCE.companyName} maintains an anti-money-laundering program aligned with FATF guidance and the requirements of our partner financial institutions.</p>

      <H2>1. Identity verification (KYC)</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Before verification:</strong> lifetime deposits are capped at ${COMPLIANCE.kyc.depositLimitUnverified}; withdrawals are disabled.</li>
        <li><strong>To verify:</strong> upload a government-issued photo ID (front + back) and a selfie. Documents are reviewed by our compliance team, typically within 24–48 hours.</li>
        <li>Third-party deposits are rejected — funds must come from an account in your own name.</li>
      </ul>

      <H2>2. Withdrawal rules</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Withdrawals require verified KYC status.</li>
        <li>Withdrawals above $1,000 require additional review.</li>
        <li>Withdrawal destination addresses must be whitelisted in your Security Center and confirmed by email/2FA.</li>
        <li>Large or structuring-pattern withdrawals trigger manual review and possible source-of-funds requests.</li>
      </ul>

      <H2>3. Monitoring</H2>
      <p>We monitor for: rapid deposit-withdraw cycles, structuring below reporting thresholds, account sharing, sanctioned-country access (geo-IP), and multiple accounts under one identity. Suspicious activity may be reported to authorities; we may freeze an account during review.</p>

      <H2>4. Sanctions</H2>
      <p>We do not onboard residents of {COMPLIANCE.prohibitedCountries.join(", ")} or persons on UN/OFAC/EU sanctions lists.</p>

      <H2>5. Data</H2>
      <p>KYC documents are stored encrypted, access is restricted to compliance staff, and records are retained for the legally-required period after account closure. See our Privacy Policy.</p>

      <H2>6. Reporting</H2>
      <p>Suspicious transactions are reported to the relevant financial intelligence unit as required by law. We are prohibited from disclosing such reports to you.</p>
    </LegalShell>
  );
}