import DashboardLayout from "@/components/layout/DashboardLayout";
import { TradeScreen } from "@/components/trade/TradeScreen";

export const dynamic = "force-dynamic";

export default function TradePage() {
  return (
    <DashboardLayout>
      <TradeScreen />
    </DashboardLayout>
  );
}