import { useState, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  Card,
  Page,
  Text,
  BlockStack,
  Button,
  InlineGrid,
  TextField,
  Select,
  Checkbox,
  InlineStack,
  Divider,
  Modal,
  PageActions,
  Banner,
} from "@shopify/polaris";
import {
  TextIcon,
  EmailIcon,
  PhoneIcon,
  CalendarIcon,
  SelectIcon,
  CheckboxIcon,
  DeleteIcon,
} from "@shopify/polaris-icons";

type FieldType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "textarea"
  | "select"
  | "checkbox";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const fieldTypes = [
  { type: "text" as FieldType, label: "Text Input", icon: TextIcon },
  { type: "email" as FieldType, label: "Email", icon: EmailIcon },
  { type: "phone" as FieldType, label: "Phone", icon: PhoneIcon },
  { type: "date" as FieldType, label: "Date", icon: CalendarIcon },
  { type: "textarea" as FieldType, label: "Text Area", icon: TextIcon },
  { type: "select" as FieldType, label: "Dropdown", icon: SelectIcon },
  { type: "checkbox" as FieldType, label: "Checkbox", icon: CheckboxIcon },
];

// Generate a unique 5-digit code
async function generateUniqueCode(): Promise<string> {
  let code: string;
  let exists = true;

  while (exists) {
    code = Math.floor(10000 + Math.random() * 90000).toString();
    const existingForm = await db.form.findUnique({
      where: { code },
    });
    exists = !!existingForm;
  }

  return code!;
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { session } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      id: null,
      code: null,
      title: "Untitled Form",
      description: "",
      fields: [],
      shop: session.shop,
    });
  }

  const form = await db.form.findUnique({
    where: { id: Number(params.id) },
  });

  if (!form) {
    return redirect("/app");
  }

  return json({
    id: form.id,
    code: form.code,
    title: form.title,
    description: form.description || "",
    fields: JSON.parse(form.fields),
    shop: form.shop,
  });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "delete") {
    await db.form.delete({ where: { id: Number(params.id) } });
    return redirect("/app");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const fields = formData.get("fields") as string;

  if (params.id === "new") {
    const code = await generateUniqueCode();
    const form = await db.form.create({
      data: {
        code,
        shop: session.shop,
        title,
        description,
        fields,
      },
    });
    return redirect(`/app/form/${form.id}`);
  } else {
    const form = await db.form.update({
      where: { id: Number(params.id) },
      data: {
        title,
        description,
        fields,
      },
    });
    return json({ success: true, form });
  }
}

