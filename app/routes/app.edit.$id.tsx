import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
import {
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
  Select,
  Checkbox,
  RadioButton,
  Box,
  Badge,
  Modal,
  FormLayout,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "email" | "phone" | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  value?: string;
}

interface FormData {
  name: string;
  description: string;
  fields: FormField[];
}

const FIELD_TYPES = [
  { label: "Text Input", value: "text" },
  { label: "Textarea", value: "textarea" },
  { label: "Select Dropdown", value: "select" },
  { label: "Checkbox", value: "checkbox" },
  { label: "Radio Button", value: "radio" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "phone" },
  { label: "Date", value: "date" },
];

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
    const transformedFields = form.fields.map((field: any) => ({
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
        fields: transformedFields
      }
    });
  } catch (error) {
    console.error('Database error in loader:', error);
    throw new Response("Error loading form", { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const action = formData.get("action");

  if (!id) {
    return json({ error: "Form ID is required" }, { status: 400 });
  }

  if (action === "update") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const fieldsJson = formData.get("fields") as string;
    
    if (!name) {
      return json({ error: "Form name is required" }, { status: 400 });
    }

    const fields = JSON.parse(fieldsJson) as FormField[];

    try {
      // First, verify the form belongs to this shop
      const existingForm = await db.form.findFirst({
        where: { id, shop: session.shop }
      });

      if (!existingForm) {
        return json({ error: "Form not found" }, { status: 404 });
      }

      // Update the form and replace all fields
      const updatedForm = await db.form.update({
        where: { id },
        data: {
          name,
          description: description || null,
          fields: {
            deleteMany: {}, // Delete all existing fields
            create: fields.map((field, index) => ({
              type: field.type,
              label: field.label,
              placeholder: field.placeholder || null,
              required: field.required,
              options: field.options ? JSON.stringify(field.options) : null,
              position: index,
            })),
          },
        },
        include: {
          fields: true,
        },
      });

      return json({ success: true, form: updatedForm });
    } catch (error) {
      console.error("Error updating form:", error);
      return json({ error: "Failed to update form" }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function EditForm() {
  const { form: initialForm } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  
  const [formData, setFormData] = useState<FormData>({
    name: initialForm.name,
    description: initialForm.description,
    fields: initialForm.fields as FormField[],
  });
  
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const isLoading = navigation.state === "submitting" || fetcher.state === "submitting";

  const handleFormNameChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
  }, []);

  const handleFormDescriptionChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, description: value }));
  }, []);

  const openFieldModal = useCallback((field?: FormField) => {
    if (field) {
      setSelectedField(field);
      setIsEditing(true);
    } else {
      setSelectedField({
        id: Date.now().toString(),
        type: "text",
        label: "",
        required: false,
      });
      setIsEditing(false);
    }
    setIsFieldModalOpen(true);
  }, []);

  const closeFieldModal = useCallback(() => {
    setIsFieldModalOpen(false);
    setSelectedField(null);
    setIsEditing(false);
  }, []);

  const saveField = useCallback(() => {
    if (!selectedField) return;

    // Validate field
    if (!selectedField.label.trim()) {
      shopify.toast.show("Field label is required", { isError: true });
      return;
    }

    if ((selectedField.type === "select" || selectedField.type === "radio") && 
        (!selectedField.options || selectedField.options.length === 0)) {
      shopify.toast.show("Please add at least one option", { isError: true });
      return;
    }

    setFormData(prev => {
      const newFields = isEditing
        ? prev.fields.map(f => f.id === selectedField.id ? selectedField : f)
        : [...prev.fields, selectedField];
      
      return { ...prev, fields: newFields };
    });
    
    closeFieldModal();
  }, [selectedField, isEditing, closeFieldModal, shopify]);

  const deleteField = useCallback((fieldId: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId),
    }));
  }, []);

  const moveField = useCallback((fieldId: string, direction: "up" | "down") => {
    setFormData(prev => {
      const fields = [...prev.fields];
      const index = fields.findIndex(f => f.id === fieldId);
      
      if (direction === "up" && index > 0) {
        [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
      } else if (direction === "down" && index < fields.length - 1) {
        [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
      }
      
      return { ...prev, fields };
    });
  }, []);

  const updateForm = useCallback(() => {
    if (!formData.name.trim()) {
      shopify.toast.show("Please enter a form name", { isError: true });
      return;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append("action", "update");
    formDataToSubmit.append("name", formData.name);
    formDataToSubmit.append("description", formData.description);
    formDataToSubmit.append("fields", JSON.stringify(formData.fields));

    fetcher.submit(formDataToSubmit, { method: "post" });
  }, [formData, fetcher, shopify]);

  // Handle update success/error
  const showSuccessBanner = fetcher.data && 'success' in fetcher.data && fetcher.data.success;
  const showErrorBanner = fetcher.data && 'error' in fetcher.data && fetcher.data.error;

  // Show success toast
  useEffect(() => {
    if (showSuccessBanner) {
      shopify.toast.show("Form updated successfully!");
    }
  }, [showSuccessBanner, shopify]);

  const renderFieldPreview = (field: FormField) => {
    const commonProps = {
      label: field.label,
      placeholder: field.placeholder,
      requiredIndicator: field.required,
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
        return <Checkbox label={field.label} />;
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
              />
            ))}
          </Box>
        );
      default:
        return <TextField {...commonProps} autoComplete="off" />;
    }
  };

  const renderFieldBuilder = (field: FormField, index: number) => (
    <Card key={field.id}>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="span">⋮⋮</Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {field.label || `Field ${index + 1}`}
            </Text>
            <Badge tone="info">{field.type}</Badge>
            {field.required && <Badge tone="attention">Required</Badge>}
          </InlineStack>
          <ButtonGroup>
            <Button
              size="micro"
              onClick={() => moveField(field.id, "up")}
              disabled={index === 0}
              accessibilityLabel="Move field up"
            >
              ↑
            </Button>
            <Button
              size="micro"
              onClick={() => moveField(field.id, "down")}
              disabled={index === formData.fields.length - 1}
              accessibilityLabel="Move field down"
            >
              ↓
            </Button>
            <Button
              size="micro"
              onClick={() => openFieldModal(field)}
              accessibilityLabel="Edit field"
            >
              ✏️
            </Button>
            <Button
              size="micro"
              tone="critical"
              onClick={() => deleteField(field.id)}
              accessibilityLabel="Delete field"
            >
              🗑️
            </Button>
          </ButtonGroup>
        </InlineStack>
        
        <Box paddingInlineStart="600">
          {renderFieldPreview(field)}
        </Box>
      </BlockStack>
    </Card>
  );

  return (
    <Page
      backAction={{content: 'Forms', url: '/app'}}
      primaryAction={{
        content: previewMode ? "Edit Form" : "Preview Form",
        onAction: () => setPreviewMode(!previewMode),
      }}
      secondaryActions={[
        { content: "Update Form", onAction: updateForm, loading: isLoading },
      ]}
    >
      <TitleBar title={`Edit: ${initialForm.name}`} />
      
      {showSuccessBanner && (
        <Banner
          title="Form updated successfully!"
          tone="success"
          onDismiss={() => {
            // Reset by reloading
            window.location.reload();
          }}
        />
      )}
      
      {showErrorBanner && (
        <Banner
          title="Error updating form"
          tone="critical"
          onDismiss={() => {
            // Reset by reloading
            window.location.reload();
          }}
        >
          <Text as="p" variant="bodyMd">
            {fetcher.data && 'error' in fetcher.data ? fetcher.data.error : 'Unknown error'}
          </Text>
        </Banner>
      )}
      
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Form Settings
              </Text>
              
              <TextField
                label="Form Name"
                value={formData.name}
                onChange={handleFormNameChange}
                placeholder="Enter form name"
                autoComplete="off"
              />
              
              <TextField
                label="Form Description"
                value={formData.description}
                onChange={handleFormDescriptionChange}
                placeholder="Describe your form"
                multiline={3}
                autoComplete="off"
              />
            </BlockStack>
          </Card>

          {!previewMode && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Form Fields
                  </Text>
                  <Button
                    onClick={() => openFieldModal()}
                    variant="primary"
                  >
                    ➕ Add Field
                  </Button>
                </InlineStack>

                {formData.fields.length === 0 ? (
                  <Box padding="400" background="bg-surface-secondary">
                    <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                      No fields added yet. Click "Add Field" to get started.
                    </Text>
                  </Box>
                ) : (
                  <BlockStack gap="300">
                    {formData.fields.map((field, index) =>
                      renderFieldBuilder(field, index)
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Form Preview
              </Text>
              
              {formData.name && (
                <Text as="h3" variant="headingLg">
                  {formData.name}
                </Text>
              )}
              
              {formData.description && (
                <Text as="p" variant="bodyMd">
                  {formData.description}
                </Text>
              )}

              {formData.fields.length > 0 ? (
                <FormLayout>
                  {formData.fields.map(field => (
                    <div key={field.id}>
                      {renderFieldPreview(field)}
                    </div>
                  ))}
                  <Button variant="primary" size="large">
                    Submit Form
                  </Button>
                </FormLayout>
              ) : (
                <Box padding="400" background="bg-surface-secondary">
                  <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                    Form preview will appear here as you add fields.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Field Editor Modal */}
      <Modal
        open={isFieldModalOpen}
        onClose={closeFieldModal}
        title={isEditing ? "Edit Field" : "Add Field"}
        primaryAction={{
          content: isEditing ? "Update Field" : "Add Field",
          onAction: saveField,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: closeFieldModal,
          },
        ]}
      >
        <Modal.Section>
          {selectedField && (
            <FormLayout>
              <Select
                label="Field Type"
                options={FIELD_TYPES}
                value={selectedField.type}
                onChange={(value) =>
                  setSelectedField(prev => prev ? { ...prev, type: value as FormField["type"] } : null)
                }
              />

              <TextField
                label="Field Label"
                value={selectedField.label}
                onChange={(value) =>
                  setSelectedField(prev => prev ? { ...prev, label: value } : null)
                }
                placeholder="Enter field label"
                autoComplete="off"
              />

              <TextField
                label="Placeholder Text"
                value={selectedField.placeholder || ""}
                onChange={(value) =>
                  setSelectedField(prev => prev ? { ...prev, placeholder: value } : null)
                }
                placeholder="Enter placeholder text (optional)"
                autoComplete="off"
              />

              <Checkbox
                label="Required Field"
                checked={selectedField.required}
                onChange={(checked) =>
                  setSelectedField(prev => prev ? { ...prev, required: checked } : null)
                }
              />

              {(selectedField.type === "select" || selectedField.type === "radio") && (
                <TextField
                  label="Options (one per line)"
                  value={selectedField.options?.join("\n") || ""}
                  onChange={(value) =>
                    setSelectedField(prev => prev ? {
                      ...prev,
                      options: value.split("\n").filter(opt => opt.trim())
                    } : null)
                  }
                  multiline={4}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  autoComplete="off"
                />
              )}
            </FormLayout>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
