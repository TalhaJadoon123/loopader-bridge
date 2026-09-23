import crypto from "crypto";
import {
  BinancePayConfig,
  CreateOrderRequest,
  CreateOrderResponse,
  QueryOrderRequest,
  QueryOrderResponse,
  WebhookPayload,
  TransferRequest,
  TransferResponse,
} from "./types";

let config: BinancePayConfig | null = null;

function getConfig(): BinancePayConfig {
  if (config) return config;

  const merchantId = process.env.BINANCE_PAY_MERCHANT_ID;
  const apiKey = process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_PAY_API_SECRET;
  const webhookSecret = process.env.BINANCE_PAY_WEBHOOK_SECRET;
  const baseUrl = process.env.BINANCE_PAY_BASE_URL ?? "https://bpay.binanceapi.com";

  if (!merchantId || !apiKey || !apiSecret || !webhookSecret) {
    throw new Error("Binance Pay not configured. Set BINANCE_PAY_MERCHANT_ID, BINANCE_PAY_API_KEY, BINANCE_PAY_API_SECRET, BINANCE_PAY_WEBHOOK_SECRET");
  }

  config = { merchantId, apiKey, apiSecret, webhookSecret, baseUrl };
  return config;
}

function generateTimestamp(): string {
  return Date.now().toString();
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function signRequest(payload: string, timestamp: string, nonce: string, secret: string): string {
  const message = `${timestamp}\n${nonce}\n${payload}\n`;
  return crypto.createHmac("sha512", secret).update(message).digest("hex").toUpperCase();
}

function buildHeaders(payload: string, config: BinancePayConfig): Record<string, string> {
  const timestamp = generateTimestamp();
  const nonce = generateNonce();
  const signature = signRequest(payload, timestamp, nonce, config.apiSecret);

  return {
    "Content-Type": "application/json",
    "BinancePay-Timestamp": timestamp,
    "BinancePay-Nonce": nonce,
    "BinancePay-Signature": signature,
    "BinancePay-Certificate-SN": config.apiKey,
  };
}

export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  const cfg = getConfig();
  const payload = JSON.stringify(request);
  const headers = buildHeaders(payload, cfg);

  const response = await fetch(`${cfg.baseUrl}/binancepay/openapi/v3/order`, {
    method: "POST",
    headers,
    body: payload,
  });

  const data = await response.json();
  return data as CreateOrderResponse;
}

export async function queryOrder(request: QueryOrderRequest): Promise<QueryOrderResponse> {
  const cfg = getConfig();
  const payload = JSON.stringify(request);
  const headers = buildHeaders(payload, cfg);

  const response = await fetch(`${cfg.baseUrl}/binancepay/openapi/v3/queryOrder`, {
    method: "POST",
    headers,
    body: payload,
  });

  const data = await response.json();
  return data as QueryOrderResponse;
}

export async function transferToUser(request: TransferRequest): Promise<TransferResponse> {
  const cfg = getConfig();
  const payload = JSON.stringify(request);
  const headers = buildHeaders(payload, cfg);

  const response = await fetch(`${cfg.baseUrl}/binancepay/openapi/v3/transfer`, {
    method: "POST",
    headers,
    body: payload,
  });

  const data = await response.json();
  return data as TransferResponse;
}

export function verifyWebhook(payload: WebhookPayload, signature: string): boolean {
  // Allow bypass in test mode (non-production only)
  if (process.env.WEBHOOK_TEST_MODE === "true" && process.env.NODE_ENV !== "production") {
    console.warn("[binancepay] WEBHOOK_TEST_MODE — signature verification bypassed");
    return true;
  }
  // Guard against test mode in production
  if (process.env.WEBHOOK_TEST_MODE === "true" && process.env.NODE_ENV === "production") {
    throw new Error("WEBHOOK_TEST_MODE cannot be enabled in production");
  }

  const cfg = getConfig();
  const { sign, ...data } = payload;
  const payloadStr = JSON.stringify(data);
  const expectedSign = crypto
    .createHmac("sha512", cfg.webhookSecret)
    .update(payloadStr)
    .digest("hex")
    .toUpperCase();
  return signature === expectedSign;
}

export function parseWebhookEvent(payload: WebhookPayload): {
  eventType: "PAY_SUCCESS" | "PAY_CLOSED" | "PAY_FAILED";
  merchantTradeNo: string;
  prepayId: string;
  amount: number;
  currency: string;
  transactionId: string;
  paidAt: Date;
} {
  const eventMap: Record<string, "PAY_SUCCESS" | "PAY_CLOSED" | "PAY_FAILED"> = {
    SUCCESS: "PAY_SUCCESS",
    FAIL: "PAY_FAILED",
    CLOSED: "PAY_CLOSED",
  };

  return {
    eventType: eventMap[payload.tradeState] ?? "PAY_FAILED",
    merchantTradeNo: payload.merchantTradeNo,
    prepayId: payload.prepayId,
    amount: payload.totalFee,
    currency: payload.currency,
    transactionId: payload.transactionId,
    paidAt: new Date(payload.payTime),
  };
}