import { mysqlPool } from "../config/database";
import { now } from "../core/time";
import { type Tokens } from "../core/types";
import { type ApiRes, ok, fail } from "../core/response";
import { notifyOtp } from "../core/notifier";
import { issueTokens, isRefreshExpired} from "../core/token";
import { SESSION_5P_MS, canResend, extendSessionOnResend, getPhase } from "../core/otpSession";
import logger from "../config/logger";
import httpAdapter from "./httpAdapter";
import { isClientMode } from "../config/mode";

function randOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function login(usernameRaw: string, password: string, deviceId: string): Promise<ApiRes<any>> {
  const phone = String(usernameRaw || "").replace(/\D/g, "");
  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/login', { username: phone, password }, { 'x-device-id': deviceId });
    return res.data;
  }
  let connection: any;
  
  try {
    connection = await mysqlPool.getConnection();
    
    const [users] = await connection.query(
      "SELECT id, phone, password, trustRequired FROM users WHERE phone = ?",
      [phone]
    ) as any;

    if (!Array.isArray(users) || users.length === 0) {
      return fail("Tài khoản không tồn tại");
    }

    const user = users[0] as any;
    if (user.password !== password) return fail("Sai mật khẩu");

    // Check if device is trusted
    const [trustedDevices] = await connection.query(
      "SELECT id FROM trusted_devices WHERE userId = ? AND deviceId = ?",
      [user.id, deviceId]
    ) as any;

    const isTrusted = Array.isArray(trustedDevices) && trustedDevices.length > 0;
    const needOtp = user.trustRequired || !isTrusted;

    if (needOtp) {
      const otp = randOtp();
      const createdAt = now();
      const expiresAt = createdAt + SESSION_5P_MS;

      // Delete old pending login if exists
      await connection.query(
        "DELETE FROM pending_login WHERE phone = ? AND deviceId = ?",
        [phone, deviceId]
      );

      // Insert new pending login
      await connection.query(
        "INSERT INTO pending_login (phone, deviceId, otp, createdAt, expiresAt, resendCount) VALUES (?, ?, ?, ?, ?, ?)",
        [phone, deviceId, otp, createdAt, expiresAt, 0]
      );

      notifyOtp(phone, otp, "LOGIN");
      return ok({ needOtp: true, otpSample: otp }, `Cần OTP. OTP mẫu: ${otp}`);
    }

    const tokens = issueTokens(phone, true);
    return ok({ needOtp: false, tokens }, "Đăng nhập thành công");
  } catch (error: any) {
    logger.error("login error:", { error: error.message, phone });
    return fail("Lỗi đăng nhập: " + error.message);
  } finally {
    if (connection) connection.release();
  }
}

export async function verifyLoginOtp(usernameRaw: string, otpRaw: string, deviceId: string): Promise<ApiRes<{ tokens: Tokens }>> {
  const phone = String(usernameRaw || "").replace(/\D/g, "");
  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/verify-login-otp', { username: phone, otp: otpRaw }, { 'x-device-id': deviceId });
    return res.data;
  }
  const otp = String(otpRaw || "");
  let connection: any;

  try {
    connection = await mysqlPool.getConnection();
    
    const [pendingLogins] = await connection.query(
      "SELECT * FROM pending_login WHERE phone = ? AND deviceId = ?",
      [phone, deviceId]
    ) as any;

    if (!Array.isArray(pendingLogins) || pendingLogins.length === 0) {
      return fail("Không có phiên OTP login");
    }

    const pending = pendingLogins[0] as any;
    if (pending.expiresAt <= now()) {
      await connection.query("DELETE FROM pending_login WHERE phone = ? AND deviceId = ?", [phone, deviceId]);
      return fail("Phiên OTP đã hết hạn");
    }

    if (pending.otp !== otp) return fail("OTP không đúng");

    // Get user
    const [users] = await connection.query(
      "SELECT id FROM users WHERE phone = ?",
      [phone]
    ) as any;

    if (!Array.isArray(users) || users.length === 0) {
      return fail("Tài khoản không tồn tại");
    }

    const userId = (users[0] as any).id;

    // Add to trusted devices
    await connection.query(
      "INSERT IGNORE INTO trusted_devices (userId, deviceId) VALUES (?, ?)",
      [userId, deviceId]
    );

    // Delete pending login
    await connection.query("DELETE FROM pending_login WHERE phone = ? AND deviceId = ?", [phone, deviceId]);

    const tokens = issueTokens(phone, true);
    return ok({ tokens }, "Xác thực OTP login thành công");
  } catch (error: any) {
    logger.error("verifyLoginOtp error:", { error: error.message, phone });
    return fail("Lỗi xác thực OTP: " + error.message);
  } finally {
    if (connection) connection.release();
  }
}

