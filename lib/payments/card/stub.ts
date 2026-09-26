import { CardProcessor, CreatePaymentIntentRequest, CardIntent, CardCapture, CardRefund } from "./types";

export class StubCardProcessor implements CardProcessor {
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CardIntent> {
    throw new Error("Card payments not configured. Set CARD_PROCESSOR=STRIPE or CARD_PROCESSOR=HIGHRISK and provide credentials.");
  }

  async capturePayment(intentId: string): Promise<CardCapture> {
    throw new Error("Card payments not configured. Set CARD_PROCESSOR=STRIPE or CARD_PROCESSOR=HIGHRISK and provide credentials.");
  }

  async refundPayment(intentId: string, amount?: number): Promise<CardRefund> {
    throw new Error("Card payments not configured. Set CARD_PROCESSOR=STRIPE or CARD_PROCESSOR=HIGHRISK and provide credentials.");
  }

  verifyWebhook(payload: any, signature: string): boolean {
    return false;
  }
}