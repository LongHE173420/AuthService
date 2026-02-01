"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.fail = fail;
exports.ensureOk = ensureOk;
exports.sendRes = sendRes;
function ok(data, message) {
    return { isSucceed: true, message, data };
}
function fail(message) {
    return { isSucceed: false, message };
}
/**
 * call API -> validate -> pass mới xử lý
 * resApi: trả về ApiRes, nếu fail thì throw để catch
 */
function ensureOk(resApi, fallbackMsg = "Request failed") {
    if (!resApi || resApi.isSucceed === false) {
        throw new Error(resApi?.message ?? fallbackMsg);
    }
    return resApi;
}
/**
 * helper cho routes: luôn trả chuẩn format
 */
function sendRes(res, apiRes, httpFailCode = 400) {
    if (apiRes.isSucceed)
        return res.status(200).json(apiRes);
    return res.status(httpFailCode).json(apiRes);
}