export async function resendLoginOtp(usernameRaw: string, deviceId: string): Promise<ApiRes<{ otpSample: string; phase: string }>> {
  const phone = String(usernameRaw || "").replace(/\D/g, "");
  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/resend-otp-login', { username: phone }, { 'x-device-id': deviceId });
    return res.data;
  }
  let connection: any;

  try {
    connection = await mysqlPool.getConnection();
    
    const [pendingLogins] = await connection.query(
      "SELECT * FROM pending_login WHERE phone = ? AND deviceId = ?",
      [phone, deviceId]
    ) as any;

    if (!Array.isArray(pendingLogins) || pendingLogins.length === 0) {
      return fail("Không có phiên OTP login");
    }

    const pending = pendingLogins[0] as any;
    if (pending.expiresAt <= now()) {
      await connection.query("DELETE FROM pending_login WHERE phone = ? AND deviceId = ?", [phone, deviceId]);
      return fail("Phiên OTP đã hết hạn");
    }

    // Create mock OtpSession for phase check
    const mockSession = {
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
      resendCount: pending.resendCount
    };

    const phase = getPhase(mockSession as any);
    if (!canResend(mockSession as any)) {
      return fail(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
    }

    const otp = randOtp();
    const newExpiresAt = now() + SESSION_5P_MS;
    const newResendCount = pending.resendCount + 1;

    await connection.query(
      "UPDATE pending_login SET otp = ?, expiresAt = ?, resendCount = ? WHERE phone = ? AND deviceId = ?",
      [otp, newExpiresAt, newResendCount, phone, deviceId]
    );

    notifyOtp(phone, otp, "LOGIN_RESEND");
    return ok({ otpSample: otp, phase: getPhase({ createdAt: pending.createdAt, expiresAt: newExpiresAt, resendCount: newResendCount } as any) }, `Đã gửi lại OTP. OTP mẫu: ${otp}`);
  } catch (error: any) {
    logger.error("resendLoginOtp error:", { error: error.message, phone });
    return fail("Lỗi gửi lại OTP: " + error.message);
  } finally {
    if (connection) connection.release();
  }
}

export async function refresh(refreshToken: string): Promise<ApiRes<{ tokens: Tokens }>> {
  if (isRefreshExpired(refreshToken)) {
    // TH2 refresh hết hạn -> client clear + login lại
    return fail("REFRESH_TOKEN_EXPIRED");
  }

  const phone = refreshToken.split(".")[1]?.toLowerCase?.() ?? "";
  if (!phone) return fail("Refresh token không hợp lệ");

  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/refresh-token', { refreshToken });
    return res.data;
  }

  let connection: any;

  try {
    connection = await mysqlPool.getConnection();
    
    const [users] = await connection.query(
      "SELECT revoked FROM users WHERE phone = ?",
      [phone]
    ) as any;

    if (!Array.isArray(users) || users.length === 0) {
      return fail("Tài khoản không tồn tại");
    }

    const user = users[0] as any;
    // TH3 refresh fail do revoked
    if (user.revoked) return fail("REVOKED_DEVICE_OTHER_LOGIN");

    const tokens = issueTokens(phone, true);
    return ok({ tokens }, "Refresh token thành công");
  } catch (error: any) {
    logger.error("refresh error:", { error: error.message, phone });
    return fail("Lỗi refresh token: " + error.message);
  } finally {
    if (connection) connection.release();
  }
}

// debug: set revoked để test refresh fail
export async function debugRevoke(usernameRaw: string): Promise<ApiRes<null>> {
  const phone = String(usernameRaw || "").replace(/\D/g, "");
  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/debug/revoke', { username: phone });
    return res.data;
  }
  let connection: any;

  try {
    connection = await mysqlPool.getConnection();
    
    const [result] = await connection.query(
      "UPDATE users SET revoked = 1 WHERE phone = ?",
      [phone]
    ) as any;

    if ((result as any).affectedRows === 0) {
      return fail("Tài khoản không tồn tại");
    }

    return ok(null, "Đã revoke (refresh sẽ fail)");
  } catch (error: any) {
    logger.error("debugRevoke error:", { error: error.message, phone });
    return fail("Lỗi revoke: " + error.message);
  } finally {
    if (connection) connection.release();
  }
}
