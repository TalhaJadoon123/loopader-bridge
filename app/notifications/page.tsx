"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, AlertTriangle, TrendingUp, Wallet, Shield, Bot, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

const TYPE_ICONS: Record<string, any> = {
  trade: TrendingUp,
  alert: Bell,
  deposit: Wallet,
  withdrawal: Wallet,
  security: Shield,
  margin: AlertTriangle,
  coach: Bot,
  streak: Bell,
  default: Bell,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ readAll: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const unread = notifications.filter(n => !n.read).length;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">{unread} unread</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setFilter("all")}
                className={cn("px-3 py-1.5 text-sm", filter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={cn("px-3 py-1.5 text-sm", filter === "unread" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
              >
                Unread
              </button>
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-secondary rounded-lg hover:bg-secondary/80">
                <CheckCheck className="w-4 h-4" /> Mark all read
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Bell className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg">No notifications</p>
            <p className="text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n, i) => {
              const Icon = TYPE_ICONS[n.type] ?? TYPE_ICONS.default;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border transition-colors",
                    n.read ? "bg-card border-border" : "bg-primary/5 border-primary/30"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}