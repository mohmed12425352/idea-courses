import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ENV_FILE_PATH = path.resolve(__dirname, "../.env");
dotenv.config({ path: ENV_FILE_PATH });

export const SERVER_ROOT = path.resolve(__dirname, "..");
export const UPLOADS_DIR = path.resolve(SERVER_ROOT, "uploads");
// Completely isolated database folder strictly for Desktop + Mobile Apps!
export const PGDATA_DIR = path.resolve(SERVER_ROOT, "data/apps-pgdata");

export const config = {
  port: Number(process.env.PORT || 4500),
  nodeEnv: process.env.NODE_ENV || "development",
  siteUrl: (process.env.SITE_URL || `http://localhost:${process.env.PORT || 4500}`).replace(/\/$/, ""),
  apiBaseUrl: (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4500}`).replace(/\/$/, ""),
  databaseUrl: (process.env.DATABASE_URL || "").trim(),
  useEmbeddedPgFallback: process.env.USE_EMBEDDED_PG_FALLBACK !== "false",
  jwtSecret: process.env.JWT_SECRET || "edunova-apps-standalone-jwt-secret-2026",
  signedUrlSecret: process.env.SIGNED_URL_SECRET || "edunova-apps-standalone-signed-url-secret-2026",
  webhookSecret: process.env.WEBHOOK_SECRET || "edunova-apps-standalone-webhook-secret-2026",
  seedAdminEmail: (process.env.SEED_ADMIN_EMAIL || "admin@edunova.eg").trim().toLowerCase(),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin@123456",
  seedAdminName: process.env.SEED_ADMIN_NAME || "مدير تطبيقات Idea Courses",
  seedStudentEmail: (process.env.SEED_STUDENT_EMAIL || "student@edunova.eg").trim().toLowerCase(),
  seedStudentPassword: process.env.SEED_STUDENT_PASSWORD || "Student@123456",
};
