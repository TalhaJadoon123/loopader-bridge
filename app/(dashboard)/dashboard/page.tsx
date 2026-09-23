import DashboardLayout from "@/components/layout/DashboardLayout";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardScreen />
    </DashboardLayout>
  );
}