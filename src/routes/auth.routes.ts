import { Router } from "express";
import { validatePhone, registerDraft, verifyRegisterOtp, resendRegisterOtp } from "../services/register.service";
import { login, verifyLoginOtp, resendLoginOtp, refresh, debugRevoke } from "../services/auth.service";
import { ok, fail } from "../core/response";
import { secondsLeftInWindow, getPhase } from "../core/otpSession";
import { mysqlPool } from "../config/database";

export const authRoutes = Router();

function deviceIdFrom(req: any) {
  return (req.headers["x-device-id"] || "dev-123456") as string;
}

// ===== Register
authRoutes.post("/validate-phone", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { phone } = req.body ?? {};
    const out = await validatePhone(String(phone ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_VALIDATE_PHONE"));
  }
});

authRoutes.post("/register", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const out = await registerDraft(req.body, deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_REGISTER"));
  }
});

authRoutes.post("/verify-register-otp", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { phone, otp } = req.body ?? {};
    const out = await verifyRegisterOtp(String(phone ?? ""), String(otp ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_VERIFY_REGISTER_OTP"));
  }
});

authRoutes.post("/resend-otp-register", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { phone } = req.body ?? {};
    const out = await resendRegisterOtp(String(phone ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_RESEND_REGISTER_OTP"));
  }
});

// helper debug: xem trạng thái OTP session register
authRoutes.get("/debug/register-session", async (req, res) => {
  try {
    const phone = String(req.query.phone ?? "");
    const [pendingRegs] = await (require("../config/database").mysqlPool).query(
      "SELECT * FROM pending_registrations WHERE phone = ?",
      [phone]
    );

    if (pendingRegs.length === 0) return res.json(fail("NO_PENDING_REGISTER"));

    const pending = (pendingRegs as any)[0];
    const mockSession = {
      otp: pending.otp,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
      resendCount: pending.resendCount,
    };

    res.json(
      ok({
        phone,
        deviceId: pending.deviceId,
        phase: getPhase(mockSession),
        secondsLeft: secondsLeftInWindow(mockSession),
        resendCount: pending.resendCount,
      })
    );
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_DEBUG_REGISTER_SESSION"));
  }
});

// ===== Login
authRoutes.post("/login", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username, password } = req.body ?? {};
    const out = await login(String(username ?? ""), String(password ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_LOGIN"));
  }
});

authRoutes.post("/verify-login-otp", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username, otp } = req.body ?? {};
    const out = await verifyLoginOtp(String(username ?? ""), String(otp ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_VERIFY_LOGIN_OTP"));
  }
});

authRoutes.post("/resend-otp-login", async (req, res) => {
  try {
    const deviceId = deviceIdFrom(req);
    const { username } = req.body ?? {};
    const out = await resendLoginOtp(String(username ?? ""), deviceId);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_RESEND_LOGIN_OTP"));
  }
});

// helper debug: xem trạng thái OTP session login
authRoutes.get("/debug/login-session", async (req, res) => {
  try {
    const phone = String(req.query.phone ?? "");
    const deviceId = String(req.query.deviceId ?? "dev-123456");
    
    const [pendingLogins] = await mysqlPool.query(
      "SELECT * FROM pending_login WHERE phone = ? AND deviceId = ?",
      [phone, deviceId]
    ) as any;

    if (!Array.isArray(pendingLogins) || pendingLogins.length === 0) {
      return res.json(fail("NO_PENDING_LOGIN_OTP"));
    }

    const pending = pendingLogins[0] as any;
    const mockSession = {
      otp: pending.otp,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
      resendCount: pending.resendCount,
    };

    res.json(ok({
      phone,
      deviceId,
      phase: getPhase(mockSession),
      secondsLeft: secondsLeftInWindow(mockSession),
      resendCount: pending.resendCount,
    }));
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_DEBUG_LOGIN_SESSION"));
  }
});

// ===== Refresh
authRoutes.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    const out = await refresh(String(refreshToken ?? ""));
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_REFRESH"));
  }
});

// ===== Debug revoke
authRoutes.post("/debug/revoke", async (req, res) => {
  try {
    const { username } = req.body ?? {};
    const out = await debugRevoke(String(username ?? ""));
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_REVOKE"));
  }
});
