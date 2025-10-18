# Form Submission & Customer Creation

## Overview

When a customer submits a form on your storefront, the system automatically creates a Shopify customer with the submitted data.

## How It Works

### 1. Customer Fills Out Form
- Customer enters their information in the form fields
- Form must include an **Email** field (required for customer creation)
- Optionally: First Name, Last Name, Phone fields

### 2. Form Submission
- When submitted, the form sends data to `/apps/form/submit`
- Includes:
  - Form code
  - Shop domain
  - All form field values

### 3. Customer Creation
The backend (`apps.form.submit.tsx`):
- Validates the form code and shop
- Extracts customer data from form fields
- Uses Shopify GraphQL Admin API to create customer
- Tags the customer with `form-{code}` and `form-submission`

### 4. Response
- Success: Customer created in Shopify
- Customer receives confirmation message
- Form resets for next submission

## Field Mapping

The system looks for these field labels to create customers:

| Field Label          | Shopify Customer Field | Required |
|---------------------|------------------------|----------|
| Email               | email                  | ✅ Yes    |
| First Name or Name  | firstName              | No       |
| Last Name           | lastName               | No       |
| Phone               | phone                  | No       |

**Example:**
If your form has fields labeled:
- "Email" → Maps to customer email
- "First Name" → Maps to customer firstName  
- "Phone" → Maps to customer phone

## Creating a Customer Registration Form

### Step 1: Create the Form in Admin

1. Go to `/app/form/new`
2. Add these fields:
   - **Email** (text/email field, required)
   - **First Name** (text field)
   - **Last Name** (text field)
   - **Phone** (phone field, optional)
3. Save the form
4. Note the 5-digit code

### Step 2: Add to Your Theme

1. Open Shopify theme editor
2. Add "Custom Form" block to a page
3. Enter the 5-digit form code
4. Save and publish

### Step 3: Test It

1. Fill out the form on your storefront
2. Submit the form
3. Check Shopify Admin → Customers
4. New customer should appear with tags: `form-{code}`, `form-submission`

## API Endpoints

### Get Form Data
```
GET /apps/form/{code}
```
Returns form configuration and fields

### Submit Form
```
POST /apps/form/submit
```
**Body Parameters:**
- `formCode` - 5-digit form code
- `shop` - Shop domain
- `{field-id}` - Values for each form field

**Response:**
```json
{
  "success": true,
  "message": "Form submitted successfully and customer created!",
  "customer": {
    "id": "gid://shopify/Customer/...",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  },
  "submissionData": {
    "Email": "customer@example.com",
    "First Name": "John",
    ...
  }
}
```

## Customization

### Adding Custom Customer Fields

Edit `apps.form.submit.tsx` to map additional fields:

```typescript
const customerInput = {
  email,
  firstName: firstName || undefined,
  lastName: lastName || undefined,
  phone: phone || undefined,
  note: `Created via form: ${form.title} (Code: ${code})`,
  tags: [`form-${code}`, "form-submission"],
  // Add more fields:
  // acceptsMarketing: true,
  // addresses: [{ ... }],
};
```

### Custom Success Messages

Update the form block (`form_section.liquid`):

```javascript
if (result.success) {
  // Custom success message
  container.innerHTML = '<div style="color: green;">Thank you! Check your email.</div>';
}
```

### Storing Additional Data

To store extra form data (not just customer info), you could:

1. Add a `FormSubmission` model to Prisma schema
2. Save all form data before creating customer
3. Use customer metafields for custom data

## Error Handling

### Email Required
If no email field is submitted:
```json
{
  "error": "Email is required to create a customer"
}
```

### Duplicate Email
Shopify will return an error if email already exists:
```json
{
  "error": "Failed to create customer",
  "details": [
    {
      "field": "email",
      "message": "Email has already been taken"
    }
  ]
}
```

### Session Not Found
If the app isn't installed or session expired:
```json
{
  "success": true,
  "message": "Form submitted successfully (customer creation pending)",
  "note": "Shop session not found. Contact admin."
}
```

## Troubleshooting

### Customer Not Being Created

1. **Check form has Email field**
   - Label must be exactly "Email"
   - Or add custom mapping in code

2. **Check server logs**
   - Look for "🟢 Form submission received"
   - Check for error messages

3. **Verify shop session**
   - App must be installed on the shop
   - Session must have valid access token

4. **Test the endpoint directly**
   ```bash
   curl -X POST https://your-app-url.com/apps/form/submit \
     -d "formCode=12345" \
     -d "shop=your-shop.myshopify.com" \
     -d "Email=test@example.com" \
     -d "First Name=John"
   ```

### Customer Created But With Wrong Data

- Check field labels match exactly
- Review `submissionData` in console logs
- Adjust mapping in `apps.form.submit.tsx`

## Security Notes

- The submission endpoint is publicly accessible (required for storefront)
- Validates form code and shop domain
- Uses stored session for API authentication
- CORS headers allow cross-origin requests
- Consider adding rate limiting for production

## Next Steps

1. **Add form validation** - Client-side and server-side
2. **Email notifications** - Send confirmation emails
3. **Custom customer tags** - Based on form responses
4. **Analytics** - Track form submissions
5. **Admin dashboard** - View all submissions

