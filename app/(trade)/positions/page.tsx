import DashboardLayout from "@/components/layout/DashboardLayout";
import { PositionsScreen } from "@/components/trade/PositionsScreen";

export const dynamic = "force-dynamic";

export default function PositionsPage() {
  return (
    <DashboardLayout>
      <PositionsScreen />
    </DashboardLayout>
  );
}