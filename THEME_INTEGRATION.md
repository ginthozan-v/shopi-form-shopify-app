# ShopiForm Theme Integration Guide

## ✅ Extension Deployed Successfully!

Your ShopiForm theme app extension has been deployed and is now available to merchants.

## 🎯 How Merchants Can Use Forms in Their Theme

### Method 1: Using the Snippet (Recommended)

The easiest way for merchants to add forms to their theme is by using the `shopiform-display` snippet.

#### Step 1: Create a Custom Section (One-time setup)

Merchants need to create a new section file in their theme:

**File:** `sections/shopiform-section.liquid`

```liquid
<div class="shopiform-section-wrapper">
  {% render 'shopiform-display', 
    form_id: section.settings.form_id, 
    heading: section.settings.heading, 
    description: section.settings.description 
  %}
</div>

{% schema %}
{
  "name": "ShopiForm",
  "tag": "section",
  "class": "section-shopiform",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Contact Us"
    },
    {
      "type": "textarea",
      "id": "description",
      "label": "Description",
      "info": "Optional description to display above the form"
    },
    {
      "type": "text",
      "id": "form_id",
      "label": "Form ID",
      "info": "Enter the ID of the form from your ShopiForm app dashboard"
    }
  ],
  "presets": [
    {
      "name": "ShopiForm"
    }
  ]
}
{% endschema %}
```

#### Step 2: Use the Section

1. Go to **Theme Customizer**
2. Click **"Add section"**
3. Select **"ShopiForm"**
4. Enter the **Form ID** from your ShopiForm app dashboard
5. Optionally add a heading and description
6. **Save** and **Publish**

### Method 2: Direct Snippet Usage

Merchants can also use the snippet directly in any template:

```liquid
{% render 'shopiform-display', 
  form_id: 'your-form-id-here', 
  heading: 'Contact Us', 
  description: 'Get in touch with us!' 
%}
```

## 📋 Instructions for Merchants

### Getting the Form ID

1. Open your **ShopiForm app**
2. Go to the **Forms** list
3. Find your form and copy the **Form ID** shown below the form name
4. Paste this ID into the theme customizer

### Adding Forms to Pages

1. **Theme Customizer** → **Add Section** → **ShopiForm**
2. **Page Templates** → Add the snippet directly
3. **Product Pages** → Use in product description templates
4. **Blog Posts** → Add to article templates

## 🎨 Customization

The forms automatically inherit your theme's styling, but you can customize them further by adding CSS to your theme:

```css
.shopiform-wrapper {
  /* Custom container styling */
}

.shopiform-form {
  /* Custom form styling */
}

.shopiform-submit-btn {
  /* Custom button styling */
}
```

## 🔧 Technical Details

- ✅ **Automatic Loading**: Forms load dynamically from your app
- ✅ **Responsive Design**: Works on all devices
- ✅ **Form Validation**: Client-side and server-side validation
- ✅ **Submission Handling**: Data is captured and processed
- ✅ **Error Handling**: Graceful error messages for users

## 🚀 Next Steps

1. Create forms in your ShopiForm app
2. Copy the Form ID
3. Add the section to your theme
4. Test the form submission
5. Customize styling as needed

Your forms are now ready to capture leads and engage customers directly on your storefront!
