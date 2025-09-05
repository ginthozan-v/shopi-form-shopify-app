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
  
  // Connect eagerly in production
  if (process.env.NODE_ENV === "production") {
    client.$connect();
  }
  
  return client;
}

export { db };

// For backwards compatibility
export default db;
