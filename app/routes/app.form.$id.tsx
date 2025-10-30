import { useState, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useNavigation,
} from "@remix-run/react";
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
  DeleteIcon,
} from "@shopify/polaris-icons";

type FieldType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "textarea"
  | "select"
  | "checkbox"
  | "company";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const fieldTypes = [
  { type: "text" as FieldType, label: "First Name", icon: TextIcon },
  { type: "text" as FieldType, label: "Last Name", icon: TextIcon },
  { type: "email" as FieldType, label: "Email", icon: EmailIcon },
  { type: "phone" as FieldType, label: "Phone", icon: PhoneIcon },
  { type: "company" as FieldType, label: "Company", icon: TextIcon },
];

// List of countries for the company field
const countries = [
  { label: "United States", value: "US", code: "+1" },
  { label: "Canada", value: "CA", code: "+1" },
  { label: "United Kingdom", value: "GB", code: "+44" },
  { label: "Australia", value: "AU", code: "+61" },
  { label: "Germany", value: "DE", code: "+49" },
  { label: "France", value: "FR", code: "+33" },
  { label: "Italy", value: "IT", code: "+39" },
  { label: "Spain", value: "ES", code: "+34" },
  { label: "Netherlands", value: "NL", code: "+31" },
  { label: "Belgium", value: "BE", code: "+32" },
  { label: "Switzerland", value: "CH", code: "+41" },
  { label: "Austria", value: "AT", code: "+43" },
  { label: "Sweden", value: "SE", code: "+46" },
  { label: "Norway", value: "NO", code: "+47" },
  { label: "Denmark", value: "DK", code: "+45" },
  { label: "Finland", value: "FI", code: "+358" },
  { label: "Ireland", value: "IE", code: "+353" },
  { label: "Poland", value: "PL", code: "+48" },
  { label: "Portugal", value: "PT", code: "+351" },
  { label: "Greece", value: "GR", code: "+30" },
  { label: "Czech Republic", value: "CZ", code: "+420" },
  { label: "Hungary", value: "HU", code: "+36" },
  { label: "Romania", value: "RO", code: "+40" },
  { label: "Bulgaria", value: "BG", code: "+359" },
  { label: "Croatia", value: "HR", code: "+385" },
  { label: "Slovakia", value: "SK", code: "+421" },
  { label: "Slovenia", value: "SI", code: "+386" },
  { label: "Lithuania", value: "LT", code: "+370" },
  { label: "Latvia", value: "LV", code: "+371" },
  { label: "Estonia", value: "EE", code: "+372" },
  { label: "Luxembourg", value: "LU", code: "+352" },
  { label: "Malta", value: "MT", code: "+356" },
  { label: "Cyprus", value: "CY", code: "+357" },
  { label: "Japan", value: "JP", code: "+81" },
  { label: "South Korea", value: "KR", code: "+82" },
  { label: "China", value: "CN", code: "+86" },
  { label: "India", value: "IN", code: "+91" },
  { label: "Singapore", value: "SG", code: "+65" },
  { label: "Hong Kong", value: "HK", code: "+852" },
  { label: "Malaysia", value: "MY", code: "+60" },
  { label: "Thailand", value: "TH", code: "+66" },
  { label: "Indonesia", value: "ID", code: "+62" },
  { label: "Philippines", value: "PH", code: "+63" },
  { label: "Vietnam", value: "VN", code: "+84" },
  { label: "New Zealand", value: "NZ", code: "+64" },
  { label: "Brazil", value: "BR", code: "+55" },
  { label: "Mexico", value: "MX", code: "+52" },
  { label: "Argentina", value: "AR", code: "+54" },
  { label: "Chile", value: "CL", code: "+56" },
  { label: "Colombia", value: "CO", code: "+57" },
  { label: "Peru", value: "PE", code: "+51" },
  { label: "South Africa", value: "ZA", code: "+27" },
  { label: "Israel", value: "IL", code: "+972" },
  { label: "United Arab Emirates", value: "AE", code: "+971" },
  { label: "Saudi Arabia", value: "SA", code: "+966" },
  { label: "Turkey", value: "TR", code: "+90" },
  { label: "Russia", value: "RU", code: "+7" },
  { label: "Ukraine", value: "UA", code: "+380" },
  { label: "Egypt", value: "EG", code: "+20" },
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

  // Detect user's country from IP geolocation
  const getDefaultCountry = () => {
    try {
      // Fallback to browser locale
      const locale = navigator.language || 'en-US';
      const countryCode = locale.split('-')[1]?.toUpperCase() || 'US';
      const countryExists = countries.some(c => c.value === countryCode);
      return countryExists ? countryCode : 'US';
    } catch {
      return 'US';
    }
  };

  const [fields, setFields] = useState<FormField[]>([]);
  const [formTitle, setFormTitle] = useState("Untitled Form");
  const [formDescription, setFormDescription] = useState("");
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [selectedBillingCountry, setSelectedBillingCountry] = useState(getDefaultCountry());
  const [selectedShippingCountry, setSelectedShippingCountry] = useState(getDefaultCountry());

  // Detect country from IP on mount
  useEffect(() => {
    async function detectCountry() {
      try {
        const response = await fetch('https://ipapi.co/country/');
        if (response.ok) {
          const countryCode = (await response.text()).trim().toUpperCase();
          const countryExists = countries.some(c => c.value === countryCode);
          if (countryExists) {
            setSelectedBillingCountry(countryCode);
            setSelectedShippingCountry(countryCode);
          }
        }
      } catch (error) {
        console.log('Could not detect country from IP, using browser locale');
      }
    }
    detectCountry();
  }, []);

  // Load data from loader
  useEffect(() => {
    if (loaderData) {
      setFormTitle(loaderData.title);
      setFormDescription(loaderData.description);
      setFields(loaderData.fields);
    }
  }, [loaderData]);

  const addField = (type: FieldType) => {
    const fieldTypeConfig = fieldTypes.find(ft => ft.type === type);
    const newField: FormField = {
      id: `field-${Date.now()}`,
      type,
      label: fieldTypeConfig?.label || `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
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
      case "company":
        const billingCountryCode = countries.find(c => c.value === selectedBillingCountry)?.code || "+1";
        const shippingCountryCode = countries.find(c => c.value === selectedShippingCountry)?.code || "+1";
        
        return (
          <BlockStack gap="400">
            {/* Billing Address Section */}
            <Text as="h3" variant="headingMd">
              Billing Address
            </Text>
            
            <Select
              label="Country"
              options={countries.map(c => ({ label: c.label, value: c.value }))}
              value={selectedBillingCountry}
              onChange={setSelectedBillingCountry}
              requiredIndicator={field.required}
            />
            
            <TextField
              label="Company Name"
              placeholder="Enter company name"
              autoComplete="off"
              requiredIndicator={field.required}
            />
            
            <InlineGrid columns={2} gap="200">
              <TextField
                label="Street & House Number"
                placeholder="123 Main St"
                autoComplete="off"
                requiredIndicator={field.required}
              />
              
              <TextField
                label="Apartment, Suite, etc."
                placeholder="Apt 4B"
                autoComplete="off"
              />
            </InlineGrid>
            
            <InlineGrid columns={2} gap="200">
              <TextField
                label="Postal Code"
                placeholder="10001"
                autoComplete="off"
                requiredIndicator={field.required}
              />
              
              <TextField
                label="City"
                placeholder="New York"
                autoComplete="off"
                requiredIndicator={field.required}
              />
            </InlineGrid>
            
            <InlineGrid columns={["oneThird", "twoThirds"]} gap="200">
              <TextField
                label="Country Code"
                value={billingCountryCode}
                disabled
                autoComplete="off"
              />
              
              <TextField
                label="Billing Phone"
                type="tel"
                placeholder="(555) 123-4567"
                autoComplete="off"
                requiredIndicator={field.required}
              />
            </InlineGrid>
            
            <TextField
              label="Company Tax ID"
              placeholder="Enter tax ID"
              autoComplete="off"
              requiredIndicator={field.required}
            />
            
            <Divider />
            
            {/* Shipping Same as Billing Checkbox */}
            <Checkbox
              label="Shipping address same as billing"
              checked={shippingSameAsBilling}
              onChange={setShippingSameAsBilling}
            />
            
            {/* Shipping Address Section - Only shown if checkbox is unchecked */}
            {!shippingSameAsBilling && (
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Shipping Address
                </Text>
                
                <Select
                  label="Country"
                  options={countries.map(c => ({ label: c.label, value: c.value }))}
                  value={selectedShippingCountry}
                  onChange={setSelectedShippingCountry}
                  requiredIndicator={field.required}
                />
                
                <TextField
                  label="Company Name"
                  placeholder="Enter company name"
                  autoComplete="off"
                  requiredIndicator={field.required}
                />
                
                <InlineGrid columns={2} gap="200">
                  <TextField
                    label="Street & House Number"
                    placeholder="123 Main St"
                    autoComplete="off"
                    requiredIndicator={field.required}
                  />
                  
                  <TextField
                    label="Apartment, Suite, etc."
                    placeholder="Apt 4B"
                    autoComplete="off"
                  />
                </InlineGrid>
                
                <InlineGrid columns={2} gap="200">
                  <TextField
                    label="Postal Code"
                    placeholder="10001"
                    autoComplete="off"
                    requiredIndicator={field.required}
                  />
                  
                  <TextField
                    label="City"
                    placeholder="New York"
                    autoComplete="off"
                    requiredIndicator={field.required}
                  />
                </InlineGrid>
                
                <InlineGrid columns={["oneThird", "twoThirds"]} gap="200">
                  <TextField
                    label="Country Code"
                    value={shippingCountryCode}
                    disabled
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Shipping Phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    autoComplete="off"
                    requiredIndicator={field.required}
                  />
                </InlineGrid>
              </BlockStack>
            )}
          </BlockStack>
        );
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
          ShopiForms
        </button>
      </ui-title-bar>

      {loaderData.code && (
        <div style={{ marginBottom: "1rem" }}>
          <Banner tone="info">
            <Text as="p" variant="bodyMd">
              Form Code: <strong>{loaderData.code}</strong> - You this code in your storefront customizer
            </Text>
          </Banner>
        </div>
      )}

      <InlineGrid columns={{ xs: 1, md: "1.2fr .8fr" }} gap="400">
        {/* Left Side - Form Builder */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingSm">
              Form
            </Text>
            <Divider />

            {/* Form Title & Description */}
            <TextField
              label="Title"
              value={formTitle}
              onChange={setFormTitle}
              autoComplete="off"
            />

            <TextField
              label="Description"
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
            <Text as="h2" variant="headingSm">
              Preview
            </Text>
            <Divider />
            <BlockStack gap="400">
              {/* Form Title & Description Preview */}
              <BlockStack gap="200">
                <Text as="h1" variant="headingLg">
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
              {selectedField.type !== "checkbox" && selectedField.type !== "company" && (
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
