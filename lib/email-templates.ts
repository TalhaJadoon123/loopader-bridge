// Branded email templates for Loopader. All emails share the dark shell.

function shell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0f1a; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 4px;">LOOPADER</h1>
      </div>
      <h2 style="color: #f1f5f9; font-size: 20px; font-weight: 700; margin: 0 0 16px;">${title}</h2>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;">
      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
        Trading involves risk of loss. Loopader is a technology platform.<br>
        <a href="mailto:support@loopader.com" style="color: #10b981;">support@loopader.com</a>
      </p>
    </div>
  `;
}

const btn = (href: string, label: string) =>
  `<div style="text-align:center; margin: 24px 0;"><a href="${href}" style="display:inline-block; background: linear-gradient(135deg, #10b981, #0ea5e9); color: #070b14; font-weight: 700; padding: 12px 28px; border-radius: 10px; text-decoration: none;">${label}</a></div>`;

const p = (text: string) => `<p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${text}</p>`;

export function welcomeEmail(name: string): string {
  return shell(
    "Welcome to Loopader",
    p(`Hi ${name || "there"},`) +
    p("Your account is ready. Practice with a free demo account, then go live whenever you feel ready — with tight spreads, fast withdrawals, and an AI coach by your side.") +
    btn(process.env.NEXT_PUBLIC_APP_URL ?? "https://loopader.com", "Open your dashboard")
  );
}

export function depositConfirmedEmail(amount: string, method: string): string {
  return shell(
    "Deposit confirmed",
    p(`Your deposit of <strong style="color:#f1f5f9;">$${amount}</strong> via ${method} has been confirmed and credited to your live account.`) +
    p("You can start trading right away. Good luck out there — and always use a stop loss.")
  );
}

export function withdrawalProcessedEmail(amount: string, method: string): string {
  return shell(
    "Withdrawal processed",
    p(`Your withdrawal of <strong style="color:#f1f5f9;">$${amount}</strong> via ${method} has been approved and is on its way.`) +
    p("Depending on the payment provider, funds may take 1–3 business days to arrive.")
  );
}

export function withdrawalRejectedEmail(amount: string, reason: string): string {
  return shell(
    "Withdrawal rejected",
    p(`Your withdrawal request of <strong style="color:#f1f5f9;">$${amount}</strong> was rejected.`) +
    p(`Reason: <strong style="color:#f1f5f9;">${reason}</strong>`) +
    p("If you believe this is a mistake, contact support and we will review it.")
  );
}

export function marginCallEmail(equity: string, marginLevel: string): string {
  return shell(
    "Margin call — action required",
    p(`Your margin level has dropped to <strong style="color:#ef4444;">${marginLevel}%</strong> (equity: $${equity}).`) +
    p("If it falls below 20%, open positions will be automatically closed (stop-out) to protect your account from going negative.") +
    btn(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://loopader.com"}/positions`, "Review your positions")
  );
}

export function newDeviceEmail(device: string, location: string, ip: string): string {
  return shell(
    "New device sign-in",
    p(`Your Loopader account was just accessed from a new device:`) +
    p(`<strong style="color:#f1f5f9;">${device}</strong> — ${location} (IP: ${ip})`) +
    p("If this was you, you can safely ignore this email. If not, change your password immediately and freeze your account from Settings → Security.")
  );
}

export function kycApprovedEmail(name: string): string {
  return shell(
    "Identity verified",
    p(`Congratulations ${name || "there"} — your identity has been verified.`) +
    p("Your account is now fully unlocked: unlimited deposits, and withdrawals are enabled. Welcome to the live arena.")
  );
}

export function kycRejectedEmail(reason: string): string {
  return shell(
    "Verification needs attention",
    p("We could not verify your identity from the documents you submitted.") +
    p(`Reason: <strong style="color:#f1f5f9;">${reason}</strong>`) +
    p("You can resubmit clearer photos of your ID (front, back) and a selfie at any time.")
  );
}

export function weeklyReviewEmail(name: string, summary: string): string {
  return shell(
    "Your weekly trading review",
    p(`Hi ${name || "there"}, here is your AI-generated week in review:`) +
    `<div style="background:#111a2e; border:1px solid #1e293b; border-radius:10px; padding:16px; color:#cbd5e1; font-size:14px; line-height:1.6;">${summary.replace(/\n/g, "<br>")}</div>` +
    btn(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://loopader.com"}/coach`, "Ask your coach about it")
  );
}

export function streakReminderEmail(streak: number): string {
  return shell(
    "Don't break your streak",
    p(`You are on a <strong style="color:#f59e0b;">${streak}-day</strong> trading streak.`) +
    p("Log in today and check in to keep it alive — streaks build discipline, and discipline builds traders.")
  );
}
