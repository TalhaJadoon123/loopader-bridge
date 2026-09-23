import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      kycStatus: string;
      passkeyEnabled: boolean;
      twoFactorEnabled: boolean;
    };
  }

  interface User {
    id: string;
    role: string;
    kycStatus: string;
    passkeyEnabled: boolean;
    twoFactorEnabled: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    kycStatus: string;
    passkeyEnabled: boolean;
    twoFactorEnabled: boolean;
  }
}