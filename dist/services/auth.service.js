"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.verifyLoginOtp = verifyLoginOtp;
exports.resendLoginOtp = resendLoginOtp;
exports.refresh = refresh;
exports.debugRevoke = debugRevoke;
const db_1 = require("../db/db");
const time_1 = require("../core/time");
const types_1 = require("../core/types");
const notifier_1 = require("../core/notifier");
const token_1 = require("../core/token");
const otpSession_1 = require("../core/otpSession");
function randOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function login(usernameRaw, password, deviceId) {
    const username = usernameRaw.toLowerCase();
    const acc = db_1.db.accounts.get(username);
    if (!acc)
        return (0, types_1.fail)("Tài khoản không tồn tại");
    if (acc.password !== password)
        return (0, types_1.fail)("Sai mật khẩu");
    const needOtp = acc.trustRequired || !acc.trustedDevices.has(deviceId);
    if (needOtp) {
        const otp = randOtp();
        db_1.db.pendingLogin.set(`${username}|${deviceId}`, {
            username,
            deviceId,
            session: {
                otp,
                createdAt: (0, time_1.now)(),
                expiresAt: (0, time_1.now)() + otpSession_1.SESSION_5P_MS,
                resendCount: 0
            }
        });
        (0, notifier_1.notifyOtp)(username, otp, "LOGIN");
        return (0, types_1.ok)({ needOtp: true, otpSample: otp }, `Cần OTP. OTP mẫu: ${otp}`);
    }
    const tokens = (0, token_1.issueTokens)(username, true);
    return (0, types_1.ok)({ needOtp: false, tokens }, "Đăng nhập thành công");
}
function verifyLoginOtp(usernameRaw, otpRaw, deviceId) {
    const username = usernameRaw.toLowerCase();
    const otp = String(otpRaw || "");
    const key = `${username}|${deviceId}`;
    const pending = db_1.db.pendingLogin.get(key);
    if (!pending)
        return (0, types_1.fail)("Không có phiên OTP login");
    if (pending.session.expiresAt <= (0, time_1.now)()) {
        db_1.db.pendingLogin.delete(key);
        return (0, types_1.fail)("Phiên OTP đã hết hạn");
    }
    if (pending.session.otp !== otp)
        return (0, types_1.fail)("OTP không đúng");
    const acc = db_1.db.accounts.get(username);
    if (!acc)
        return (0, types_1.fail)("Tài khoản không tồn tại");
    acc.trustedDevices.add(deviceId);
    db_1.db.pendingLogin.delete(key);
    const tokens = (0, token_1.issueTokens)(username, true);
    return (0, types_1.ok)({ tokens }, "Xác thực OTP login thành công");
}
function resendLoginOtp(usernameRaw, deviceId) {
    const username = usernameRaw.toLowerCase();
    const key = `${username}|${deviceId}`;
    const pending = db_1.db.pendingLogin.get(key);
    if (!pending)
        return (0, types_1.fail)("Không có phiên OTP login");
    if (pending.session.expiresAt <= (0, time_1.now)()) {
        db_1.db.pendingLogin.delete(key);
        return (0, types_1.fail)("Phiên OTP đã hết hạn");
    }
    const phase = (0, otpSession_1.getPhase)(pending.session);
    if (!(0, otpSession_1.canResend)(pending.session)) {
        return (0, types_1.fail)(`Không thể resend lúc này (phase=${phase}) hoặc đã quá số lần`);
    }
    const otp = randOtp();
    pending.session.otp = otp;
    (0, otpSession_1.extendSessionOnResend)(pending.session);
    db_1.db.pendingLogin.set(key, pending);
    (0, notifier_1.notifyOtp)(username, otp, "LOGIN_RESEND");
    return (0, types_1.ok)({ otpSample: otp, phase: (0, otpSession_1.getPhase)(pending.session) }, `Đã gửi lại OTP. OTP mẫu: ${otp}`);
}
function refresh(refreshToken) {
    if ((0, token_1.isRefreshExpired)(refreshToken)) {
        // TH2 refresh hết hạn -> client clear + login lại
        return (0, types_1.fail)("REFRESH_TOKEN_EXPIRED");
    }
    const username = refreshToken.split(".")[1]?.toLowerCase?.() ?? "";
    if (!username)
        return (0, types_1.fail)("Refresh token không hợp lệ");
    const acc = db_1.db.accounts.get(username);
    if (!acc)
        return (0, types_1.fail)("Tài khoản không tồn tại");
    // TH3 refresh fail do revoked
    if (acc.revoked)
        return (0, types_1.fail)("REVOKED_DEVICE_OTHER_LOGIN");
    const tokens = (0, token_1.issueTokens)(username, true);
    return (0, types_1.ok)({ tokens }, "Refresh token thành công");
}
// debug: set revoked để test refresh fail
function debugRevoke(usernameRaw) {
    const username = usernameRaw.toLowerCase();
    const acc = db_1.db.accounts.get(username);
    if (!acc)
        return (0, types_1.fail)("Tài khoản không tồn tại");
    acc.revoked = true;
    return (0, types_1.ok)(null, "Đã revoke (refresh sẽ fail)");
}
