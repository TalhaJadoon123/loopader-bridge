const BASE = "https://loopader.vercel.app";
const jobId = "7b47e7f72f03";

(async () => {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(BASE + "/api/bot/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const j = await res.json();
    if (j.status === "completed") {
      console.log("✅ VERDICT:", j.result?.signal);
      console.log("⏱ Duration:", j.durationSec + "s");
      console.log("📝 REASONING:", (j.result?.reasoning || "").slice(0, 500));
      console.log("\nSTEPS:");
      (j.steps || []).forEach(s => console.log(`  [${s.elapsedSec}s] ${s.step}`));
      process.exit(0);
    }
    if (j.status === "failed") {
      console.log("❌ FAILED:", (j.error || "").slice(0, 300));
      process.exit(1);
    }
    if (i % 12 === 0) {
      console.log(`${i * 5}s — ${j.status} ${j.progress}% | steps: ${(j.steps || []).length}`);
      (j.steps || []).slice(-1).forEach(s => console.log(`  last: [${s.elapsedSec}s] ${s.step}`));
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log("Timed out after 10 min");
})();