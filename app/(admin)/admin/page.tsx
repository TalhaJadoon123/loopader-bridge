import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  // Non-admins get a 404 — don't reveal the route exists
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    // Return a 404 page instead of redirect (doesn't reveal admin exists)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-muted-foreground/30">404</h1>
          <p className="text-muted-foreground mt-2">Page not found</p>
        </div>
      </div>
    );
  }

  // Double-check: also verify user exists in DB with ADMIN role (not just session token)
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, accountFrozen: true },
  });
  await prisma.$disconnect();

  if (!user || user.role !== "ADMIN" || user.accountFrozen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-muted-foreground/30">404</h1>
          <p className="text-muted-foreground mt-2">Page not found</p>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}