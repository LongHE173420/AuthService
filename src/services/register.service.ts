import { mysqlPool } from "../config/database";
import { now } from "../core/time";
import { type Gender } from "../core/types";
import { type ApiRes, ok, fail } from "../core/response";
import { notifyOtp } from "../core/notifier";
import { SESSION_5P_MS, canResend, extendSessionOnResend, getPhase } from "../core/otpSession";
import logger from "../config/logger";
import httpAdapter from "./httpAdapter";
import { isClientMode } from "../config/mode";
import fs from "fs";
import { parse } from "csv-parse/sync";

function randOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export type RegisterDraft = {
  phone: string; // digits only, e.g. "84901234567"
  password: string;
  confirmedPassword: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string; // YYYY-MM-DD
};

export async function validatePhone(phoneRaw: string, deviceId: string): Promise<ApiRes<null>> {
  const phone = String(phoneRaw || "").replace(/\D/g, ""); // keep digits only
  if (!phone) return fail("Thiếu số điện thoại");
  if (phone.length < 7 || phone.length > 15) return fail("Số điện thoại không hợp lệ");

  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/validate-phone', { phone }, { 'x-device-id': deviceId });
    return res.data;
  }

  try {
    // Check if user already exists
    const [existingUsers] = await mysqlPool.query("SELECT id FROM users WHERE phone = ?", [phone]) as any;
    if (Array.isArray(existingUsers) && existingUsers.length > 0) return fail("Người dùng đã tồn tại");

    // Check if registration is pending from another device
    const [pendingRegs] = await mysqlPool.query(
      "SELECT id FROM pending_registrations WHERE phone = ? AND expiresAt > ? AND deviceId != ?",
      [phone, now(), deviceId]
    ) as any;
    if (Array.isArray(pendingRegs) && pendingRegs.length > 0) {
      return fail("Số điện thoại đang trong phiên đăng ký ở thiết bị khác");
    }

    return ok(null, "Có hiệu lực và khả dụng");
  } catch (error: any) {
    logger.error("validatePhone error:", { error: error.message, phone: phoneRaw });
    return fail("Lỗi kiểm tra số điện thoại: " + error.message);
  }
} 

export async function registerDraft(draft: RegisterDraft, deviceId: string): Promise<ApiRes<{ otpSample: string }>> {
  const phone = String(draft.phone || "").replace(/\D/g, "");
  if (!phone) return fail("Thiếu số điện thoại");
  if (phone.length < 7 || phone.length > 15) return fail("Số điện thoại không hợp lệ");

  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/register', draft, { 'x-device-id': deviceId });
    return res.data;
  }

  try {
    // Check if user exists
    const [existingUsers] = await mysqlPool.query("SELECT id FROM users WHERE phone = ?", [phone]) as any;
    if (Array.isArray(existingUsers) && existingUsers.length > 0) return fail("Người dùng đã tồn tại");

    // Check if pending from another device
    const [pendingRegs] = await mysqlPool.query(
      "SELECT id FROM pending_registrations WHERE phone = ? AND expiresAt > ? AND deviceId != ?",
      [phone, now(), deviceId]
    ) as any;
    if (Array.isArray(pendingRegs) && pendingRegs.length > 0) {
      return fail("Số điện thoại đang trong phiên đăng ký ở thiết bị khác");
    }

    // Generate OTP
    const otp = randOtp();
    const createdAt = now();
    const expiresAt = createdAt + SESSION_5P_MS;

    // Delete old registration if exists (same device)
    await mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);

    // Insert new pending registration
    await mysqlPool.query(
      "INSERT INTO pending_registrations (phone, deviceId, otp, createdAt, expiresAt, resendCount, draftData) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [phone, deviceId, otp, createdAt, expiresAt, 0, JSON.stringify(draft)]
    );

    notifyOtp(phone, otp, "REGISTER");
    return ok({ otpSample: otp }, `Đăng ký tạm thành công. OTP mẫu: ${otp}`);
  } catch (error: any) {
    logger.error("registerDraft error:", { error: error.message, phone: draft.phone });
    return fail("Lỗi đăng ký: " + error.message);
  }
} 

