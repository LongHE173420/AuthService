"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = me;
const db_1 = require("../db/db");
const response_1 = require("../core/response");
const token_1 = require("../core/token");
function me(accessToken) {
    if (!accessToken)
        return (0, response_1.fail)("MISSING_ACCESS_TOKEN");
    if ((0, token_1.isAccessExpired)(accessToken)) {
        // TH3: access hết hạn -> client nên gọi refresh
        return (0, response_1.fail)("ACCESS_TOKEN_EXPIRED");
    }
    const username = (0, token_1.usernameFromToken)(accessToken);
    if (!username)
        return (0, response_1.fail)("INVALID_ACCESS_TOKEN");
    const acc = db_1.db.accounts.get(username);
    if (!acc)
        return (0, response_1.fail)("Tài khoản không tồn tại");
    return (0, response_1.ok)({ username: acc.username, firstName: acc.firstName, lastName: acc.lastName }, "OK");
}
