import { json } from "@remix-run/node";
import db from "../db.server";
import { sessionStorage } from "../shopify.server";

// Form submission endpoint - publicly accessible
export async function action({ request }: { request: Request }) {
  console.log("🟢 Form submission received");

  try {
    const formData = await request.formData();
    
    // Log all form data for debugging
    console.log("📝 Raw form data entries:");
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    const code = formData.get("formCode") as string;
    const shopDomain = formData.get("shop") as string;
    
    console.log("Form code:", code);
    console.log("Shop domain:", shopDomain);
    
    if (!code || !shopDomain) {
      console.error("❌ Missing required fields: code or shopDomain");
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
    
    // Store both by field ID and label for easier access
    fields.forEach((field: any) => {
      const value = formData.get(field.id);
      if (value) {
        submissionData[field.label] = value;
        submissionData[field.id] = value;
      }
    });

    console.log("Submission data:", submissionData);
    console.log("Form fields:", fields);

    // Extract customer information from submission
    const firstName = submissionData["First Name"] || submissionData["Name"] || "";
    const lastName = submissionData["Last Name"] || "";
    const email = submissionData["Email"] || "";
    const phone = submissionData["Phone"] || "";

    // Extract company information if present
    // Company fields use field.id prefix (e.g., company_123_billing_company_name)
    let companyFieldId = "";
    let companyName = "";
    let hasCompanyInfo = false;
    
    // Find the company field
    const companyField = fields.find((f: any) => f.type === "company");
    if (companyField) {
      companyFieldId = companyField.id;
      companyName = formData.get(`${companyFieldId}_billing_company_name`) as string || "";
      hasCompanyInfo = !!companyName;
    }
    
    // Company address fields - using the actual field names from the form
    const billingCountry = companyFieldId ? (formData.get(`${companyFieldId}_billing_country`) as string || "") : "";
    const billingStreet = companyFieldId ? (formData.get(`${companyFieldId}_billing_street`) as string || "") : "";
    const billingApartment = companyFieldId ? (formData.get(`${companyFieldId}_billing_apartment`) as string || "") : "";
    const billingPostalCode = companyFieldId ? (formData.get(`${companyFieldId}_billing_postal_code`) as string || "") : "";
    const billingCity = companyFieldId ? (formData.get(`${companyFieldId}_billing_city`) as string || "") : "";
    const billingProvince = companyFieldId ? (formData.get(`${companyFieldId}_billing_province`) as string || "") : "";
    const billingPhone = companyFieldId ? (formData.get(`${companyFieldId}_billing_phone`) as string || phone) : phone;

    console.log("Company info detected:", hasCompanyInfo);
    if (hasCompanyInfo) {
      console.log("Company details:", {
        companyName,
        billingCountry,
        billingStreet,
        billingCity,
        billingPostalCode,
      });
    }

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
    console.log("Session scope:", session.scope);
    console.log("Session isOnline:", session.isOnline);
    
    // Check if we have the required scopes
    const hasCustomerScopes = session.scope?.includes('write_customers');
    const hasCompanyScopes = session.scope?.includes('write_companies');
    console.log("Has write_customers scope:", hasCustomerScopes);
    console.log("Has write_companies scope:", hasCompanyScopes);
    
    if (!hasCustomerScopes) {
      console.error("❌ Missing write_customers scope. Please reinstall the app to grant new permissions.");
      return json(
        {
          success: false,
          error: "Missing required permissions",
          message: "The app needs to be reinstalled with updated permissions (write_customers scope required)",
          note: "Please reinstall the app from the Shopify admin or run 'npm run dev' to update permissions.",
        },
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const apiUrl = `https://${shopDomain}/admin/api/2025-01/graphql.json`;
    const headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    };

    // Helper function to make GraphQL requests
    const makeGraphQLRequest = async (query: string, variables: any) => {
      console.log("🔄 Making GraphQL request:");
      console.log("Query:", query.substring(0, 100) + "...");
      console.log("Variables:", JSON.stringify(variables, null, 2));
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log("Response body:", responseText);

      if (!response.ok) {
        console.error("❌ API Error - non-OK status");
        throw new Error(`API returned status ${response.status}: ${responseText}`);
      }

      try {
        return JSON.parse(responseText);
      } catch (err) {
        console.error("❌ Failed to parse JSON response:", err);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
    };

    let customer;
    let company;
    let companyLocation;

    if (hasCompanyInfo) {
      console.log("📦 Company information detected, attempting to create company and customer...");

      // Try to create the company (requires Shopify Plus)
      let isShopifyPlus = false;
      const companyMutation = `
        mutation companyCreate($input: CompanyCreateInput!) {
          companyCreate(input: $input) {
            company {
              id
              name
              note
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const companyInput = {
        input: {
          company: {
            name: companyName,
            note: `Created via ShopiForm: ${form.title} (Code: ${code})`,
          },
        },
      };

      console.log("Attempting to create company with:", JSON.stringify(companyInput, null, 2));
      
      try {
        const companyResult = await makeGraphQLRequest(companyMutation, companyInput);
        console.log("Company creation response:", JSON.stringify(companyResult, null, 2));

        // Check for Shopify Plus requirement error
        if (companyResult.errors) {
          const isPlusRequiredError = companyResult.errors.some((err: any) => 
            err.message?.includes("Shopify Plus") || err.extensions?.code === "ACCESS_DENIED"
          );
          
          if (isPlusRequiredError) {
            console.warn("⚠️ Company creation requires Shopify Plus. Will create customer with company info in metadata.");
            isShopifyPlus = false;
          } else {
            // Other GraphQL errors
            console.error("❌ GraphQL errors:", companyResult.errors);
            return json(
              {
                error: "Failed to create company",
                details: companyResult.errors,
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
        } else if (companyResult.data?.companyCreate?.userErrors?.length > 0) {
          console.error("❌ Company creation user errors:", companyResult.data.companyCreate.userErrors);
          return json(
            {
              error: "Failed to create company",
              details: companyResult.data.companyCreate.userErrors,
            },
            {
              status: 400,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
              },
            }
          );
        } else {
          // Company created successfully
          company = companyResult.data?.companyCreate?.company;
          isShopifyPlus = true;
        }
      } catch (error) {
        console.error("❌ Error creating company:", error);
        console.warn("⚠️ Will create customer with company info in metadata instead.");
        isShopifyPlus = false;
      }

      // Step 2: Create company location with billing address
      if (company?.id) {
        const companyLocationMutation = `
          mutation companyLocationAssignAddress($locationId: ID!, $address: CompanyAddressInput!) {
            companyLocationAssignAddress(locationId: $locationId, address: $address) {
              addresses {
                id
                address1
                address2
                city
                zip
                province
                country
                phone
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        // First, we need to get the default location ID for the company
        const locationQuery = `
          query getCompanyLocations($companyId: ID!) {
            company(id: $companyId) {
              locations(first: 1) {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        `;

        const locationQueryResult = await makeGraphQLRequest(locationQuery, { companyId: company.id });
        const locationId = locationQueryResult.data?.company?.locations?.edges[0]?.node?.id;

        if (locationId) {
          const addressInput = {
            locationId,
            address: {
              address1: billingStreet,
              address2: billingApartment || undefined,
              city: billingCity,
              zip: billingPostalCode,
              province: billingProvince || undefined,
              country: billingCountry,
              phone: billingPhone || undefined,
            },
          };

          console.log("Assigning address to company location:", addressInput);
          const locationResult = await makeGraphQLRequest(companyLocationMutation, addressInput);
          console.log("✅ Company location response:", JSON.stringify(locationResult, null, 2));

          if (locationResult.data?.companyLocationAssignAddress?.userErrors?.length > 0) {
            console.warn("⚠️ Warning: Failed to assign address to company location:", locationResult.data.companyLocationAssignAddress.userErrors);
          } else {
            companyLocation = locationResult.data?.companyLocationAssignAddress?.addresses?.[0];
          }
        }
      }

      // Step 3: Create customer with company information
      const customerMutation = `
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              email
              firstName
              lastName
              phone
              addresses {
                id
                address1
                address2
                city
                province
                zip
                country
                company
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      // Build customer note with company details
      let customerNote = `Created via ShopiForm: ${form.title} (Code: ${code})`;
      if (!isShopifyPlus) {
        customerNote += `\n\nCompany Information:\n`;
        customerNote += `- Company: ${companyName}\n`;
        if (billingStreet) customerNote += `- Address: ${billingStreet}${billingApartment ? `, ${billingApartment}` : ''}\n`;
        if (billingCity) customerNote += `- City: ${billingCity}\n`;
        if (billingProvince) customerNote += `- State/Province: ${billingProvince}\n`;
        if (billingPostalCode) customerNote += `- Postal Code: ${billingPostalCode}\n`;
        if (billingCountry) customerNote += `- Country: ${billingCountry}\n`;
        if (billingPhone) customerNote += `- Phone: ${billingPhone}\n`;
      }

      const customerInput: any = {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        note: customerNote,
        tags: [`form-${code}`, "form-submission", "company-customer", `company:${companyName}`],
      };

      // Add address with company information if not Shopify Plus
      if (!isShopifyPlus && billingStreet && billingCity && billingCountry) {
        customerInput.addresses = [{
          address1: billingStreet,
          address2: billingApartment || undefined,
          city: billingCity,
          province: billingProvince || undefined,
          zip: billingPostalCode || undefined,
          country: billingCountry,
          company: companyName,
          phone: billingPhone || phone || undefined,
        }];
      }

      console.log("Creating customer with:", JSON.stringify(customerInput, null, 2));
      const customerResult = await makeGraphQLRequest(customerMutation, { input: customerInput });
      console.log("✅ Customer creation response:", JSON.stringify(customerResult, null, 2));

      if (customerResult.data?.customerCreate?.userErrors?.length > 0) {
        return json(
          {
            error: "Failed to create customer",
            details: customerResult.data.customerCreate.userErrors,
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

      customer = customerResult.data?.customerCreate?.customer;

      // Step 4: Create company contact to associate customer with company
      if (company?.id && customer?.id) {
        const companyContactMutation = `
          mutation companyContactCreate($companyId: ID!, $input: CompanyContactInput!) {
            companyContactCreate(companyId: $companyId, input: $input) {
              companyContact {
                id
                customer {
                  id
                  email
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const contactInput = {
          companyId: company.id,
          input: {
            customerId: customer.id,
          },
        };

        console.log("Creating company contact:", contactInput);
        const contactResult = await makeGraphQLRequest(companyContactMutation, contactInput);
        console.log("✅ Company contact response:", JSON.stringify(contactResult, null, 2));

        if (contactResult.data?.companyContactCreate?.userErrors?.length > 0) {
          console.warn("⚠️ Warning: Failed to create company contact:", contactResult.data.companyContactCreate.userErrors);
        }
      }

      // Build success message based on what was created
      let successMessage = "Form submitted successfully!";
      if (isShopifyPlus && company) {
        successMessage = "Customer, company, and company location created successfully!";
      } else if (hasCompanyInfo) {
        successMessage = "Customer created with company information! (Note: B2B company creation requires Shopify Plus. Company details saved in customer profile.)";
      }

      return json(
        {
          success: true,
          message: successMessage,
          customer,
          company: company || null,
          companyLocation: companyLocation || null,
          isShopifyPlus,
          note: !isShopifyPlus && hasCompanyInfo 
            ? "Company information has been saved in the customer's address and notes. Upgrade to Shopify Plus to use B2B company features."
            : undefined,
          submissionData,
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      // No company info - create regular customer only
      console.log("👤 Creating regular customer (no company info)...");

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
      const customerResult = await makeGraphQLRequest(customerMutation, { input: customerInput });
      console.log("✅ Customer creation response:", JSON.stringify(customerResult, null, 2));

      if (customerResult.data?.customerCreate?.userErrors?.length > 0) {
      return json(
        {
          error: "Failed to create customer",
            details: customerResult.data.customerCreate.userErrors,
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

      customer = customerResult.data?.customerCreate?.customer;

    return json(
      {
        success: true,
        message: "Form submitted successfully and customer created!",
          customer,
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

