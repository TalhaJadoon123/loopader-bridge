export interface LpAdapter {
  placeOrder(order: LpOrder): Promise<LpOrderResult>;
  closeOrder(orderId: string): Promise<LpCloseResult>;
  getBalance(): Promise<number>;
  getOpenPositions(): Promise<LpPosition[]>;
}

export interface LpOrder {
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price?: number;
  sl?: number;
  tp?: number;
  clientOrderId: string;
  accountType: "DEMO" | "LIVE";
}

export interface LpOrderResult {
  lpOrderId: string;
  filledPrice: number;
  status: "filled" | "partial" | "rejected" | "pending";
}

export interface LpCloseResult {
  closedPrice: number;
  pnl: number;
  status: "closed" | "partial" | "rejected";
}

export interface LpPosition {
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  currentPrice: number;
  pnl: number;
}