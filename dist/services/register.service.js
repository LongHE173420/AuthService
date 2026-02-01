"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhone = validatePhone;
exports.registerDraft = registerDraft;
exports.verifyRegisterOtp = verifyRegisterOtp;
exports.resendRegisterOtp = resendRegisterOtp;
const database_1 = require("../config/database");
const time_1 = require("../core/time");
const response_1 = require("../core/response");
const notifier_1 = require("../core/notifier");
const otpSession_1 = require("../core/otpSession");
function randOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
async function validatePhone(phoneRaw, deviceId) {
    const phone = String(phoneRaw || "").replace(/\D/g, ""); // keep digits only
    if (!phone)
        return (0, response_1.fail)("Thiếu số điện thoại");
    if (phone.length < 7 || phone.length > 15)
        return (0, response_1.fail)("Số điện thoại không hợp lệ");
    try {
        // Check if user already exists
        const [existingUsers] = await database_1.mysqlPool.query("SELECT id FROM users WHERE phone = ?", [phone]);
        if (Array.isArray(existingUsers) && existingUsers.length > 0)
            return (0, response_1.fail)("Người dùng đã tồn tại");
        // Check if registration is pending from another device
        const [pendingRegs] = await database_1.mysqlPool.query("SELECT id FROM pending_registrations WHERE phone = ? AND expiresAt > ? AND deviceId != ?", [phone, (0, time_1.now)(), deviceId]);
        if (Array.isArray(pendingRegs) && pendingRegs.length > 0) {
            return (0, response_1.fail)("Số điện thoại đang trong phiên đăng ký ở thiết bị khác");
        }
        return (0, response_1.ok)(null, "Có hiệu lực và khả dụng");
    }
    catch (error) {
        console.error("validatePhone error:", error);
        return (0, response_1.fail)("Lỗi kiểm tra số điện thoại: " + error.message);
    }
}
async function registerDraft(draft, deviceId) {
    const phone = String(draft.phone || "").replace(/\D/g, "");
    if (!phone)
        return (0, response_1.fail)("Thiếu số điện thoại");
    if (phone.length < 7 || phone.length > 15)
        return (0, response_1.fail)("Số điện thoại không hợp lệ");
    try {
        // Check if user exists
        const [existingUsers] = await database_1.mysqlPool.query("SELECT id FROM users WHERE phone = ?", [phone]);
        if (Array.isArray(existingUsers) && existingUsers.length > 0)
            return (0, response_1.fail)("Người dùng đã tồn tại");
        // Check if pending from another device
        const [pendingRegs] = await database_1.mysqlPool.query("SELECT id FROM pending_registrations WHERE phone = ? AND expiresAt > ? AND deviceId != ?", [phone, (0, time_1.now)(), deviceId]);
        if (Array.isArray(pendingRegs) && pendingRegs.length > 0) {
            return (0, response_1.fail)("Số điện thoại đang trong phiên đăng ký ở thiết bị khác");
        }
        // Generate OTP
        const otp = randOtp();
        const createdAt = (0, time_1.now)();
        const expiresAt = createdAt + otpSession_1.SESSION_5P_MS;
        // Delete old registration if exists (same device)
        await database_1.mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
        // Insert new pending registration
        await database_1.mysqlPool.query("INSERT INTO pending_registrations (phone, deviceId, otp, createdAt, expiresAt, resendCount, draftData) VALUES (?, ?, ?, ?, ?, ?, ?)", [phone, deviceId, otp, createdAt, expiresAt, 0, JSON.stringify(draft)]);
        (0, notifier_1.notifyOtp)(phone, otp, "REGISTER");
        return (0, response_1.ok)({ otpSample: otp }, `Đăng ký tạm thành công. OTP mẫu: ${otp}`);
    }
    catch (error) {
        console.error("registerDraft error:", error);
        return (0, response_1.fail)("Lỗi đăng ký: " + error.message);
    }
}
async function verifyRegisterOtp(phoneRaw, otpRaw, deviceId) {
    const phone = String(phoneRaw || "").replace(/\D/g, "");
    const otp = String(otpRaw || "");
    try {
        // Get pending registration
        const [pendingRegs] = await database_1.mysqlPool.query("SELECT * FROM pending_registrations WHERE phone = ?", [phone]);
        if (!Array.isArray(pendingRegs) || pendingRegs.length === 0)
            return (0, response_1.fail)("Không có phiên đăng ký");
        const pending = pendingRegs[0];
        if (pending.expiresAt <= (0, time_1.now)()) {
            await database_1.mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
            return (0, response_1.fail)("Phiên đăng ký đã hết hạn");
        }
        if (pending.deviceId !== deviceId)
            return (0, response_1.fail)("Sai thiết bị đăng ký");
        if (pending.otp !== otp)
            return (0, response_1.fail)("OTP không đúng");
        const draft = JSON.parse(pending.draftData);
        // Insert user into users table
        await database_1.mysqlPool.query("INSERT INTO users (phone, password, firstName, lastName, gender, dateOfBirth, trustRequired, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            phone,
            draft.password,
            draft.firstName,
            draft.lastName,
            draft.gender,
            draft.dateOfBirth,
            true, // trustRequired
            false, // revoked
        ]);
        // Delete pending registration
        await database_1.mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
        return (0, response_1.ok)(null, "Xác thực OTP đăng ký thành công");
    }
    catch (error) {
        console.error("verifyRegisterOtp error:", error);
        return (0, response_1.fail)("Lỗi xác thực OTP: " + error.message);
    }
}
async function resendRegisterOtp(phoneRaw, deviceId) {
    const phone = String(phoneRaw || "").replace(/\D/g, "");
    try {
        const [pendingRegs] = await database_1.mysqlPool.query("SELECT * FROM pending_registrations WHERE phone = ?", [phone]);
        if (!Array.isArray(pendingRegs) || pendingRegs.length === 0)
            return (0, response_1.fail)("Không có phiên đăng ký");
        const pending = pendingRegs[0];
        if (pending.deviceId !== deviceId)
            return (0, response_1.fail)("Sai thiết bị đăng ký");
        if (pending.expiresAt <= (0, time_1.now)()) {
            await database_1.mysqlPool.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
            return (0, response_1.fail)("Phiên đăng ký đã hết hạn");
        }
        // Create mock OtpSession object for phase check
        const mockSession = {
            otp: pending.otp,
            createdAt: pending.createdAt,
            expiresAt: pending.expiresAt,
            resendCount: pending.resendCount,
        };
        const phase = (0, otpSession_1.getPhase)(mockSession);
        if (!(0, otpSession_1.canResend)(mockSession)) {
            return (0, response_1.fail)(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
        }
        // Generate new OTP
        const newOtp = randOtp();
        const newCreatedAt = (0, time_1.now)();
        const newExpiresAt = newCreatedAt + otpSession_1.SESSION_5P_MS;
        const newResendCount = pending.resendCount + 1;
        // Update pending registration
        await database_1.mysqlPool.query("UPDATE pending_registrations SET otp = ?, createdAt = ?, expiresAt = ?, resendCount = ? WHERE phone = ?", [newOtp, newCreatedAt, newExpiresAt, newResendCount, phone]);
        (0, notifier_1.notifyOtp)(phone, newOtp, "REGISTER_RESEND");
        // Create new mock session for phase
        const newMockSession = {
            otp: newOtp,
            createdAt: newCreatedAt,
            expiresAt: newExpiresAt,
            resendCount: newResendCount,
        };
        return (0, response_1.ok)({ otpSample: newOtp, phase: (0, otpSession_1.getPhase)(newMockSession) }, `Đã gửi lại OTP. OTP mẫu: ${newOtp}`);
    }
    catch (error) {
        console.error("resendRegisterOtp error:", error);
        return (0, response_1.fail)("Lỗi gửi lại OTP: " + error.message);
    }
}
