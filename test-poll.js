const BASE = "https://loopader.vercel.app";
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
  const cs = await req("GET", "/api/auth/csrf");
  await req("POST", "/api/auth/callback/credentials", { csrfToken: cs.json.csrfToken, email: "talha@test.com", password: "Xk9$mPz2#vLq8!Rw" });

  for (let i = 0; i < 100; i++) {
    const st = await req("POST", "/api/bot/analyze", { jobId: "75e83b0508d2" });
    if (st.json?.status === "completed") {
      console.log("VERDICT:", st.json.result?.signal, "| took", st.json.durationSec + "s");
      console.log("SIGNAL:", st.json.result?.signal);
      console.log("REASONING:", (st.json.result?.reasoning || "").slice(0, 500));
      process.exit(0);
    }
    if (st.json?.status === "failed") {
      console.log("FAILED:", (st.json.error || "").slice(0, 300));
      process.exit(1);
    }
    if (i % 10 === 0) console.log(`${i * 5}s — ${st.json?.status} ${st.json?.progress}%`);
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log("Timed out");
})();