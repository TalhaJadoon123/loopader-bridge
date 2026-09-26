const BASE = "http://localhost:3000";
const jar = [];

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (jar.length) headers["Cookie"] = jar.join("; ");
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const sc = res.headers.getSetCookie?.() ?? [];
  for (const c of sc) jar.push(c.split(";")[0]);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  // 1. Login
  const cs = await req("GET", "/api/auth/csrf");
  await req("POST", "/api/auth/callback/credentials", { csrfToken: cs.json.csrfToken, email: "talha@test.com", password: "Xk9$mPz2#vLq8!Rw" });
  const s = await req("GET", "/api/auth/session");
  console.log("LOGIN:", s.json?.user ? "OK" : "FAILED");

  // 2. Save a Groq API key (BYOK)
  const groqKey = process.env.GROQ_API_KEY;
  const save = await req("POST", "/api/bot/keys", { provider: "groq", apiKey: groqKey });
  console.log("SAVE KEY:", save.status, save.json?.key ? `provider=${save.json.key.provider} hint=••••${save.json.key.keyHint}` : JSON.stringify(save.json));

  // 3. List keys
  const keys = await req("GET", "/api/bot/keys");
  console.log("KEYS:", keys.json?.keys?.length ?? 0, "saved");

  // 4. Start an analysis (NVDA — real TradingAgents run)
  const analyze = await req("POST", "/api/bot/analyze", { symbol: "NVDA", depth: 1 });
  console.log("ANALYZE:", analyze.status, analyze.json?.job_id ? `job=${analyze.json.job_id}` : JSON.stringify(analyze.json));

  if (analyze.json?.job_id) {
    console.log("Polling agents (this takes 1-4 min with real LLM calls)...");
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const st = await req("POST", "/api/bot/analyze", { jobId: analyze.json.job_id });
      if (st.json?.status === "completed") {
        console.log("VERDICT:", st.json.result.signal, "| took", st.json.durationSec + "s");
        console.log("REASONING:", (st.json.result.reasoning || "").slice(0, 300));
        process.exit(0);
      }
      if (st.json?.status === "failed") {
        console.log("FAILED:", (st.json.error || "").slice(0, 200));
        process.exit(1);
      }
      if (i % 6 === 0) console.log(`  ...${st.json?.progress ?? 0}%`);
    }
    console.log("Timed out after 5 min");
  }
})();