const BASE = "http://localhost:3000";
const jar = [];

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (jar.length) headers["Cookie"] = jar.join("; ");
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) jar.push(c.split(";")[0]);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  // Login
  const csrf = await req("GET", "/api/auth/csrf");
  await req("POST", "/api/auth/callback/credentials", { csrfToken: csrf.json.csrfToken, email: "talha@test.com", password: "Xk9$mPz2#vLq8!Rw" });
  const session = await req("GET", "/api/auth/session");
  console.log("LOGIN:", session.json?.user ? "OK (" + session.json.user.email + ")" : "FAILED");

  // 1. Alert
  const alert = await req("POST", "/api/alerts", { symbol: "BTCUSD", condition: "BELOW", targetPrice: 70000 });
  console.log("CREATE ALERT:", alert.status, alert.json?.alert?.symbol ?? JSON.stringify(alert.json));

  // 2. Alerts list
  const alerts = await req("GET", "/api/alerts");
  console.log("ALERTS:", alerts.json?.alerts?.length ?? 0, "active");

  // 3. Watchlist
  const wl = await req("POST", "/api/watchlists", { name: "Favorites", symbols: ["EURUSD", "XAUUSD", "BTCUSD"] });
  console.log("WATCHLIST:", wl.status, wl.json?.watchlist?.name ?? JSON.stringify(wl.json));

  // 4. Pending order (LIMIT)
  const pending = await req("POST", "/api/trade/pending", { symbol: "EURUSD", side: "BUY", volume: 0.05, orderType: "LIMIT", triggerPrice: 1.05, idempotencyKey: "pend-" + Date.now() });
  console.log("LIMIT ORDER:", pending.status, pending.json?.order?.orderType ?? JSON.stringify(pending.json));

  // 2. Education
  const edu = await req("GET", "/api/education");
  console.log("EDUCATION:", edu.json?.courses?.length ?? 0, "courses");

  // 3. Course progress
  if (edu.json?.courses?.length) {
    const prog = await req("POST", "/api/education", { courseId: edu.json.courses[0].id });
    console.log("COURSE PROGRESS:", prog.status, prog.json?.progress?.completed ? "completed" : JSON.stringify(prog.json));
  }

  // 5. Signals (auto-seed)
  const sig = await req("GET", "/api/signals");
  console.log("SIGNALS:", sig.json?.signals?.length ?? 0, "active signals");

  // 6. Join challenge
  const challenges = await req("GET", "/api/challenges");
  if (challenges.json?.challenges?.length) {
    const c = challenges.json.challenges.find(x => !x.joined);
    if (c) {
      const join = await req("POST", "/api/challenges", { challengeId: c.id });
      console.log("CHALLENGE JOIN:", join.status, c.title);
    } else {
      console.log("CHALLENGES: already joined all", challenges.json?.challenges.length);
    }
  }

  // 9. Missions
  const missions = await req("GET", "/api/gamification/missions");
  console.log("MISSIONS:", missions.json?.missions?.length ?? 0, "available");

  // 10. Statement summary
  const stmt = await req("GET", "/api/statements");
  console.log("STATEMENT:", stmt.json?.summary ? `deposits=${stmt.json.summary.totalDeposits} pnl=${stmt.json.summary.realizedPnL}` : JSON.stringify(stmt.json));

  // 11. Notifications
  const notif = await req("GET", "/api/notifications");
  console.log("NOTIFICATIONS:", notif.json?.notifications?.length ?? 0, "in inbox");

  // 12. Security devices
  const dev = await req("GET", "/api/security/devices");
  console.log("DEVICES:", dev.json?.devices?.length ?? 0, "known");

  // 13. Profit calculator
  const calc = await req("GET", "/api/tools/profit-calc?entry=1.0850&exit=1.0950&volume=0.1&side=BUY&sl=1.0800&tp=1.0950");
  console.log("PROFIT CALC: R:R =", calc.json?.riskRewardRatio, "| profit =", calc.json?.profit);

  // 14. Portfolio analytics
  const analytics = await req("GET", "/api/analytics/portfolio");
  console.log("ANALYTICS: trades =", analytics.json?.totalTrades, "| winRate =", analytics.json?.winRate + "%");

  // 15. Equity curve
  const equity = await req("GET", "/api/analytics/equity?days=30");
  console.log("EQUITY CURVE:", equity.json?.curve?.length ?? 0, "days | return =", equity.json?.totalReturn + "%");
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });