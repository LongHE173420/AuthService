import { Router } from "express";
import { validateUsername, registerDraft, verifyRegisterOtp, resendRegisterOtp } from "../services/register.service";
import { login, verifyLoginOtp, resendLoginOtp, refresh, debugRevoke } from "../services/auth.service";
import { ok, fail } from "../core/types";
import { secondsLeftInWindow, getPhase } from "../core/otpSession";
import { db } from "../db/db";

export const authRoutes = Router();

function deviceIdFrom(req: any) {
  return (req.headers["x-device-id"] || "dev-123456") as string;
}

// ===== Register
authRoutes.post("/validate-username", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username } = req.body ?? {};
    const out = validateUsername(String(username ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_VALIDATE_USERNAME"));
  }
});

authRoutes.post("/register", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const out = registerDraft(req.body, deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_REGISTER"));
  }
});

authRoutes.post("/verify-register-otp", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username, otp } = req.body ?? {};
    const out = verifyRegisterOtp(String(username ?? ""), String(otp ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_VERIFY_REGISTER_OTP"));
  }
});

authRoutes.post("/resend-otp-register", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username } = req.body ?? {};
    const out = resendRegisterOtp(String(username ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_RESEND_REGISTER_OTP"));
  }
});

// helper debug: xem trạng thái OTP session register
authRoutes.get("/debug/register-session", (req, res) => {
  const username = String(req.query.username ?? "").toLowerCase();
  const p = db.pendingRegs.get(username);
  if (!p) return res.json(fail("NO_PENDING_REGISTER"));
  res.json(ok({
    username,
    deviceId: p.deviceId,
    phase: getPhase(p.session),
    secondsLeft: secondsLeftInWindow(p.session),
    resendCount: p.session.resendCount
  }));
});

// ===== Login
authRoutes.post("/login", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username, password } = req.body ?? {};
    const out = login(String(username ?? ""), String(password ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_LOGIN"));
  }
});

authRoutes.post("/verify-login-otp", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username, otp } = req.body ?? {};
    const out = verifyLoginOtp(String(username ?? ""), String(otp ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_VERIFY_LOGIN_OTP"));
  }
});

authRoutes.post("/resend-otp-login", (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username } = req.body ?? {};
    const out = resendLoginOtp(String(username ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_RESEND_LOGIN_OTP"));
  }
});

// helper debug: xem trạng thái OTP session login
authRoutes.get("/debug/login-session", (req, res) => {
  const username = String(req.query.username ?? "").toLowerCase();
  const deviceId = String(req.query.deviceId ?? "dev-123456");
  const p = db.pendingLogin.get(`${username}|${deviceId}`);
  if (!p) return res.json(fail("NO_PENDING_LOGIN_OTP"));
  res.json(ok({
    username,
    deviceId,
    phase: getPhase(p.session),
    secondsLeft: secondsLeftInWindow(p.session),
    resendCount: p.session.resendCount
  }));
});

// ===== Refresh
authRoutes.post("/refresh-token", (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    const out = refresh(String(refreshToken ?? ""));
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_REFRESH"));
  }
});

// ===== Debug revoke
authRoutes.post("/debug/revoke", (req, res) => {
  try {
    const { username } = req.body ?? {};
    const out = debugRevoke(String(username ?? ""));
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_REVOKE"));
  }
});
