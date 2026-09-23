import { CardProcessor } from "./types";
import { StubCardProcessor } from "./stub";

let processor: CardProcessor | null = null;

export function getCardProcessor(): CardProcessor {
  if (processor) return processor;

  const processorType = process.env.CARD_PROCESSOR ?? "STUB";

  switch (processorType) {
    case "STRIPE":
      // TODO: Import and return Stripe processor
      console.warn("Stripe card processor not yet implemented, falling back to stub");
      processor = new StubCardProcessor();
      break;
    case "HIGHRISK":
      // TODO: Import and return High-risk PSP processor (Corepay, WebPays, Fibonatix)
      console.warn("High-risk PSP card processor not yet implemented, falling back to stub");
      processor = new StubCardProcessor();
      break;
    case "STUB":
    default:
      processor = new StubCardProcessor();
      break;
  }

  return processor;
}