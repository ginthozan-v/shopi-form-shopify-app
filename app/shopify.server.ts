import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Determine the app URL - prioritize SHOPIFY_APP_URL, fallback to HOST with protocol
function getAppUrl(): string {
  // If SHOPIFY_APP_URL is set and valid, use it
  if (process.env.SHOPIFY_APP_URL) {
    try {
      const url = new URL(process.env.SHOPIFY_APP_URL);
      return url.origin;
    } catch {
      // If invalid URL, try to fix it
      const fixed = process.env.SHOPIFY_APP_URL.startsWith("http")
        ? process.env.SHOPIFY_APP_URL
        : `https://${process.env.SHOPIFY_APP_URL}`;
      return fixed;
    }
  }

  // Fallback to HOST if available (for local development)
  if (process.env.HOST) {
    try {
      // If HOST doesn't have protocol, add https for production, http for localhost
      const host = process.env.HOST.startsWith("http")
        ? process.env.HOST
        : process.env.HOST.includes("localhost") || process.env.HOST.includes("127.0.0.1")
        ? `http://${process.env.HOST}`
        : `https://${process.env.HOST}`;
      const url = new URL(host);
      return url.origin;
    } catch {
      // If HOST is invalid, construct URL manually
      const host = process.env.HOST.includes("localhost") || process.env.HOST.includes("127.0.0.1")
        ? `http://${process.env.HOST}`
        : `https://${process.env.HOST}`;
      return host;
    }
  }

  // Last resort: localhost for development
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

const appUrl = getAppUrl();

// Log app URL in development for debugging
if (process.env.NODE_ENV !== "production") {
  console.log(`[Shopify App] Using app URL: ${appUrl}`);
  if (!process.env.SHOPIFY_APP_URL && !process.env.HOST) {
    console.warn(
      "[Shopify App] WARNING: Neither SHOPIFY_APP_URL nor HOST environment variables are set.",
      "OAuth redirects may fail. Set SHOPIFY_APP_URL to your app's public URL."
    );
  }
}

// Validate critical environment variables
if (!process.env.SHOPIFY_API_KEY) {
  throw new Error("SHOPIFY_API_KEY environment variable is required");
}

if (!process.env.SHOPIFY_API_SECRET) {
  throw new Error("SHOPIFY_API_SECRET environment variable is required");
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
