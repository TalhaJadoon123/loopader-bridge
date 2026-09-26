"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ErrorBoundary fallback={<ErrorFallback />}>
          {children}
        </ErrorBoundary>
      </ThemeProvider>
    </SessionProvider>
  );
}

function ErrorFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">An unexpected error occurred. Please try refreshing the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}