import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import employeeRoutes from "./routes/employees.js";
import sessionRoutes from "./routes/sessions.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Health & Status endpoint

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/sessions", sessionRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// Start Server & Connect MongoDB
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(
      `[Server] Face Annotator backend running at http://localhost:${PORT}`,
    );
    console.log(
      `[Developer Credit] Professional Presence crafted by Shaik Musharaf (NW0007365)`,
    );
  });
}

startServer();
