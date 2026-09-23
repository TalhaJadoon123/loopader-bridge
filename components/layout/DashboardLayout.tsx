"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  List,
  History,
  Bell,
  Users,
  Bot,
  Brain,
  Search,
  Calendar,
  Wallet,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Flame,
  Shield,
  Zap,
  BarChart2,
  Calculator,
  BookOpen,
  Code,
  Gift,
  Smartphone,
  Copy,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GuidedTour } from "@/components/dashboard/GuidedTour";
import AccountSwitcher from "@/components/account/AccountSwitcher";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: TrendingUp },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/positions", label: "Positions", icon: List },
  { href: "/history", label: "History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/scanner", label: "Scanner", icon: Search },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/news", label: "News", icon: TrendingUp },
  { href: "/social", label: "Social", icon: Users },
  { href: "/copy-trading", label: "Copy Trading", icon: Copy },
  { href: "/coach", label: "AI Coach", icon: Bot },
  { href: "/bot", label: "AI Analyst", icon: Brain },
  { href: "/education", label: "Learn", icon: BookOpen },
  { href: "/tools", label: "Calculators", icon: Calculator },
  { href: "/referral", label: "Refer & Earn", icon: Gift },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/developers", label: "Developers", icon: Code },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [accounts, setAccounts] = useState<Array<{ id: string; type: "DEMO" | "LIVE"; balance: number; equity: number; isDefault: boolean; isTradingEnabled: boolean }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unread ?? data.unreadCount ?? (data.notifications ?? []).filter((n: any) => !n.isRead).length);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/account/list");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const handleSwitch = async (accountId: string) => {
    await fetch("/api/account/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    fetchAccounts();
  };

  useEffect(() => {
    fetchUnread();
    fetchAccounts();
    const t = setInterval(fetchUnread, 60000);
    return () => clearInterval(t);
  }, [fetchUnread, fetchAccounts, pathname]);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (status === "unauthenticated") return <div className="min-h-screen flex items-center justify-center">Please log in</div>;

  return (
    <div className="min-h-screen bg-background flex">
      <motion.aside
        initial={{ width: collapsed ? 72 : 260 }}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2 }}
        className="bg-card border-r border-border flex flex-col h-screen fixed left-0 top-0 z-40"
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {!collapsed && (
            <Link href="/dashboard" className="font-bold text-xl text-primary flex items-center gap-2">
              <Zap className="w-6 h-6" />
              Loopader
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border pt-4 px-4"
            >
              <Link
                href="/settings"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-secondary hover:text-destructive-foreground transition-colors mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Log out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      <main className="flex-1 ml-0 lg:ml-[260px] min-h-screen" style={{ marginLeft: collapsed ? 72 : 260 }}>
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">Loopader</h1>
            {session?.user && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-mono">Standard</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {session?.user && !loadingAccounts && (
              <AccountSwitcher accounts={accounts} onSwitch={handleSwitch} />
            )}
            <Link href="/notifications" className="relative p-2 rounded-full hover:bg-secondary transition-colors" aria-label="Notifications">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              <span className="font-mono">Passkey</span>
            </div>
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-primary-foreground font-semibold text-sm">
              {session?.user?.name?.[0] ?? session?.user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>
        </header>

        <div className="p-6">{children}</div>
      </main>
      <GuidedTour />
    </div>
  );
}