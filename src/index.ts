import express from "express";
import { authRoutes } from "./routes/auth.routes";
import { meRoutes } from "./routes/me.routes";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "auth-service" }));

console.log("typeof authRoutes =", typeof authRoutes);
console.log("typeof meRoutes   =", typeof meRoutes);

app.use("/auth", authRoutes);
app.use("/", meRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`[auth-service] running at http://localhost:${PORT}`);
});
