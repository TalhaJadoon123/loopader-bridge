import { LpAdapter } from "./types";
import { StubLpAdapter } from "./stub";

let adapter: LpAdapter | null = null;

export function getLpAdapter(): LpAdapter {
  if (adapter) return adapter;

  const provider = process.env.LP_PROVIDER ?? "STUB";

  switch (provider) {
    case "MATCH_PRIME":
      // TODO: Import and return Match-Prime adapter
      console.warn("Match-Prime LP adapter not yet implemented, falling back to stub");
      adapter = new StubLpAdapter();
      break;
    case "B2BROKER":
      // TODO: Import and return B2Broker adapter
      console.warn("B2Broker LP adapter not yet implemented, falling back to stub");
      adapter = new StubLpAdapter();
      break;
    case "STUB":
    default:
      adapter = new StubLpAdapter();
      break;
  }

  return adapter;
}