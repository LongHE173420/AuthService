"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TTL_MS = exports.ACCESS_TTL_MS = void 0;
exports.issueTokens = issueTokens;
exports.tokenIssuedAt = tokenIssuedAt;
exports.usernameFromToken = usernameFromToken;
exports.isAccessExpired = isAccessExpired;
exports.isRefreshExpired = isRefreshExpired;
const time_1 = require("./time");
exports.ACCESS_TTL_MS = 60000; // demo 1 phút
exports.REFRESH_TTL_MS = 10 * 60000; // demo 10 phút
function issueTokens(username, trust) {
    const t = (0, time_1.now)();
    return {
        accessToken: `access.${username}.${t}`,
        refreshToken: `refresh.${username}.${t}`,
        accessExp: t + exports.ACCESS_TTL_MS,
        refreshExp: t + exports.REFRESH_TTL_MS,
        trust
    };
}
function tokenIssuedAt(token) {
    const parts = token.split(".");
    const ts = Number(parts[2]);
    return Number.isFinite(ts) ? ts : 0;
}
function usernameFromToken(token) {
    const parts = token.split(".");
    if (parts.length < 3)
        return "";
    return String(parts[1] ?? "").toLowerCase();
}
function isAccessExpired(accessToken) {
    const ts = tokenIssuedAt(accessToken);
    if (!ts)
        return true;
    return (0, time_1.now)() > ts + exports.ACCESS_TTL_MS;
}
function isRefreshExpired(refreshToken) {
    const ts = tokenIssuedAt(refreshToken);
    if (!ts)
        return true;
    return (0, time_1.now)() > ts + exports.REFRESH_TTL_MS;
}
