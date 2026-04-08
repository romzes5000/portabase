/**
 * Must be imported before `@/db` so DATABASE_URL is validated before Pool is created.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required for Portabase MCP (stdio). Set it in .env or the environment.");
    process.exit(1);
}