export default function FormPage() {
  const loaderData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const [fields, setFields] = useState<FormField[]>([]);
  const [formTitle, setFormTitle] = useState("Untitled Form");
  const [formDescription, setFormDescription] = useState("");

  // Load data from loader
  useEffect(() => {
    if (loaderData) {
      setFormTitle(loaderData.title);
      setFormDescription(loaderData.description);
      setFields(loaderData.fields);
    }
  }, [loaderData]);

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      placeholder: "",
      required: false,
      options: type === "select" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(
      fields.map((field) =>
        field.id === id ? { ...field, ...updates } : field,
      ),
    );
  };

  const removeField = (id: string) => {
    setFields(fields.filter((field) => field.id !== id));
  };

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case "text":
      case "email":
        return (
          <TextField
            label={field.label}
            type={field.type}
            placeholder={field.placeholder}
            autoComplete="off"
            requiredIndicator={field.required}
          />
        );
      case "phone":
        return (
          <TextField
            label={field.label}
            type="tel"
            placeholder={field.placeholder}
            autoComplete="off"
            requiredIndicator={field.required}
          />
        );
      case "date":
        return (
          <TextField
            label={field.label}
            type="date"
            autoComplete="off"
            requiredIndicator={field.required}
          />
        );
      case "textarea":
        return (
          <TextField
            label={field.label}
            placeholder={field.placeholder}
            multiline={4}
            autoComplete="off"
            requiredIndicator={field.required}
          />
        );
      case "select":
        return (
          <Select
            label={field.label}
            options={
              field.options?.map((opt) => ({ label: opt, value: opt })) || []
            }
            requiredIndicator={field.required}
          />
        );
      case "checkbox":
        return <Checkbox label={field.label} />;
      default:
        return null;
    }
  };

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldTypeToAdd, setFieldTypeToAdd] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const handleAddField = (value: string) => {
    if (value) {
      addField(value as FieldType);
      setFieldTypeToAdd(""); // Reset the dropdown
    }
  };

  const handleEditField = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFieldId(null);
  };

  const handleDeleteField = () => {
    if (selectedFieldId) {
      removeField(selectedFieldId);
      handleCloseModal();
    }
  };

  const handleQuickDelete = (fieldId: string) => {
    removeField(fieldId);
  };

  const handleDragStart = (fieldId: string) => {
    setDraggedFieldId(fieldId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetFieldId: string) => {
    if (!draggedFieldId || draggedFieldId === targetFieldId) {
      setDraggedFieldId(null);
      return;
    }

    const draggedIndex = fields.findIndex((f) => f.id === draggedFieldId);
    const targetIndex = fields.findIndex((f) => f.id === targetFieldId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedFieldId(null);
      return;
    }

    const newFields = [...fields];
    const [draggedField] = newFields.splice(draggedIndex, 1);
    newFields.splice(targetIndex, 0, draggedField);

    setFields(newFields);
    setDraggedFieldId(null);
  };

  const handleDragEnd = () => {
    setDraggedFieldId(null);
  };

  const handleSave = () => {
    const data = new FormData();
    data.append("title", formTitle);
    data.append("description", formDescription);
    data.append("fields", JSON.stringify(fields));
    submit(data, { method: "post" });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this form?")) {
      const data = new FormData();
      data.append("action", "delete");
      submit(data, { method: "post" });
    }
  };

  return (
    <Page>
      <ui-title-bar title={loaderData.id ? "Edit Form" : "Create New Form"}>
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          Forms
        </button>
      </ui-title-bar>

      {loaderData.code && (
        <div style={{ marginBottom: "1rem" }}>
          <Banner tone="info">
            <Text as="p" variant="bodyMd">
              Form Code: <strong>{loaderData.code}</strong> - Share this code
              with your customers
            </Text>
          </Banner>
        </div>
      )}

      <InlineGrid columns={{ xs: 1, md: "1fr 1fr" }} gap="400">
        {/* Left Side - Form Builder */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Form Builder
            </Text>
            <Divider />

            {/* Form Title & Description */}
            <TextField
              label="Form Title"
              value={formTitle}
              onChange={setFormTitle}
              autoComplete="off"
            />

            <TextField
              label="Form Description"
              value={formDescription}
              onChange={setFormDescription}
              multiline={3}
              autoComplete="off"
              placeholder="Add a description for your form..."
            />

            <Divider />

            {/* Add Field Dropdown */}
            <Select
              label="Add a field"
              options={[
                { label: "Select a field type...", value: "" },
                ...fieldTypes.map(({ type, label }) => ({
                  label,
                  value: type,
                })),
              ]}
              value={fieldTypeToAdd}
              onChange={(value) => {
                setFieldTypeToAdd(value);
                handleAddField(value);
              }}
            />

            {/* Field List */}
            {fields.length === 0 ? (
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  No fields added yet. Select a field type above to get started.
                </Text>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => handleDragStart(field.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(field.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleEditField(field.id)}
                    style={{
                      cursor: draggedFieldId === field.id ? "grabbing" : "grab",
                      opacity: draggedFieldId === field.id ? 0.5 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <Card>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            {field.label}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {field.type} {field.required && "• Required"}
                          </Text>
                        </BlockStack>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            icon={DeleteIcon}
                            variant="plain"
                            tone="critical"
                            onClick={() => handleQuickDelete(field.id)}
                            accessibilityLabel="Delete field"
                          />
                        </div>
                      </InlineStack>
                    </Card>
                  </div>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Right Side - Form Preview */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Preview
            </Text>
            <Divider />
            <BlockStack gap="400">
              {/* Form Title & Description Preview */}
              <BlockStack gap="200">
                <Text as="h1" variant="heading2xl">
                  {formTitle}
                </Text>
                {formDescription && (
                  <Text as="p" variant="bodyLg" tone="subdued">
                    {formDescription}
                  </Text>
                )}
              </BlockStack>

              {fields.length === 0 ? (
                <BlockStack gap="200" inlineAlign="center">
                  <Text
                    as="p"
                    variant="bodyMd"
                    tone="subdued"
                    alignment="center"
                  >
                    Add fields to see them here
                  </Text>
                </BlockStack>
              ) : (
                <>
                  {fields.map((field) => (
                    <div key={field.id}>{renderFieldPreview(field)}</div>
                  ))}
                </>
              )}

              <Button variant="primary" size="large">
                Submit
              </Button>
            </BlockStack>
          </BlockStack>
        </Card>
      </InlineGrid>

      {/* Edit Field Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title="Edit Field"
        primaryAction={{
          content: "Done",
          onAction: handleCloseModal,
        }}
        secondaryActions={[
          {
            content: "Delete Field",
            destructive: true,
            onAction: handleDeleteField,
          },
        ]}
      >
        <Modal.Section>
          {selectedField && (
            <BlockStack gap="400">
              <TextField
                label="Field Label"
                value={selectedField.label}
                onChange={(value) =>
                  updateField(selectedField.id, { label: value })
                }
                autoComplete="off"
              />
              {selectedField.type !== "checkbox" && (
                <TextField
                  label="Placeholder"
                  value={selectedField.placeholder || ""}
                  onChange={(value) =>
                    updateField(selectedField.id, { placeholder: value })
                  }
                  autoComplete="off"
                />
              )}
              <Checkbox
                label="Required"
                checked={selectedField.required}
                onChange={(value) =>
                  updateField(selectedField.id, { required: value })
                }
              />
              <Divider />
              <Text as="p" variant="bodySm" tone="subdued">
                Preview:
              </Text>
              {renderFieldPreview(selectedField)}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>

      {/* Page Actions */}
      <div style={{ marginTop: "1rem" }}>
        <PageActions
          primaryAction={{
            content: "Save",
            loading: isSaving,
            onAction: handleSave,
          }}
          secondaryActions={
            loaderData.id
              ? [
                  {
                    content: "Delete",
                    destructive: true,
                    onAction: handleDelete,
                  },
                ]
              : []
          }
        />
      </div>
    </Page>
  );
}
