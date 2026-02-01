import { now } from "./time";

export type OtpPhase = "VERIFY" | "RESEND" | "EXPIRED";

export const VERIFY_SECONDS = 3 * 60;
export const RESEND_SECONDS = 2 * 60;
export const SESSION_5P_MS = 5 * 60_000;
export const MAX_RESEND = 2;

export type OtpSession = {
  otp: string;
  createdAt: number;     // ms
  expiresAt: number;     // ms (session 5p, extend khi resend)
  resendCount: number;   // tối đa 2
};

// Phase dựa trên elapsed so với createdAt,
// nhưng vẫn bị chặn bởi expiresAt (5p)
export function getPhase(s: OtpSession): OtpPhase {
  const t = now();
  if (t >= s.expiresAt) return "EXPIRED";

  const elapsedSec = Math.floor((t - s.createdAt) / 1000);

  if (elapsedSec < VERIFY_SECONDS) return "VERIFY";
  if (elapsedSec < VERIFY_SECONDS + RESEND_SECONDS) return "RESEND";
  return "EXPIRED";
}

export function secondsLeftInWindow(s: OtpSession): number {
  const t = now();
  if (t >= s.expiresAt) return 0;

  const elapsedSec = Math.floor((t - s.createdAt) / 1000);
  if (elapsedSec < VERIFY_SECONDS) return VERIFY_SECONDS - elapsedSec;

  const resendElapsed = elapsedSec - VERIFY_SECONDS;
  const left = RESEND_SECONDS - resendElapsed;
  return left > 0 ? left : 0;
}

export function canVerify(s: OtpSession): boolean {
  return getPhase(s) !== "EXPIRED";
}

export function canResend(s: OtpSession): boolean {
  return getPhase(s) === "RESEND" && s.resendCount < MAX_RESEND;
}

export function extendSessionOnResend(s: OtpSession) {
  s.resendCount += 1;
  // resend -> reset "createdAt" để user có lại 3 phút nhập OTP mới
  s.createdAt = now();
  // nới session thêm 5p tính từ hiện tại
  s.expiresAt = now() + SESSION_5P_MS;
}
