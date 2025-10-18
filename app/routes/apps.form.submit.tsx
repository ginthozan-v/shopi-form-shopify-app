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
    const sessions = await sessionStorage.findSessionsByShop(shopDomain);
    const session = sessions && sessions.length > 0 ? sessions[0] : null;

    if (!session || !session.accessToken) {
      console.error("No session found for shop:", shopDomain);
      // Still save the submission but don't create customer
      return json(
        {
          success: true,
          message: "Form submitted successfully (customer creation pending)",
          note: "Shop session not found. Contact admin.",
          submissionData,
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

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
      note: `Created via form: ${form.title} (Code: ${code})`,
      tags: [`form-${code}`, "form-submission"],
    };

    console.log("Creating customer with:", customerInput);

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

    const result = await response.json();
    console.log("Shopify API response:", result);

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

