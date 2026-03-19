import "dotenv/config";
import express from "express";
import cors from "cors";

import { router as authRouter } from "./routes/auth";
import { router as questionsRouter } from "./routes/questions";
import { router as chatRouter } from "./routes/chat";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "CReD API" });
});

app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/chat", chatRouter);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API listening on port ${PORT}`);
});

