export interface BinancePayConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
}

export interface CreateOrderRequest {
  merchantTradeNo: string;
  orderAmount: number;
  currency: string;
  goods: {
    goodsType: "01" | "02";
    goodsCategory: string;
    goodsName: string;
    goodsDetail: string;
  }[];
  buyer?: {
    buyerId: string;
    buyerName?: string;
    buyerEmail?: string;
    buyerPhone?: string;
  };
  notifyUrl: string;
  returnUrl: string;
  validityTime?: string;
  validTime?: string;
}

export interface CreateOrderResponse {
  status: string;
  code: string;
  data: {
    prepayId: string;
    checkoutUrl: string;
    qrCodeLink: string;
    deeplink: string;
    universalLink: string;
    expireTime: number;
  };
  errorMessage?: string;
}

export interface QueryOrderRequest {
  merchantTradeNo?: string;
  prepayId?: string;
}

export interface QueryOrderResponse {
  status: string;
  code: string;
  data: {
    merchantTradeNo: string;
    prepayId: string;
    tradeState: "SUCCESS" | "FAIL" | "CLOSED" | "PAYING";
    totalFee: number;
    currency: string;
    payerInfo: {
      payerId: string;
      payerName?: string;
    };
    transactionId: string;
    payTime: number;
  };
  errorMessage?: string;
}

export interface WebhookPayload {
  merchantId: string;
  merchantTradeNo: string;
  prepayId: string;
  tradeState: "SUCCESS" | "FAIL" | "CLOSED";
  totalFee: number;
  currency: string;
  transactionId: string;
  payTime: number;
  sign: string;
}

export interface TransferRequest {
  payeeId: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface TransferResponse {
  status: string;
  code: string;
  data: {
    transferId: string;
    status: string;
  };
  errorMessage?: string;
}