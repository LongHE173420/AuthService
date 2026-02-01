import { db } from "../db/db";
import { now } from "../core/time";
import { ok, fail, type ApiRes, type Tokens } from "../core/types";
import { notifyOtp } from "../core/notifier";
import { issueTokens, isRefreshExpired} from "../core/token";
import { SESSION_5P_MS, canResend, extendSessionOnResend, getPhase } from "../core/otpSession";

function randOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function login(usernameRaw: string, password: string, deviceId: string): ApiRes<any> {
  const username = usernameRaw.toLowerCase();
  const acc = db.accounts.get(username);
  if (!acc) return fail("Tài khoản không tồn tại");
  if (acc.password !== password) return fail("Sai mật khẩu");

  const needOtp = acc.trustRequired || !acc.trustedDevices.has(deviceId);

  if (needOtp) {
    const otp = randOtp();
    db.pendingLogin.set(`${username}|${deviceId}`, {
      username,
      deviceId,
      session: {
        otp,
        createdAt: now(),
        expiresAt: now() + SESSION_5P_MS,
        resendCount: 0
      }
    });

    notifyOtp(username, otp, "LOGIN");
    return ok({ needOtp: true, otpSample: otp }, `Cần OTP. OTP mẫu: ${otp}`);
  }

  const tokens = issueTokens(username, true);
  return ok({ needOtp: false, tokens }, "Đăng nhập thành công");
}

export function verifyLoginOtp(usernameRaw: string, otpRaw: string, deviceId: string): ApiRes<{ tokens: Tokens }> {
  const username = usernameRaw.toLowerCase();
  const otp = String(otpRaw || "");
  const key = `${username}|${deviceId}`;

  const pending = db.pendingLogin.get(key);
  if (!pending) return fail("Không có phiên OTP login");
  if (pending.session.expiresAt <= now()) {
    db.pendingLogin.delete(key);
    return fail("Phiên OTP đã hết hạn");
  }

  if (pending.session.otp !== otp) return fail("OTP không đúng");

  const acc = db.accounts.get(username);
  if (!acc) return fail("Tài khoản không tồn tại");

  acc.trustedDevices.add(deviceId);
  db.pendingLogin.delete(key);

  const tokens = issueTokens(username, true);
  return ok({ tokens }, "Xác thực OTP login thành công");
}

export function resendLoginOtp(usernameRaw: string, deviceId: string): ApiRes<{ otpSample: string; phase: string }> {
  const username = usernameRaw.toLowerCase();
  const key = `${username}|${deviceId}`;

  const pending = db.pendingLogin.get(key);
  if (!pending) return fail("Không có phiên OTP login");
  if (pending.session.expiresAt <= now()) {
    db.pendingLogin.delete(key);
    return fail("Phiên OTP đã hết hạn");
  }

  const phase = getPhase(pending.session);
  if (!canResend(pending.session)) {
    return fail(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
  }

  const otp = randOtp();
  pending.session.otp = otp;
  extendSessionOnResend(pending.session);
  db.pendingLogin.set(key, pending);

  notifyOtp(username, otp, "LOGIN_RESEND");
  return ok({ otpSample: otp, phase: getPhase(pending.session) }, `Đã gửi lại OTP. OTP mẫu: ${otp}`);
}

export function refresh(refreshToken: string): ApiRes<{ tokens: Tokens }> {
  if (isRefreshExpired(refreshToken)) {
    // TH2 refresh hết hạn -> client clear + login lại
    return fail("REFRESH_TOKEN_EXPIRED");
  }

  const username = refreshToken.split(".")[1]?.toLowerCase?.() ?? "";
  if (!username) return fail("Refresh token không hợp lệ");

  const acc = db.accounts.get(username);
  if (!acc) return fail("Tài khoản không tồn tại");

  // TH3 refresh fail do revoked
  if (acc.revoked) return fail("REVOKED_DEVICE_OTHER_LOGIN");

  const tokens = issueTokens(username, true);
  return ok({ tokens }, "Refresh token thành công");
}

// debug: set revoked để test refresh fail
export function debugRevoke(usernameRaw: string): ApiRes<null> {
  const username = usernameRaw.toLowerCase();
  const acc = db.accounts.get(username);
  if (!acc) return fail("Tài khoản không tồn tại");
  acc.revoked = true;
  return ok(null, "Đã revoke (refresh sẽ fail)");
}
