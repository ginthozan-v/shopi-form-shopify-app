import { json } from "@remix-run/node";
import db from "../db.server";

// App Proxy route - publicly accessible from storefront via /apps/form/{code}
// No authentication required for app proxy routes
export async function loader({
  params,
  request,
}: {
  params: { code: string };
  request: Request;
}) {
  const { code } = params;

  console.log("🔵 App Proxy request received");
  console.log("Code:", code);
  console.log("Request URL:", request.url);
  console.log("Headers:", Object.fromEntries(request.headers));

  if (!code) {
    return json(
      { error: "Form code is required" },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const form = await db.form.findUnique({
      where: { code },
    });

    if (!form) {
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

    return json(
      {
        id: form.id,
        code: form.code,
        title: form.title,
        description: form.description,
        fields: JSON.parse(form.fields),
        shop: form.shop,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching form:", error);
    return json(
      { error: "Internal server error" },
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

