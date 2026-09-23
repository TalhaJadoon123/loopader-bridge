import { LpAdapter, LpOrder, LpOrderResult, LpCloseResult, LpPosition } from "./types";

export class StubLpAdapter implements LpAdapter {
  async placeOrder(order: LpOrder): Promise<LpOrderResult> {
    throw new Error("LP not configured. Set LP_ENABLED=true and configure LP_PROVIDER.");
  }

  async closeOrder(orderId: string): Promise<LpCloseResult> {
    throw new Error("LP not configured. Set LP_ENABLED=true and configure LP_PROVIDER.");
  }

  async getBalance(): Promise<number> {
    throw new Error("LP not configured. Set LP_ENABLED=true and configure LP_PROVIDER.");
  }

  async getOpenPositions(): Promise<LpPosition[]> {
    throw new Error("LP not configured. Set LP_ENABLED=true and configure LP_PROVIDER.");
  }
}