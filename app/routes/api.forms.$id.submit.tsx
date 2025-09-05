import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "../db.server";

// Add a new table for form submissions
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { id } = params;
  
  if (!id) {
    return json({ error: "Form ID is required" }, { status: 400 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.json();
    
    // Get the shop domain from the request
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop') || url.hostname;

    // Verify the form exists
    const form = await db.form.findFirst({
      where: { 
        id,
        shop: shop.replace('.myshopify.com', '.myshopify.com')
      },
      include: {
        fields: true
      }
    });

    if (!form) {
      return json({ error: "Form not found" }, { status: 404 });
    }

    // Validate required fields
    const requiredFields = form.fields.filter(field => field.required);
    const missingFields = [];
    
    for (const field of requiredFields) {
      const fieldKey = `field-${field.id}`;
      if (!formData[fieldKey] || formData[fieldKey].toString().trim() === '') {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      return json({ 
        error: `Please fill in the following required fields: ${missingFields.join(', ')}` 
      }, { status: 400 });
    }

    // Store the form submission (you might want to create a FormSubmission model)
    // For now, we'll just log it and return success
    console.log('Form submission received:', {
      formId: id,
      formName: form.name,
      shop: shop,
      data: formData,
      timestamp: new Date().toISOString()
    });

    // TODO: You might want to:
    // 1. Save submissions to database
    // 2. Send email notifications
    // 3. Integrate with other services
    
    return json({ 
      success: true, 
      message: "Form submitted successfully" 
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error('Error processing form submission:', error);
    return json({ error: "Error processing form submission" }, { status: 500 });
  }
};

// Handle preflight requests for CORS
export const loader = async ({ request }: { request: Request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
};
