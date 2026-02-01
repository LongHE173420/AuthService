"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const register_service_1 = require("../services/register.service");
const auth_service_1 = require("../services/auth.service");
const types_1 = require("../core/types");
const otpSession_1 = require("../core/otpSession");
const db_1 = require("../db/db");
exports.authRoutes = (0, express_1.Router)();
function deviceIdFrom(req) {
    return (req.headers["x-device-id"] || "dev-123456");
}
// ===== Register
exports.authRoutes.post("/validate-username", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const { username } = req.body ?? {};
        const out = (0, register_service_1.validateUsername)(String(username ?? ""), deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_VALIDATE_USERNAME"));
    }
});
exports.authRoutes.post("/register", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const out = (0, register_service_1.registerDraft)(req.body, deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_REGISTER"));
    }
});
exports.authRoutes.post("/verify-register-otp", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const { username, otp } = req.body ?? {};
        const out = (0, register_service_1.verifyRegisterOtp)(String(username ?? ""), String(otp ?? ""), deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_VERIFY_REGISTER_OTP"));
    }
});
exports.authRoutes.post("/resend-otp-register", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const { username } = req.body ?? {};
        const out = (0, register_service_1.resendRegisterOtp)(String(username ?? ""), deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_RESEND_REGISTER_OTP"));
    }
});
// helper debug: xem trạng thái OTP session register
exports.authRoutes.get("/debug/register-session", (req, res) => {
    const username = String(req.query.username ?? "").toLowerCase();
    const p = db_1.db.pendingRegs.get(username);
    if (!p)
        return res.json((0, types_1.fail)("NO_PENDING_REGISTER"));
    res.json((0, types_1.ok)({
        username,
        deviceId: p.deviceId,
        phase: (0, otpSession_1.getPhase)(p.session),
        secondsLeft: (0, otpSession_1.secondsLeftInWindow)(p.session),
        resendCount: p.session.resendCount
    }));
});
// ===== Login
exports.authRoutes.post("/login", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const { username, password } = req.body ?? {};
        const out = (0, auth_service_1.login)(String(username ?? ""), String(password ?? ""), deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_LOGIN"));
    }
});
exports.authRoutes.post("/verify-login-otp", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const { username, otp } = req.body ?? {};
        const out = (0, auth_service_1.verifyLoginOtp)(String(username ?? ""), String(otp ?? ""), deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_VERIFY_LOGIN_OTP"));
    }
});
exports.authRoutes.post("/resend-otp-login", (req, res) => {
    try {
        const deviceId = deviceIdFrom(req);
        const { username } = req.body ?? {};
        const out = (0, auth_service_1.resendLoginOtp)(String(username ?? ""), deviceId);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_RESEND_LOGIN_OTP"));
    }
});
// helper debug: xem trạng thái OTP session login
exports.authRoutes.get("/debug/login-session", (req, res) => {
    const username = String(req.query.username ?? "").toLowerCase();
    const deviceId = String(req.query.deviceId ?? "dev-123456");
    const p = db_1.db.pendingLogin.get(`${username}|${deviceId}`);
    if (!p)
        return res.json((0, types_1.fail)("NO_PENDING_LOGIN_OTP"));
    res.json((0, types_1.ok)({
        username,
        deviceId,
        phase: (0, otpSession_1.getPhase)(p.session),
        secondsLeft: (0, otpSession_1.secondsLeftInWindow)(p.session),
        resendCount: p.session.resendCount
    }));
});
// ===== Refresh
exports.authRoutes.post("/refresh-token", (req, res) => {
    try {
        const { refreshToken } = req.body ?? {};
        const out = (0, auth_service_1.refresh)(String(refreshToken ?? ""));
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_REFRESH"));
    }
});
// ===== Debug revoke
exports.authRoutes.post("/debug/revoke", (req, res) => {
    try {
        const { username } = req.body ?? {};
        const out = (0, auth_service_1.debugRevoke)(String(username ?? ""));
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_REVOKE"));
    }
});
