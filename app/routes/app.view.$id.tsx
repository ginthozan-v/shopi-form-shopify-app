import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Card,
  Layout,
  Page,
  Text,
  TextField,
  Select,
  Checkbox,
  RadioButton,
  Box,
  FormLayout,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "email" | "phone" | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Form ID is required", { status: 400 });
  }

  try {
    const form = await db.form.findFirst({
      where: { 
        id,
        shop: session.shop 
      },
      include: {
        fields: {
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!form) {
      throw new Response("Form not found", { status: 404 });
    }

    // Transform database fields to match our interface
    const transformedFields = form.fields.map(field => ({
      id: field.id,
      type: field.type as FormField["type"],
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
        fields: transformedFields,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      }
    });
  } catch (error) {
    console.error('Database error in loader:', error);
    throw new Response("Error loading form", { status: 500 });
  }
};

export default function ViewForm() {
  const { form } = useLoaderData<typeof loader>();

  const renderField = (field: FormField) => {
    const commonProps = {
      label: field.label,
      placeholder: field.placeholder,
      requiredIndicator: field.required,
      disabled: true, // Read-only mode
    };

    switch (field.type) {
      case "text":
      case "email":
        return <TextField {...commonProps} type={field.type} autoComplete="off" />;
      case "phone":
        return <TextField {...commonProps} type="tel" autoComplete="off" />;
      case "textarea":
        return <TextField {...commonProps} multiline={4} autoComplete="off" />;
      case "date":
        return <TextField {...commonProps} type="date" autoComplete="off" />;
      case "select":
        return (
          <Select
            {...commonProps}
            options={field.options?.map(opt => ({ label: opt, value: opt })) || []}
          />
        );
      case "checkbox":
        return <Checkbox label={field.label} disabled />;
      case "radio":
        return (
          <Box>
            <Text as="p" variant="bodyMd" fontWeight="medium">{field.label}</Text>
            {field.options?.map((option, index) => (
              <RadioButton
                key={index}
                label={option}
                id={`${field.id}-${index}`}
                name={field.id}
                checked={false}
                disabled
              />
            ))}
          </Box>
        );
      default:
        return <TextField {...commonProps} autoComplete="off" />;
    }
  };

  return (
    <Page
      backAction={{content: 'Forms', url: '/app'}}
      primaryAction={{
        content: "Edit Form",
        url: `/app/edit/${form.id}`,
      }}
    >
      <TitleBar title={`View: ${form.name}`} />
      
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <div>
                <Text as="h1" variant="headingXl">
                  {form.name}
                </Text>
                {form.description && (
                  <Text as="p" variant="bodyLg" tone="subdued">
                    {form.description}
                  </Text>
                )}
              </div>
              
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <Text as="p" variant="bodySm" tone="subdued">
                  Created: {new Date(form.createdAt).toLocaleDateString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Last updated: {new Date(form.updatedAt).toLocaleDateString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Fields: {form.fields.length}
                </Text>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Form Preview
              </Text>
              
              {form.fields.length > 0 ? (
                <FormLayout>
                  {form.fields.map(field => (
                    <div key={field.id}>
                      {renderField(field)}
                    </div>
                  ))}
                  <Button variant="primary" size="large" disabled>
                    Submit Form (Preview Only)
                  </Button>
                </FormLayout>
              ) : (
                <Box padding="400" background="bg-surface-secondary">
                  <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                    This form has no fields yet.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
