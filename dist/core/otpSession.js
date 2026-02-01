"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RESEND = exports.SESSION_5P_MS = exports.RESEND_SECONDS = exports.VERIFY_SECONDS = void 0;
exports.getPhase = getPhase;
exports.secondsLeftInWindow = secondsLeftInWindow;
exports.canVerify = canVerify;
exports.canResend = canResend;
exports.extendSessionOnResend = extendSessionOnResend;
const time_1 = require("./time");
exports.VERIFY_SECONDS = 3 * 60;
exports.RESEND_SECONDS = 2 * 60;
exports.SESSION_5P_MS = 5 * 60000;
exports.MAX_RESEND = 2;
// Phase dựa trên elapsed so với createdAt,
// nhưng vẫn bị chặn bởi expiresAt (5p)
function getPhase(s) {
    const t = (0, time_1.now)();
    if (t >= s.expiresAt)
        return "EXPIRED";
    const elapsedSec = Math.floor((t - s.createdAt) / 1000);
    if (elapsedSec < exports.VERIFY_SECONDS)
        return "VERIFY";
    if (elapsedSec < exports.VERIFY_SECONDS + exports.RESEND_SECONDS)
        return "RESEND";
    return "EXPIRED";
}
function secondsLeftInWindow(s) {
    const t = (0, time_1.now)();
    if (t >= s.expiresAt)
        return 0;
    const elapsedSec = Math.floor((t - s.createdAt) / 1000);
    if (elapsedSec < exports.VERIFY_SECONDS)
        return exports.VERIFY_SECONDS - elapsedSec;
    const resendElapsed = elapsedSec - exports.VERIFY_SECONDS;
    const left = exports.RESEND_SECONDS - resendElapsed;
    return left > 0 ? left : 0;
}
function canVerify(s) {
    return getPhase(s) !== "EXPIRED";
}
function canResend(s) {
    return getPhase(s) === "RESEND" && s.resendCount < exports.MAX_RESEND;
}
function extendSessionOnResend(s) {
    s.resendCount += 1;
    // resend -> reset "createdAt" để user có lại 3 phút nhập OTP mới
    s.createdAt = (0, time_1.now)();
    // nới session thêm 5p tính từ hiện tại
    s.expiresAt = (0, time_1.now)() + exports.SESSION_5P_MS;
}
