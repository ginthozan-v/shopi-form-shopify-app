import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const detailed = url.searchParams.get('detailed') === 'true';
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'unknown',
    details: detailed ? {} : undefined
  };

  // Check database connection
  try {
    await db.$queryRaw`SELECT 1`;
    health.database = 'connected';
    
    if (detailed) {
      // Check if tables exist
      try {
        const sessionCount = await db.session.count();
        const formCount = await db.form.count();
        health.details = {
          database: {
            sessions: sessionCount,
            forms: formCount,
            tablesExist: true
          },
          environment: {
            DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing',
            SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'set' : 'missing',
            SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? 'set' : 'missing',
            NODE_ENV: process.env.NODE_ENV
          }
        };
      } catch (tableError) {
        health.details = {
          database: {
            connected: true,
            tablesExist: false,
            error: tableError.message
          }
        };
      }
    }
  } catch (error) {
    health.database = 'error';
    health.status = 'degraded';
    
    if (detailed) {
      health.details = {
        database: {
          error: error.message,
          DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'missing'
        }
      };
    }
  }

  return json(health, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