export async function verifyRegisterOtp(phoneRaw: string, otpRaw: string, deviceId: string): Promise<ApiRes<null>> {
  const phone = String(phoneRaw || "").replace(/\D/g, "");
  const otp = String(otpRaw || "");

  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/verify-register-otp', { phone, otp }, { 'x-device-id': deviceId });
    return res.data;
  }

  try {
    // Get pending registration
    const [pendingRegs] = await mysqlPool.query(
      "SELECT * FROM pending_registrations WHERE phone = ?",
      [phone]
    ) as any;

    if (!Array.isArray(pendingRegs) || pendingRegs.length === 0) return fail("Không có phiên đăng ký");

    const pending = pendingRegs[0] as any;

    if (pending.expiresAt <= now()) {
      await mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
      return fail("Phiên đăng ký đã hết hạn");
    }

    if (pending.deviceId !== deviceId) return fail("Sai thiết bị đăng ký");
    if (pending.otp !== otp) return fail("OTP không đúng");

    const draft = typeof pending.draftData === 'string' ? JSON.parse(pending.draftData) : pending.draftData;

    // Insert user into users table
    await mysqlPool.query(
      "INSERT INTO users (phone, password, firstName, lastName, gender, dateOfBirth, deviceId, trustRequired, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        phone,
        draft.password,
        draft.firstName,
        draft.lastName,
        draft.gender,
        draft.dateOfBirth,
        deviceId,
        true, // trustRequired
        false, // revoked
      ]
    );

    // Delete pending registration
    await mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);

    return ok(null, "Xác thực OTP đăng ký thành công");
  } catch (error: any) {
    logger.error("verifyRegisterOtp error:", { error: error.message, phone: phoneRaw });
    return fail("Lỗi xác thực OTP: " + error.message);
  }
} 

export async function resendRegisterOtp(phoneRaw: string, deviceId: string): Promise<ApiRes<{ otpSample: string; phase: string }>> {
  const phone = String(phoneRaw || "").replace(/\D/g, "");

  if (isClientMode()) {
    const res = await httpAdapter.post('/auth/resend-otp-register', { phone }, { 'x-device-id': deviceId });
    return res.data;
  }

  try {
    const [pendingRegs] = await mysqlPool.query(
      "SELECT * FROM pending_registrations WHERE phone = ?",
      [phone]
    ) as any;

    if (!Array.isArray(pendingRegs) || pendingRegs.length === 0) return fail("Không có phiên đăng ký");

    const pending = pendingRegs[0] as any;

    if (pending.deviceId !== deviceId) return fail("Sai thiết bị đăng ký");
    if (pending.expiresAt <= now()) {
      await mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
      return fail("Phiên đăng ký đã hết hạn");
    }

    // Create mock OtpSession object for phase check
    const mockSession = {
      otp: pending.otp,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
      resendCount: pending.resendCount,
    };

    const phase = getPhase(mockSession);
    if (!canResend(mockSession)) {
      return fail(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
    }

    // Generate new OTP
    const newOtp = randOtp();
    const newCreatedAt = now();
    const newExpiresAt = newCreatedAt + SESSION_5P_MS;
    const newResendCount = pending.resendCount + 1;

    // Update pending registration
    await mysqlPool.query(
      "UPDATE pending_registrations SET otp = ?, createdAt = ?, expiresAt = ?, resendCount = ? WHERE phone = ?",
      [newOtp, newCreatedAt, newExpiresAt, newResendCount, phone]
    );

    notifyOtp(phone, newOtp, "REGISTER_RESEND");

    // Create new mock session for phase
    const newMockSession = {
      otp: newOtp,
      createdAt: newCreatedAt,
      expiresAt: newExpiresAt,
      resendCount: newResendCount,
    };

    return ok(
      { otpSample: newOtp, phase: getPhase(newMockSession) },
      `Đã gửi lại OTP. OTP mẫu: ${newOtp}`
    );
  } catch (error: any) {
    logger.error("resendRegisterOtp error:", { error: error.message, phone: phoneRaw });
    return fail("Lỗi gửi lại OTP: " + error.message);
  }
}

// ===== Bulk Register =====

export type BulkRegisterResult = {
  phone: string;
  success: boolean;
  message: string;
  otp?: string;
  deviceId: string;
};

/**
 * Đọc file CSV và parse thành array các row
 */
function readCsvFile(filePath: string): RegisterDraft[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row: any) => ({
    phone: row.phone,
    password: row.password,
    confirmedPassword: row.confirmedPassword || row.password,
    firstName: row.firstName || "Auto",
    lastName: row.lastName || "User",
    gender: row.gender || "MALE",
    dateOfBirth: row.dateOfBirth || "2000-01-01",
  }));
}

