# Testing the App Proxy

## Step 1: Create a test form
1. Go to your app admin: `/app/form/new`
2. Create a form with some fields
3. Save it and note the 5-digit code (e.g., `12345`)

## Step 2: Test the proxy endpoint directly

Open your browser or use curl:
```bash
# Replace YOUR_PORT with your dev server port (check terminal)
# Replace 12345 with your actual form code
curl http://localhost:YOUR_PORT/apps/form/12345
```

You should see JSON output like:
```json
{
  "id": 1,
  "code": "12345",
  "title": "Your Form Title",
  "description": "Description",
  "fields": [...]
}
```

## Step 3: Check server logs

Look in your dev server terminal for:
```
App Proxy request received for code: 12345
Request URL: http://...
```

## Step 4: Configure App Proxy for Production

### In Shopify Partner Dashboard:
1. Go to your app settings
2. Navigate to **App Proxy** section
3. Configure:
   - **Subpath prefix**: `apps`
   - **Subpath**: `form`
   - **Proxy URL**: `https://your-app-url.com/apps/form`

### Important Notes:
- The app proxy only works on **live stores** or **development stores**
- It does NOT work on `localhost` when testing through Shopify theme
- During development, you may need to use the direct app URL instead

## Troubleshooting

### Error: "Form not found"
- Check that the form code is correct
- Verify the form exists in database: Check your admin panel

### Error: "Error loading form"
- Check browser console for the actual error
- Verify the proxy URL is correct
- Check CORS headers (already added)
- Ensure dev server is running

### Testing without App Proxy

Update the extension to use direct URL during development:

In `extensions/form/sections/custom_form.liquid`, change:
```javascript
fetch('/apps/form/' + formCode)
```

To (temporarily):
```javascript
fetch('https://your-cloudflare-url.trycloudflare.com/apps/form/' + formCode)
```

Don't forget to change it back before deploying!

