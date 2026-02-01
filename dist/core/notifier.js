"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOtp = notifyOtp;
function notifyOtp(username, otp, context) {
    console.log(`[OTP][${context}] user=${username} otp=${otp}`);
}
