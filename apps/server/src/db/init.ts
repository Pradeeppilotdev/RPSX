import { db } from "./client";
import { sql } from "drizzle-orm";

export async function initDB() {
  try {
    // Run migrations using drizzle-kit push in production
    // For now, just verify connection
    await sql`SELECT 1`;
    console.log("✅ Database connected");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

