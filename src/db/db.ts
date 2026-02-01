import type { Account } from "../core/types";

export type PendingRegister = {
  username: string;
  deviceId: string;
  draft: any;
  session: {
    otp: string;
    createdAt: number;
    expiresAt: number;
    resendCount: number;
  };
};

export type PendingLoginOtp = {
  username: string;
  deviceId: string;
  session: {
    otp: string;
    createdAt: number;
    expiresAt: number;
    resendCount: number;
  };
};

export const db = {
  accounts: new Map<string, Account>(),
  pendingRegs: new Map<string, PendingRegister>(),            // key=username
  pendingLogin: new Map<string, PendingLoginOtp>()            // key=username|device
};

(function seed() {
  const a1: Account = {
    username: "needtrust@test.com",
    password: "123456",
    firstName: "Need",
    lastName: "Trust",
    gender: "MALE",
    dateOfBirth: "2001-01-01",
    trustRequired: true,
    trustedDevices: new Set(),
    revoked: false
  };

  const a2: Account = {
    username: "ready@test.com",
    password: "123456",
    firstName: "Ready",
    lastName: "User",
    gender: "FEMALE",
    dateOfBirth: "2002-02-02",
    trustRequired: false,
    trustedDevices: new Set(["dev-123456"]),
    revoked: false
  };

  db.accounts.set(a1.username.toLowerCase(), a1);
  db.accounts.set(a2.username.toLowerCase(), a2);
})();
