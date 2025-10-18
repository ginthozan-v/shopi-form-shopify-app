import { json } from "@remix-run/node";
import db from "../db.server";
import { sessionStorage } from "../shopify.server";

// Form submission endpoint - publicly accessible
export async function action({ request }: { request: Request }) {
  console.log("🟢 Form submission received");

  try {
    const formData = await request.formData();
    const code = formData.get("formCode") as string;
    const shopDomain = formData.get("shop") as string;
    
    if (!code || !shopDomain) {
      return json(
        { error: "Form code and shop are required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get form details
    const form = await db.form.findUnique({
      where: { code },
    });

    if (!form || form.shop !== shopDomain) {
      return json(
        { error: "Form not found" },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Extract form field data
    const fields = JSON.parse(form.fields);
    const submissionData: Record<string, any> = {};
    
    fields.forEach((field: any) => {
      const value = formData.get(field.id);
      if (value) {
        submissionData[field.label] = value;
      }
    });

    console.log("Submission data:", submissionData);

    // Extract customer information from submission
    const firstName = submissionData["First Name"] || submissionData["Name"] || "";
    const lastName = submissionData["Last Name"] || "";
    const email = submissionData["Email"] || "";
    const phone = submissionData["Phone"] || "";

    // Validate required fields for customer creation
    if (!email) {
      return json(
        { error: "Email is required to create a customer" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get session for the shop to make API calls
    console.log("Looking for sessions for shop:", shopDomain);
    const sessions = await sessionStorage.findSessionsByShop(shopDomain);
    console.log("Found sessions:", sessions?.length || 0);
    const session = sessions && sessions.length > 0 ? sessions[0] : null;

    if (!session) {
      console.error("❌ No session found for shop:", shopDomain);
      console.error("Available sessions:", sessions);
      return json(
        {
          success: false,
          error: "No shop session found",
          message: "Form submitted but customer could not be created (no session)",
          note: "The app may not be installed on this shop or the session expired.",
          submissionData,
        },
        {
          status: 503,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!session.accessToken) {
      console.error("❌ Session found but no access token");
      return json(
        {
          success: false,
          error: "Invalid session",
          message: "Form submitted but customer could not be created (invalid session)",
          submissionData,
        },
        {
          status: 503,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("✅ Valid session found for shop:", shopDomain);

    // Create customer using Shopify GraphQL Admin API
    const customerMutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
            phone
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const customerInput = {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone: phone || undefined,
      note: `Created via ShopiForm: ${form.title} (Code: ${code})`,
      tags: [`form-${code}`, "form-submission"],
    };

    console.log("Creating customer with:", customerInput);

    console.log("Making API call to:", `https://${shopDomain}/admin/api/2025-01/graphql.json`);
    
    const response = await fetch(
      `https://${shopDomain}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: customerMutation,
          variables: { input: customerInput },
        }),
      }
    );

    console.log("API Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", errorText);
      return json(
        {
          success: false,
          error: "Shopify API error",
          message: `API returned status ${response.status}`,
          details: errorText,
        },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const result = await response.json();
    console.log("✅ Shopify API response:", JSON.stringify(result, null, 2));

    if (result.data?.customerCreate?.userErrors?.length > 0) {
      return json(
        {
          error: "Failed to create customer",
          details: result.data.customerCreate.userErrors,
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    return json(
      {
        success: true,
        message: "Form submitted successfully and customer created!",
        customer: result.data?.customerCreate?.customer,
        submissionData,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing form submission:", error);
    return json(
      { error: "Internal server error", details: String(error) },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// Handle OPTIONS request for CORS
export async function loader({ request }: { request: Request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  return json(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

