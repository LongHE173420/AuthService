import { db } from "../db/db";
import { now } from "../core/time";
import { ok, fail, type ApiRes, type Gender } from "../core/types";
import { notifyOtp } from "../core/notifier";
import { SESSION_5P_MS, canResend, extendSessionOnResend, getPhase } from "../core/otpSession";

function randOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export type RegisterDraft = {
  username: string;
  password: string;
  confirmedPassword: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string; // YYYY-MM-DD
};

export function validateUsername(usernameRaw: string, deviceId: string): ApiRes<null> {
  const username = usernameRaw.toLowerCase();
  if (!username) return fail("Thiếu username");

  if (db.accounts.has(username)) return fail("Người dùng đã tồn tại");

  const pending = db.pendingRegs.get(username);
  if (pending && pending.session.expiresAt > now() && pending.deviceId !== deviceId) {
    return fail("Email đang trong phiên đăng ký ở thiết bị khác");
  }

  return ok(null, "Có hiệu lực và khả dụng");
}

export function registerDraft(draft: RegisterDraft, deviceId: string): ApiRes<{ otpSample: string }> {
  const username = String(draft.username || "").toLowerCase();
  if (!username) return fail("Thiếu username");
  if (db.accounts.has(username)) return fail("Người dùng đã tồn tại");

  const pending = db.pendingRegs.get(username);
  if (pending && pending.session.expiresAt > now() && pending.deviceId !== deviceId) {
    return fail("Email đang trong phiên đăng ký ở thiết bị khác");
  }

  // TH3: cùng device -> giữ session, chỉ update draft (nhưng otp mới cho dễ test)
  const otp = randOtp();

  db.pendingRegs.set(username, {
    username,
    deviceId,
    draft,
    session: {
      otp,
      createdAt: now(),
      expiresAt: now() + SESSION_5P_MS,
      resendCount: pending?.session.resendCount ?? 0
    }
  });

  notifyOtp(username, otp, "REGISTER");
  return ok({ otpSample: otp }, `Đăng ký tạm thành công. OTP mẫu: ${otp}`);
}

export function verifyRegisterOtp(usernameRaw: string, otpRaw: string, deviceId: string): ApiRes<null> {
  const username = usernameRaw.toLowerCase();
  const otp = String(otpRaw || "");

  const pending = db.pendingRegs.get(username);
  if (!pending) return fail("Không có phiên đăng ký");
  if (pending.session.expiresAt <= now()) {
    db.pendingRegs.delete(username);
    return fail("Phiên đăng ký đã hết hạn");
  }
  if (pending.deviceId !== deviceId) return fail("Sai thiết bị đăng ký");
  if (pending.session.otp !== otp) return fail("OTP không đúng");

  const d = pending.draft as RegisterDraft;

  db.accounts.set(username, {
    username,
    password: d.password,
    firstName: d.firstName,
    lastName: d.lastName,
    gender: d.gender,
    dateOfBirth: d.dateOfBirth,
    trustRequired: true, // tài khoản mới mặc định cần trust
    trustedDevices: new Set(),
    revoked: false
  });

  db.pendingRegs.delete(username);
  return ok(null, "Xác thực OTP đăng ký thành công");
}

export function resendRegisterOtp(usernameRaw: string, deviceId: string): ApiRes<{ otpSample: string; phase: string }> {
  const username = usernameRaw.toLowerCase();
  const pending = db.pendingRegs.get(username);
  if (!pending) return fail("Không có phiên đăng ký");

  if (pending.deviceId !== deviceId) return fail("Sai thiết bị đăng ký");
  if (pending.session.expiresAt <= now()) {
    db.pendingRegs.delete(username);
    return fail("Phiên đăng ký đã hết hạn");
  }

  const phase = getPhase(pending.session);
  if (!canResend(pending.session)) {
    return fail(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
  }

  const otp = randOtp();
  pending.session.otp = otp;
  extendSessionOnResend(pending.session);

  db.pendingRegs.set(username, pending);

  notifyOtp(username, otp, "REGISTER_RESEND");
  return ok(
    { otpSample: otp, phase: getPhase(pending.session) },
    `Đã gửi lại OTP. OTP mẫu: ${otp}`
  );
}
