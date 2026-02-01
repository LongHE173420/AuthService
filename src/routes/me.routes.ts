import { Router } from "express";
import { me } from "../services/me.service";
import { fail } from "../core/response";

export const meRoutes = Router();

meRoutes.get("/me", async (req, res) => {
  try {
    const auth = String(req.headers.authorization ?? "");
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    const out = await me(token);
    res.json(out);
  } catch (e: any) {
    res.json(fail(e?.message ?? "ERR_ME"));
  }
});
