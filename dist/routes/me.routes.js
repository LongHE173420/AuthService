"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meRoutes = void 0;
const express_1 = require("express");
const me_service_1 = require("../services/me.service");
const types_1 = require("../core/types");
exports.meRoutes = (0, express_1.Router)();
exports.meRoutes.get("/me", (req, res) => {
    try {
        const auth = String(req.headers.authorization ?? "");
        const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
        const out = (0, me_service_1.me)(token);
        res.json(out);
    }
    catch (e) {
        res.json((0, types_1.fail)(e?.message ?? "ERR_ME"));
    }
});
