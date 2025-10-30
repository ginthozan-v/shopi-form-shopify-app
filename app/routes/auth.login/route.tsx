import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { login } from "../../shopify.server";

import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

/**
 * Normalizes a shop domain input to the correct format
 * - Removes http:// or https:// protocols
 * - Removes trailing slashes
 * - Ensures .myshopify.com suffix is present
 * - Handles both "example" and "example.myshopify.com" formats
 */
function normalizeShopDomain(shop: string): string {
  if (!shop) return "";

  // Remove protocol (http:// or https://)
  let normalized = shop.replace(/^https?:\/\//i, "");

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");

  // Remove any path after the domain
  normalized = normalized.split("/")[0];

  // Remove port if present
  normalized = normalized.split(":")[0];

  // Trim whitespace
  normalized = normalized.trim();

  // If it's just a shop name without .myshopify.com, add it
  if (normalized && !normalized.includes(".")) {
    normalized = `${normalized}.myshopify.com`;
  } else if (normalized && !normalized.endsWith(".myshopify.com")) {
    // If it has a domain but not .myshopify.com, check if it's a valid shop domain
    // Otherwise, assume it needs .myshopify.com appended
    const parts = normalized.split(".");
    if (parts.length === 1) {
      normalized = `${normalized}.myshopify.com`;
    }
  }

  return normalized.toLowerCase();
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const loginResult = await login(request);

  // If login returns a Response (redirect), return it directly
  if (loginResult instanceof Response) {
    return loginResult;
  }

  // Otherwise, it's an error object
  const errors = loginErrorMessage(loginResult);

  return { errors, polarisTranslations };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shopInput = formData.get("shop") as string;

  // Normalize the shop domain before processing
  const normalizedShop = normalizeShopDomain(shopInput || "");

  if (!normalizedShop) {
    return {
      errors: { shop: "Please enter your shop domain to log in" },
    };
  }

  // Create a new request with normalized shop domain in URL params
  // The login function expects shop as a URL search parameter
  const url = new URL(request.url);
  url.searchParams.set("shop", normalizedShop);
  
  // Create a new request with the shop parameter in the URL
  const normalizedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
  });

  try {
    const loginResult = await login(normalizedRequest);

    // If login returns a Response (redirect), return it directly
    if (loginResult instanceof Response) {
      return loginResult;
    }

    // Otherwise, it's an error object
    const errors = loginErrorMessage(loginResult);

    return {
      errors,
    };
  } catch (error) {
    // Log error for debugging
    console.error("Login error:", error);
    
    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes("SHOPIFY_APP_URL")) {
      return {
        errors: {
          shop: "App configuration error: SHOPIFY_APP_URL is not set correctly. Please check your environment variables.",
        },
      };
    }

    return {
      errors: {
        shop: "An error occurred during login. Please check your shop domain and try again.",
      },
    };
  }
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  const handleShopChange = (value: string) => {
    setShop(value);
  };

  const handleShopBlur = () => {
    // Normalize shop domain when user leaves the field
    const normalized = normalizeShopDomain(shop);
    if (normalized !== shop && normalized) {
      setShop(normalized);
    }
  };

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="Enter your shop domain (e.g., example.myshopify.com or just example)"
                value={shop}
                onChange={handleShopChange}
                onBlur={handleShopBlur}
                autoComplete="on"
                error={errors.shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