/**
 * Đăng ký hàng loạt từ file CSV
 */
export async function bulkRegisterFromCsv(
  filePath: string,
  autoVerifyOtp: boolean = true,
  deviceIdBase: string = "bulk"
): Promise<BulkRegisterResult[]> {
  console.log(`📋 Đọc file CSV: ${filePath}`);

  let records: RegisterDraft[] = [];
  try {
    records = readCsvFile(filePath);
    logger.info(`✅ Đọc thành công ${records.length} dòng`);
  } catch (err: any) {
    logger.error("Lỗi đọc file CSV:", { error: err.message, filePath });
    return [];
  }

  const results: BulkRegisterResult[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const deviceId = `${deviceIdBase}-${i + 1}`;

    console.log(`\n[${i + 1}/${records.length}] 📱 Xử lý: ${row.phone} | Device: ${deviceId}`);

    try {
      // 1️⃣ Validate phone
      console.log(`  → Validate phone...`);
      const validateRes = await validatePhone(row.phone, deviceId);
      if (!validateRes.isSucceed) {
        throw new Error(validateRes.message);
      }

      // 2️⃣ Register draft & nhận OTP
      console.log(`  → Gửi request register...`);
      const registerRes = await registerDraft(row, deviceId);
      if (!registerRes.isSucceed) {
        throw new Error(registerRes.message);
      }

      const otp = registerRes.data?.otpSample;
      console.log(`  → OTP: ${otp}`);

      // 3️⃣ Verify OTP (tự động cho local test)
      if (autoVerifyOtp && otp) {
        console.log(`  → Auto-verify OTP...`);
        const verifyRes = await verifyRegisterOtp(row.phone, otp, deviceId);
        if (!verifyRes.isSucceed) {
          throw new Error("Lỗi verify OTP: " + verifyRes.message);
        }
        console.log(`  ✅ Đăng ký thành công!`);
      }

      results.push({
        phone: row.phone,
        success: true,
        message: "Đăng ký thành công",
        otp,
        deviceId,
      });
    } catch (err: any) {
      console.error(`  ❌ Lỗi: ${err.message}`);
      results.push({
        phone: row.phone,
        success: false,
        message: err.message,
        deviceId,
      });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TỔNG KẾT:");
  console.log(`  ✅ Thành công: ${results.filter(r => r.success).length}`);
  console.log(`  ❌ Thất bại: ${results.filter(r => !r.success).length}`);
  console.log(`  📱 Tổng: ${results.length}`);
  console.log("=".repeat(60));

  return results;
}

/**
 * Export kết quả vào CSV
 */
export function exportResultsToCsv(results: BulkRegisterResult[], outputPath: string) {
  const headers = "phone,success,message,otp,deviceId\n";
  const rows = results
    .map(
      (r) =>
        `"${r.phone}","${r.success}","${r.message}","${r.otp || ""}","${r.deviceId}"`
    )
    .join("\n");

  fs.writeFileSync(outputPath, headers + rows, "utf-8");
  console.log(`✅ Kết quả export: ${outputPath}`);
}
