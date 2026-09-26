import axios from "axios";
import crypto from "crypto";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY ?? "";
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET ?? "";
const NOWPAYMENTS_SANDBOX = process.env.NOWPAYMENTS_SANDBOX === "true";
const BASE_URL = NOWPAYMENTS_SANDBOX ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "x-api-key": NOWPAYMENTS_API_KEY, "Content-Type": "application/json" },
});

export interface NowPaymentsInvoiceRequest {
  priceAmount: number;
  priceCurrency: string;
  payCurrency?: string;
  orderId: string;
  orderDescription?: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface NowPaymentsInvoiceResponse {
  id: string;
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  priceAmount: number;
  priceCurrency: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  purchaseUrl: string;
}

export async function createInvoice(req: NowPaymentsInvoiceRequest): Promise<NowPaymentsInvoiceResponse> {
  if (!NOWPAYMENTS_API_KEY) throw new Error("NOWPayments not configured");

  const res = await axiosInstance.post<NowPaymentsInvoiceResponse>("/invoice", {
    price_amount: req.priceAmount,
    price_currency: req.priceCurrency,
    pay_currency: req.payCurrency,
    order_id: req.orderId,
    order_description: req.orderDescription,
    ipn_callback_url: req.ipnCallbackUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/nowpayments/callback`,
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
  });
  return res.data;
}

export async function getPaymentStatus(paymentId: string): Promise<NowPaymentsInvoiceResponse> {
  if (!NOWPAYMENTS_API_KEY) throw new Error("NOWPayments not configured");
  const res = await axiosInstance.get<NowPaymentsInvoiceResponse>(`/payment/${paymentId}`);
  return res.data;
}

export function verifyIPN(payload: any, signature: string): boolean {
  // Allow bypass in test mode (non-production only)
  if (process.env.WEBHOOK_TEST_MODE === "true" && process.env.NODE_ENV !== "production") {
    console.warn("[nowpayments] WEBHOOK_TEST_MODE — IPN signature verification bypassed");
    return true;
  }
  // Guard against test mode in production
  if (process.env.WEBHOOK_TEST_MODE === "true" && process.env.NODE_ENV === "production") {
    throw new Error("WEBHOOK_TEST_MODE cannot be enabled in production");
  }

  const expectedSignature = crypto
    .createHmac("sha512", NOWPAYMENTS_IPN_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
  return signature === expectedSignature;
}

export const NOWPAYMENTS_CURRENCIES = [
  "BTC", "ETH", "USDT", "USDC", "BNB", "XRP", "ADA", "DOGE", "LTC", "BCH",
  "TRX", "SOL", "DOT", "MATIC", "AVAX", "LINK", "UNI", "ATOM", "NEAR", "FTM",
];