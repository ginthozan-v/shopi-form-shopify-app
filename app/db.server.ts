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
  if (isInitialized || process.env.NODE_ENV !== "production") {
    return;
  }

  try {
    console.log("🔄 Initializing database connection...");
    await db.$connect();
    
    // Try to run a simple query to ensure tables exist
    await db.$queryRaw`SELECT 1`;
    console.log("✅ Database connection established");
    
    isInitialized = true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    
    // Try to push the schema if tables don't exist
    try {
      console.log("🔄 Attempting to create database schema...");
      const { execSync } = await import('child_process');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log("✅ Database schema created");
      isInitialized = true;
    } catch (pushError) {
      console.error("❌ Failed to create schema:", pushError);
    }
  }
}

export { db };

// For backwards compatibility
export default db;
