"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Account {
  id: string;
  type: "DEMO" | "LIVE";
  balance: number;
  equity: number;
  isDefault: boolean;
  isTradingEnabled: boolean;
}

interface AccountSwitcherProps {
  accounts: Account[];
  onSwitch: (accountId: string) => Promise<void>;
}

export default function AccountSwitcher({ accounts, onSwitch }: AccountSwitcherProps) {
  const router = useRouter();
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const defaultAcc = accounts.find((a) => a.isDefault);
    if (defaultAcc) setActiveAccount(defaultAcc);
  }, [accounts]);

  const handleSwitch = async (account: Account) => {
    if (account.id === activeAccount?.id) return;
    await onSwitch(account.id);
    setActiveAccount(account);
    router.refresh();
  };

  if (accounts.length === 0) return null;

  const formatBalance = (balance: number) => `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-1.5">
          {activeAccount && (
            <>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  activeAccount.type === "DEMO"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                }`}
              >
                {activeAccount.type}
              </span>
              {activeAccount.type === "LIVE" && !activeAccount.isTradingEnabled && (
                <span className="relative">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                  <span className="sr-only">Live trading disabled</span>
                </span>
              )}
              <span className="font-mono text-sm">{formatBalance(activeAccount.equity || activeAccount.balance)}</span>
            </>
          )}
        </span>
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 origin-top-right rounded-lg bg-popover border shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="py-1" role="listbox">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleSwitch(account)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors ${
                  account.id === activeAccount?.id ? "bg-accent" : ""
                }`}
                role="option"
                aria-selected={account.id === activeAccount?.id}
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                    account.type === "DEMO"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  }`}
                >
                  {account.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {account.type === "DEMO" ? "Practice Account" : "Live Account"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {formatBalance(account.equity || account.balance)}
                  </p>
                </div>
                {account.type === "LIVE" && !account.isTradingEnabled && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>LP not configured</span>
                  </span>
                )}
                {account.isDefault && (
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}