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

(async () => {
  const cs = await req("GET", "/api/auth/csrf");
  await req("POST", "/api/auth/callback/credentials", { csrfToken: cs.json.csrfToken, email: "talha@test.com", password: "Xk9$mPz2#vLq8!Rw" });
  const s = await req("GET", "/api/auth/session");
  console.log("LOGIN:", s.json?.user ? "OK" : "FAILED");

  const chat = await req("POST", "/api/coach/chat", { message: "In one sentence: what is a pip in forex?" });
  console.log("COACH:", chat.status, chat.json?.response?.slice(0, 200) ?? JSON.stringify(chat.json).slice(0, 200));
})();