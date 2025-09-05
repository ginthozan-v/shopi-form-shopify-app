import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Page, Layout, Card, EmptyState, ResourceList, ResourceItem, Text, Badge, Button, ButtonGroup } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    // Ensure db is available
    if (!db) {
      console.error('Database client is not initialized');
      return json({ forms: [] });
    }
    
    const forms = await db.form.findMany({
      where: { shop: session.shop },
      include: {
        fields: true,
        _count: {
          select: { fields: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return json({ forms });
  } catch (error) {
    console.error('Database error in loader:', error);
    return json({ forms: [] });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "delete") {
    const formId = formData.get("formId") as string;
    
    if (!formId) {
      return json({ error: "Form ID is required" }, { status: 400 });
    }

    try {
      // Verify the form belongs to this shop before deleting
      const form = await db.form.findFirst({
        where: { id: formId, shop: session.shop }
      });

      if (!form) {
        return json({ error: "Form not found" }, { status: 404 });
      }

      await db.form.delete({
        where: { id: formId }
      });

      return json({ success: true, message: "Form deleted successfully" });
    } catch (error) {
      console.error("Error deleting form:", error);
      return json({ error: "Failed to delete form" }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function Index() {
  const { forms } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const deleteForm = (formId: string, formName: string) => {
    if (confirm(`Are you sure you want to delete "${formName}"? This action cannot be undone.`)) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("formId", formId);
      fetcher.submit(formData, { method: "post" });
    }
  };

  // Handle delete success/error
  useEffect(() => {
    if (fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
      shopify.toast.show(fetcher.data.message || "Form deleted successfully");
    } else if (fetcher.data && 'error' in fetcher.data && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <Page>
      <TitleBar title="ShopiForm" />
      <Layout>
        <Layout.Section>
          {forms.length === 0 ? (
            <Card>
              <EmptyState
                heading="Grow your audience with forms"
                action={{ content: "Create a form", url: "/app/new" }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Engage online store customers to grow email lists and gain
                  insights. Create a form for lead generation in minutes.
                </p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <ResourceList
                resourceName={{ singular: "form", plural: "forms" }}
                items={forms}
                renderItem={(form) => {
                  const { id, name, description, _count, createdAt } = form;
                  
                  return (
                    <ResourceItem
                      id={id}
                      accessibilityLabel={`View form ${name}`}
                      onClick={() => window.location.href = `/app/view/${id}`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                        <div>
                          <Text variant="bodyMd" fontWeight="bold" as="h3">
                            {name}
                          </Text>
                          {description && (
                            <Text variant="bodyMd" as="p" tone="subdued">
                              {description}
                            </Text>
                          )}
                          <Text variant="bodySm" as="p" tone="subdued">
                            Form ID: {id}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            Created {new Date(createdAt).toLocaleDateString()}
                          </Text>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <Badge tone="info">
                            {`${_count.fields} field${_count.fields !== 1 ? 's' : ''}`}
                          </Badge>
                          <ButtonGroup>
                            <Button
                              size="slim"
                              url={`/app/view/${id}`}
                            >
                              View
                            </Button>
                            <Button
                              size="slim"
                              url={`/app/edit/${id}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="slim"
                              tone="critical"
                              onClick={() => deleteForm(id, name)}
                              loading={fetcher.state === "submitting"}
                            >
                              Delete
                            </Button>
                          </ButtonGroup>
                        </div>
                      </div>
                    </ResourceItem>
                  );
                }}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
