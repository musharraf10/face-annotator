import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import employeeRoutes from "./routes/employees.js";
import sessionRoutes from "./routes/sessions.js";
import adminRoutes from "./routes/admin.js";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";

const app = express();
const PORT = process.env.PORT || 5000;

function validateEnvironment() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters.",
    );
  }
  if (process.env.JWT_SECRET.startsWith("replace-with-")) {
    throw new Error(
      "Replace the JWT_SECRET placeholder with a randomly generated secret.",
    );
  }
  if (
    process.env.ADMIN_BOOTSTRAP_EMAIL &&
    !process.env.ADMIN_BOOTSTRAP_PASSWORD
  ) {
    throw new Error(
      "ADMIN_BOOTSTRAP_PASSWORD is required when ADMIN_BOOTSTRAP_EMAIL is set.",
    );
  }
  if (
    process.env.ADMIN_BOOTSTRAP_PASSWORD &&
    !process.env.ADMIN_BOOTSTRAP_EMAIL
  ) {
    throw new Error(
      "ADMIN_BOOTSTRAP_EMAIL is required when ADMIN_BOOTSTRAP_PASSWORD is set.",
    );
  }
  if (
    process.env.ADMIN_BOOTSTRAP_EMAIL &&
    process.env.ADMIN_BOOTSTRAP_PASSWORD.length < 14
  ) {
    throw new Error(
      "ADMIN_BOOTSTRAP_PASSWORD must contain at least 14 characters.",
    );
  }
}

async function bootstrapAdministrator() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.warn(
      "[Admin] No ADMIN_BOOTSTRAP_EMAIL configured; administrator endpoints remain unavailable until a controlled bootstrap is performed.",
    );
    return;
  }
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "operations" || existing.branchId) {
      throw new Error(
        "Bootstrap admin account is already branch-assigned; choose a separate unassigned account.",
      );
    }
    existing.role = "admin";
    existing.branchId = null;
    // Set the credential from trusted deployment configuration so a public
    // registration using the bootstrap email cannot claim administrator access.
    existing.password = await bcrypt.hash(
      process.env.ADMIN_BOOTSTRAP_PASSWORD,
      12,
    );
    if (process.env.ADMIN_BOOTSTRAP_NAME?.trim())
      existing.name = process.env.ADMIN_BOOTSTRAP_NAME.trim();
    await existing.save();
    return;
  }
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  await User.create({
    name: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Portal Administrator",
    email,
    password: await bcrypt.hash(password, 12),
    role: "admin",
    branchId: null,
  });
}

function allowedOrigins() {
  const configured = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured?.length ? configured : ["http://localhost:5173"];
}

// Middleware
const origins = allowedOrigins();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
  }),
);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Health & Status endpoint

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/admin", adminRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  // Error messages from storage/decoder libraries can include object metadata.
  // Keep logs free of upload contents, storage keys, and provider diagnostics.
  console.error("Unhandled server error:", err.name || "Error");
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
});

// Start Server & Connect MongoDB
async function startServer() {
  validateEnvironment();
  await connectDB();
  await bootstrapAdministrator();
  app.listen(PORT, () => {
    console.log(
      `[Server] Face Annotator backend running at http://localhost:${PORT}`,
    );
    console.log(
      `[Developer Credit] Professional Presence crafted by Shaik Musharaf (NW0007365)`,
    );
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("[Startup] Server could not start:", error.message);
    process.exitCode = 1;
  });
}
