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
  const s = await req("GET", "/api/auth/session");
  console.log("LOGIN:", s.json?.user ? "OK" : "FAILED");

  // Try saving the B.AI custom key
  const save = await req("POST", "/api/bot/keys", {
    provider: "custom",
    apiKey: "sk-yn9doqxbqydgcqms06uxin444xerm8kb",
    baseUrl: "https://api.b.ai/v1",
    model: "glm-5.3-flash"
  });
  console.log("SAVE STATUS:", save.status);
  console.log("SAVE RESPONSE:", JSON.stringify(save.json));
})();