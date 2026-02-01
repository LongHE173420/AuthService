"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUsername = validateUsername;
exports.registerDraft = registerDraft;
exports.verifyRegisterOtp = verifyRegisterOtp;
exports.resendRegisterOtp = resendRegisterOtp;
const db_1 = require("../db/db");
const time_1 = require("../core/time");
const types_1 = require("../core/types");
const notifier_1 = require("../core/notifier");
const otpSession_1 = require("../core/otpSession");
function randOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function validateUsername(usernameRaw, deviceId) {
    const username = usernameRaw.toLowerCase();
    if (!username)
        return (0, types_1.fail)("Thiếu username");
    if (db_1.db.accounts.has(username))
        return (0, types_1.fail)("Người dùng đã tồn tại");
    const pending = db_1.db.pendingRegs.get(username);
    if (pending && pending.session.expiresAt > (0, time_1.now)() && pending.deviceId !== deviceId) {
        return (0, types_1.fail)("Email đang trong phiên đăng ký ở thiết bị khác");
    }
    return (0, types_1.ok)(null, "Có hiệu lực và khả dụng");
}
function registerDraft(draft, deviceId) {
    const username = String(draft.username || "").toLowerCase();
    if (!username)
        return (0, types_1.fail)("Thiếu username");
    if (db_1.db.accounts.has(username))
        return (0, types_1.fail)("Người dùng đã tồn tại");
    const pending = db_1.db.pendingRegs.get(username);
    if (pending && pending.session.expiresAt > (0, time_1.now)() && pending.deviceId !== deviceId) {
        return (0, types_1.fail)("Email đang trong phiên đăng ký ở thiết bị khác");
    }
    // TH3: cùng device -> giữ session, chỉ update draft (nhưng otp mới cho dễ test)
    const otp = randOtp();
    db_1.db.pendingRegs.set(username, {
        username,
        deviceId,
        draft,
        session: {
            otp,
            createdAt: (0, time_1.now)(),
            expiresAt: (0, time_1.now)() + otpSession_1.SESSION_5P_MS,
            resendCount: pending?.session.resendCount ?? 0
        }
    });
    (0, notifier_1.notifyOtp)(username, otp, "REGISTER");
    return (0, types_1.ok)({ otpSample: otp }, `Đăng ký tạm thành công. OTP mẫu: ${otp}`);
}
function verifyRegisterOtp(usernameRaw, otpRaw, deviceId) {
    const username = usernameRaw.toLowerCase();
    const otp = String(otpRaw || "");
    const pending = db_1.db.pendingRegs.get(username);
    if (!pending)
        return (0, types_1.fail)("Không có phiên đăng ký");
    if (pending.session.expiresAt <= (0, time_1.now)()) {
        db_1.db.pendingRegs.delete(username);
        return (0, types_1.fail)("Phiên đăng ký đã hết hạn");
    }
    if (pending.deviceId !== deviceId)
        return (0, types_1.fail)("Sai thiết bị đăng ký");
    if (pending.session.otp !== otp)
        return (0, types_1.fail)("OTP không đúng");
    const d = pending.draft;
    db_1.db.accounts.set(username, {
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
    db_1.db.pendingRegs.delete(username);
    return (0, types_1.ok)(null, "Xác thực OTP đăng ký thành công");
}
function resendRegisterOtp(usernameRaw, deviceId) {
    const username = usernameRaw.toLowerCase();
    const pending = db_1.db.pendingRegs.get(username);
    if (!pending)
        return (0, types_1.fail)("Không có phiên đăng ký");
    if (pending.deviceId !== deviceId)
        return (0, types_1.fail)("Sai thiết bị đăng ký");
    if (pending.session.expiresAt <= (0, time_1.now)()) {
        db_1.db.pendingRegs.delete(username);
        return (0, types_1.fail)("Phiên đăng ký đã hết hạn");
    }
    const phase = (0, otpSession_1.getPhase)(pending.session);
    if (!(0, otpSession_1.canResend)(pending.session)) {
        return (0, types_1.fail)(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
    }
    const otp = randOtp();
    pending.session.otp = otp;
    (0, otpSession_1.extendSessionOnResend)(pending.session);
    db_1.db.pendingRegs.set(username, pending);
    (0, notifier_1.notifyOtp)(username, otp, "REGISTER_RESEND");
    return (0, types_1.ok)({ otpSample: otp, phase: (0, otpSession_1.getPhase)(pending.session) }, `Đã gửi lại OTP. OTP mẫu: ${otp}`);
}
