"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.fail = fail;
exports.ensureOk = ensureOk;
function ok(data, message) {
    return { isSucceed: true, message, data };
}
function fail(message, data) {
    return { isSucceed: false, message, data };
}
function ensureOk(res, fallback) {
    if (!res || res.isSucceed === false) {
        throw new Error(res?.message ?? fallback);
    }
    return res;
}
