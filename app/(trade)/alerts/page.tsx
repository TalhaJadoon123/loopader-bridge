import DashboardLayout from "@/components/layout/DashboardLayout";
import { AlertsScreen } from "@/components/trade/AlertsScreen";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <DashboardLayout>
      <AlertsScreen />
    </DashboardLayout>
  );
}