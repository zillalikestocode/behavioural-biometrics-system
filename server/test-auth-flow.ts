/**
 * Minimal integration test for auth flows (run with Bun)
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const fetchFn: any = (globalThis as any).fetch;

async function login(username: string, password: string) {
  const res = await fetchFn(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      riskScore: 0.4,
      features: {
        holdTimes: [90, 85, 95, 100],
        flightTimes: [60, 55, 65],
        errorRate: 0.03,
        typingSpeed: 220,
        timestamp: Date.now(),
      },
    }),
  });
  const data: any = await res.json();
  return { status: res.status, data };
}

async function stepUp(challengeId: string, solution: string) {
  const res = await fetchFn(`${BASE}/api/auth/step-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId, solution }),
  });
  const data: any = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log("Testing lowrisk login (should GRANT)...");
  const low = await login("lowrisk", "pass123");
  console.log(low);

  console.log("Testing normal login (may STEP_UP)...");
  const normal = await login("normal", "pass123");
  console.log(normal);

  if (
    (normal.data as any)?.action === "STEP_UP" &&
    (normal.data as any).challengeId
  ) {
    console.log("Completing step-up with sample solution '42' (may fail)...");
    const s = await stepUp((normal.data as any).challengeId, "42");
    console.log(s);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
