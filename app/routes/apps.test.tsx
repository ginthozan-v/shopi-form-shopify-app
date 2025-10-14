import { json } from "@remix-run/node";

// Simple test route to verify app proxy routing works
export async function loader() {
  console.log("✅ Test route hit!");
  
  return json(
    { 
      success: true, 
      message: "App proxy routing is working!",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    }
  );
}

