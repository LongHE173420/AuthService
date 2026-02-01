"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.db = {
    accounts: new Map(),
    pendingRegs: new Map(), // key=username
    pendingLogin: new Map() // key=username|device
};
(function seed() {
    const a1 = {
        username: "needtrust@test.com",
        password: "123456",
        firstName: "Need",
        lastName: "Trust",
        gender: "MALE",
        dateOfBirth: "2001-01-01",
        trustRequired: true,
        trustedDevices: new Set(),
        revoked: false
    };
    const a2 = {
        username: "ready@test.com",
        password: "123456",
        firstName: "Ready",
        lastName: "User",
        gender: "FEMALE",
        dateOfBirth: "2002-02-02",
        trustRequired: false,
        trustedDevices: new Set(["dev-123456"]),
        revoked: false
    };
    exports.db.accounts.set(a1.username.toLowerCase(), a1);
    exports.db.accounts.set(a2.username.toLowerCase(), a2);
})();
