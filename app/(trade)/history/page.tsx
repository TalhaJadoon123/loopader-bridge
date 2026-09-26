import DashboardLayout from "@/components/layout/DashboardLayout";
import { HistoryScreen } from "@/components/trade/HistoryScreen";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <HistoryScreen />
    </DashboardLayout>
  );
}