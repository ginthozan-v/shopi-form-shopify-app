import { PrismaClient } from "@prisma/client";

declare global {
  var __db__: PrismaClient;
}

let db: PrismaClient;

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// In production we'll have a single connection to the DB.
if (process.env.NODE_ENV === "production") {
  db = getClient();
} else {
  if (!global.__db__) {
    global.__db__ = getClient();
  }
  db = global.__db__;
}

function getClient() {
  // Use different database configurations for development vs production
  const client = process.env.NODE_ENV === "production" 
    ? new PrismaClient({
        // Production PostgreSQL configuration
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      })
    : new PrismaClient({
        // Development SQLite configuration
        datasources: {
          db: {
            url: "file:./prisma/dev.sqlite",
          },
        },
      });
  
  // Don't connect eagerly to avoid connection issues during build
  return client;
}

// Initialize database on first request in production
let isInitialized = false;

export async function initializeDatabase() {
  if (isInitialized) {
    return;
  }

  try {
    console.log("🔄 Initializing database connection...");
    
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL environment variable is missing");
      throw new Error("DATABASE_URL is required for database connection");
    }
    
    await db.$connect();
    console.log("✅ Database connection established");
    
    // Try to run a simple query to check if tables exist
    try {
      await db.session.findFirst({ take: 1 });
      console.log("✅ Database tables verified");
    } catch (tableError) {
      console.log("⚠️ Tables might not exist, attempting to create schema...");
      // Don't try to run prisma db push in serverless - just log and continue
      console.log("📝 Note: Run 'npx prisma db push' manually if tables are missing");
    }
    
    isInitialized = true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    // Don't throw - let the app continue and handle errors gracefully
    console.log("⚠️ Continuing without database initialization...");
  }
}

export { db };

// For backwards compatibility
export default db;
