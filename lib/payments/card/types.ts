export interface CardProcessor {
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CardIntent>;
  capturePayment(intentId: string): Promise<CardCapture>;
  refundPayment(intentId: string, amount?: number): Promise<CardRefund>;
  verifyWebhook(payload: any, signature: string): boolean;
}

export interface CreatePaymentIntentRequest {
  amountUsd: number;
  orderId: string;
  userId: string;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface CardIntent {
  intentId: string;
  clientSecret?: string;
  status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
  redirectUrl?: string;
  amount: number;
  currency: string;
}

export interface CardCapture {
  intentId: string;
  status: "succeeded" | "failed";
  txId?: string;
  capturedAt?: Date;
  amountCaptured: number;
}

export interface CardRefund {
  refundId: string;
  status: "succeeded" | "failed" | "pending";
  amount: number;
}