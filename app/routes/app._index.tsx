import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Text,
} from "@shopify/polaris";
import db from "../db.server";

export async function loader({ request }: { request: Request }) {
  const { session } = await authenticate.admin(request);
  const forms = await db.form.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return json({
    forms,
  });
}

const EmptyStateComponent = ({ onAction }: { onAction: () => void }) => (
  <EmptyState
    heading="Create your first form"
    action={{
      content: "Create Form",
      onAction,
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
  >
    {/* <p>Allow customers to scan codes and buy products using their phones.</p> */}
  </EmptyState>
);

function truncate(str: any, { length = 25 } = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

const Table = ({ forms }: { forms: any[] }) => (
  <IndexTable
    resourceName={{
      singular: "Form",
      plural: "Forms",
    }}
    itemCount={forms.length}
    headings={[
      { title: "Title" },
      { title: "Code" },
      { title: "Fields" },
      { title: "Date created" },
    ]}
    selectable={false}
  >
    {forms.map((form) => (
      <FormTableRow key={form.id} form={form} />
    ))}
  </IndexTable>
);

const FormTableRow = ({ form }: { form: any }) => {
  const fieldsCount = JSON.parse(form.fields || "[]").length;

  return (
    <IndexTable.Row id={form.id} position={form.id}>
      <IndexTable.Cell>
        <Link to={`form/${form.id}`}>
          <Text as="span" fontWeight="semibold">
            {truncate(form.title)}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {form.code}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {fieldsCount} {fieldsCount === 1 ? "field" : "fields"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(form.createdAt).toDateString()}
      </IndexTable.Cell>
    </IndexTable.Row>
  );
};

export default function Index() {
  const { forms } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <ui-title-bar title="ShopiForms">
        <Link to="/app/form/new">Create Form</Link>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {forms.length === 0 ? (
              <EmptyStateComponent onAction={() => navigate("form/new")} />
            ) : (
              <Table forms={forms} />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
