import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Simple root route that doesn't require authentication
  return json({
    message: "ShopiForm App is running",
    timestamp: new Date().toISOString(),
    url: request.url
  });
};

export default function Index() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>ShopiForm App</h1>
      <p>Your Shopify form builder app is running successfully!</p>
      <p>
        <a href="/health" style={{ color: '#007cba' }}>
          Check Health Status
        </a>
      </p>
      <p>
        <a href="/health?detailed=true" style={{ color: '#007cba' }}>
          Detailed Health Check
        </a>
      </p>
    </div>
  );
}
