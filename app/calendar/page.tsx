import DashboardLayout from "@/components/layout/DashboardLayout";
import { CalendarHeatmap } from "@/components/dashboard/CalendarHeatmap";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <DashboardLayout>
      <CalendarHeatmap />
    </DashboardLayout>
  );
}