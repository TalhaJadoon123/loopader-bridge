import crypto from "crypto";

export interface DeviceFingerprint {
  fp: string;
  components: Record<string, unknown>;
}

export function hashFingerprint(fp: string): string {
  return crypto.createHash("sha256").update(fp).digest("hex").substring(0, 32);
}

export function parseDeviceInfo(userAgent: string): { browser: string; os: string; device: string } {
  const ua = userAgent.toLowerCase();
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") || ua.includes("crios/")) browser = "Chrome";
  else if (ua.includes("firefox/") || ua.includes("fxios/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";

  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) device = "Mobile";
  else if (ua.includes("tablet") || ua.includes("ipad")) device = "Tablet";

  return { browser, os, device };
}

export function isVpnUserAgent(userAgent: string): boolean {
  const vpnIndicators = ["vpns", "proxy", "tor", "tunnelbear", "nordvpn", "expressvpn", "protonvpn", "surfshark"];
  const ua = userAgent.toLowerCase();
  return vpnIndicators.some((v) => ua.includes(v));
}