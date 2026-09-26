"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import * as Switch from "@radix-ui/react-switch";
import { Shield, Bell, Eye, Fingerprint, LogOut, Trash2, AlertTriangle, Smartphone, Key, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    autoLogout: true,
    appearAnonymous: false,
    darkMode: true,
  });
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePanicFreeze = async () => {
    await fetch("/api/auth/panic", { method: "POST" });
    signOut({ callbackUrl: "/" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences</p>
        </div>

        <SettingsSection icon={Shield} title="Security">
          <SettingsRow icon={Fingerprint} label="Passkeys" desc="Face ID / fingerprint login">
            <button className="px-4 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20">Manage</button>
          </SettingsRow>
          <SettingsRow icon={Key} label="Two-Factor Auth" desc="Extra layer of security for withdrawals">
            <button className="px-4 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20">Setup</button>
          </SettingsRow>
          <SettingsRow icon={Eye} label="Appear Anonymous" desc="Hide your name in social features">
            <Switch.Root
              checked={settings.appearAnonymous}
              onCheckedChange={() => handleToggle("appearAnonymous")}
              className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </SettingsRow>
          <SettingsRow icon={Smartphone} label="Auto-logout" desc="Log out after 5 min idle on trade screen">
            <Switch.Root
              checked={settings.autoLogout}
              onCheckedChange={() => handleToggle("autoLogout")}
              className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection icon={Bell} title="Notifications">
          <SettingsRow icon={Bell} label="Push Notifications" desc="Trade alerts, margin calls, deposits">
            <Switch.Root
              checked={settings.pushNotifications}
              onCheckedChange={() => handleToggle("pushNotifications")}
              className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </SettingsRow>
          <SettingsRow icon={Bell} label="Email Notifications" desc="Weekly review, streak reminders">
            <Switch.Root
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle("emailNotifications")}
              className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection icon={AlertTriangle} title="Danger Zone" danger>
          <SettingsRow icon={AlertTriangle} label="Freeze My Account" desc="Instantly freeze all trading. Reversible via support.">
            {confirming === "freeze" ? (
              <div className="flex gap-2">
                <button
                  onClick={handlePanicFreeze}
                  className="px-4 py-1.5 text-sm bg-destructive text-white rounded-lg hover:opacity-90"
                >
                  Confirm Freeze
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="px-4 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming("freeze")}
                className="px-4 py-1.5 text-sm bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20"
              >
                Freeze
              </button>
            )}
          </SettingsRow>
          <SettingsRow icon={LogOut} label="Log Out" desc="End your current session">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80"
            >
              Log Out
            </button>
          </SettingsRow>
        </SettingsSection>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Account: {session?.user?.email ?? "—"}</p>
            <p>Role: {session?.user?.role ?? "User"}</p>
            <p>KYC: {session?.user?.kycStatus ?? "Pending"}</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SettingsSection({ icon: Icon, title, children, danger }: any) {
  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden", danger ? "border-destructive/30" : "border-border")}>
      <div className={cn("px-6 py-4 border-b flex items-center gap-2", danger ? "border-destructive/30 bg-destructive/5" : "border-border")}>
        <Icon className={cn("w-5 h-5", danger ? "text-destructive" : "text-primary")} />
        <h2 className={cn("font-semibold", danger ? "text-destructive" : "")}>{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, desc, children }: any) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-start gap-3 flex-1">
        <Icon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}