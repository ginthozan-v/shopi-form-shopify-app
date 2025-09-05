# Vercel Deployment Guide

## 🚀 Deploy to Vercel

### Prerequisites

1. **Database**: Set up a PostgreSQL database (recommended: Supabase, PlanetScale, or Vercel Postgres)
2. **Shopify App**: Have your Shopify app credentials ready

### Step 1: Database Setup

For production, you need a PostgreSQL database. Here are some options:

#### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Create a new Postgres database
3. Copy the `DATABASE_URL` from the connection string

#### Option B: Supabase (Free tier available)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string

#### Option C: PlanetScale
1. Go to [planetscale.com](https://planetscale.com)
2. Create a new database
3. Copy the connection string

### Step 2: Environment Variables

In your Vercel dashboard, set these environment variables:

```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_SCOPES=write_products,read_customer_events
SHOPIFY_APP_URL=https://your-app-name.vercel.app
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here

# Database
DATABASE_URL=postgresql://username:password@hostname:port/database

# Session
SHOPIFY_SESSION_SECRET=your_session_secret_here

# Environment
NODE_ENV=production
```

### Step 3: Deploy

1. **Push your code** to GitHub
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect it as a Node.js project
3. **Set environment variables** in Vercel dashboard
4. **Deploy**

### Step 4: Update Shopify App URLs

After deployment, update your Shopify app settings:

1. Go to your Shopify Partners dashboard
2. Edit your app
3. Update **App URL** to: `https://your-app-name.vercel.app`
4. Update **Allowed redirection URLs** to: `https://your-app-name.vercel.app/auth/callback`

## 🔧 Configuration Changes Made

### Database Configuration
- ✅ **Prisma Schema**: Updated to use PostgreSQL for production
- ✅ **Database Client**: Configured to use SQLite for dev, PostgreSQL for prod
- ✅ **Dependencies**: Added `pg` and `@types/pg` for PostgreSQL support

### Vercel Configuration
- ✅ **vercel.json**: Added proper Remix configuration
- ✅ **Build Command**: Includes database setup (`prisma db push`)
- ✅ **Runtime**: Set to Node.js 18.x
- ✅ **Max Duration**: Set to 30 seconds for database operations

### Scripts
- ✅ **Setup Script**: Uses `prisma db push` for production deployment
- ✅ **Build Process**: Includes database generation and migration

## 🐛 Troubleshooting

### Common Issues

1. **FUNCTION_INVOCATION_FAILED**
   - Check environment variables are set correctly
   - Verify DATABASE_URL is valid
   - Check Vercel function logs

2. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check database credentials
   - Ensure database is accessible from Vercel

3. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Check Prisma schema syntax

### Checking Logs

1. Go to Vercel dashboard
2. Click on your deployment
3. Go to "Functions" tab
4. Click on the failed function to see logs

## 📝 Next Steps

After successful deployment:

1. ✅ Test the app in Shopify admin
2. ✅ Create some forms to verify functionality
3. ✅ Test the theme extension in a development store
4. ✅ Monitor Vercel function logs for any issues

Your ShopiForm app should now be running smoothly on Vercel! 🎉
