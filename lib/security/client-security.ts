"use client";

// Security monitoring — detects and blocks suspicious client-side behavior
// Runs in the browser, sends data to the backend for server-side enforcement

let requestCount = 0;
let windowStart = Date.now();

// Detect rapid-fire clicking (bot behavior)
export function trackRequest() {
  requestCount++;
  const now = Date.now();
  if (now - windowStart > 60000) {
    requestCount = 0;
    windowStart = now;
  }
  return requestCount <= 100; // max 100 requests/min client-side
}

// Detect dev tools opening (basic detection)
export function detectDevTools(): boolean {
  const threshold = 160;
  return (
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold
  );
}

// Detect if page is in an iframe (clickjacking protection)
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// Sanitize user input before sending to API (client-side defense in depth)
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<img[^>]*on\w+\s*=\s*["']?[^"'>]*["']?[^>]*>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .trim();
}

// Validate that a number is safe (no NaN, Infinity, or extremely large values)
export function safeNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num) || Math.abs(num) > 1e15) return fallback;
  return num;
}