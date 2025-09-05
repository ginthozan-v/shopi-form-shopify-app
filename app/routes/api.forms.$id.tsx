import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "../db.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { id } = params;
  
  if (!id) {
    return json({ error: "Form ID is required" }, { status: 400 });
  }

  try {
    // Get the shop domain from the request
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop') || url.hostname;

    const form = await db.form.findFirst({
      where: { 
        id,
        shop: shop.replace('.myshopify.com', '.myshopify.com') // Normalize shop domain
      },
      include: {
        fields: {
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!form) {
      return json({ error: "Form not found" }, { status: 404 });
    }

    // Transform database fields to match frontend interface
    const transformedFields = form.fields.map(field => ({
      id: field.id,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder || undefined,
      required: field.required,
      options: field.options ? JSON.parse(field.options) : undefined,
    }));

    return json({ 
      form: {
        id: form.id,
        name: form.name,
        description: form.description || "",
        fields: transformedFields
      }
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  } catch (error) {
    console.error('Database error in form API:', error);
    return json({ error: "Error loading form" }, { status: 500 });
  }
};
