# Deploying ShopiForm to Vercel

## ⚠️ Important: Database Migration Required

**SQLite doesn't work on Vercel** because Vercel's filesystem is read-only. You need to migrate to a cloud database.

### Recommended Options:

1. **Vercel Postgres** (Easiest)
   - Built into Vercel
   - Automatic setup
   - Good free tier

2. **Neon** (Recommended)
   - Serverless Postgres
   - Generous free tier
   - Fast cold starts

3. **Supabase**
   - Postgres with extras
   - Good free tier
   - Additional features

## Steps to Deploy

### 1. Set Up Database

#### Option A: Vercel Postgres
```bash
# In your Vercel dashboard:
# 1. Go to Storage tab
# 2. Create Postgres Database
# 3. Copy the DATABASE_URL
```

#### Option B: Neon
```bash
# 1. Go to https://neon.tech
# 2. Create free account
# 3. Create new project
# 4. Copy connection string
```

### 2. Update Prisma Schema

Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Changed from sqlite
  url      = env("DATABASE_URL")
}
```

### 3. Set Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables:

```env
# Database
DATABASE_URL=your_postgres_connection_string

# Shopify App (from shopify.app.toml or Shopify Partner Dashboard)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=write_products,write_customers,write_companies

# App URLs (update after first deploy)
SHOPIFY_APP_URL=https://your-app.vercel.app
HOST=your-app.vercel.app
```

### 4. Update package.json Build Script

Your current scripts are fine, but make sure you have:

```json
{
  "scripts": {
    "build": "prisma generate && remix vite:build",
    "start": "remix-serve ./build/server/index.js"
  }
}
```

### 5. Deploy to Vercel

#### Via Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel
```

#### Via GitHub:
1. Push your code to GitHub
2. Go to https://vercel.com
3. Import your repository
4. Add environment variables
5. Deploy!

### 6. Update Shopify App URLs

After deployment, update your `shopify.app.toml`:

```toml
application_url = "https://your-app.vercel.app"

[webhooks]
api_version = "2025-01"

[auth]
redirect_urls = [
  "https://your-app.vercel.app/auth/callback"
]

[app_proxy]
url = "https://your-app.vercel.app"
subpath = "apps"
prefix = "apps"
```

### 7. Run Database Migrations

After first deploy, run migrations:

```bash
# Install Vercel CLI if not already
npm i -g vercel

# Link your project
vercel link

# Run migrations in production
vercel env pull .env.production
npx prisma migrate deploy
```

## Important Notes

### Session Storage
Your app uses Prisma for session storage, which is good - it will work with Postgres!

### File Upload Limitations
Vercel has a 4.5MB request body limit. If you plan to handle file uploads, consider:
- Using Shopify's file API
- Direct uploads to S3/Cloudflare R2

### Serverless Limitations
- Max execution time: 10s (Hobby), 60s (Pro), 300s (Enterprise)
- Cold starts: ~1-2 seconds
- Read-only filesystem

## Testing Locally with Postgres

Before deploying, test locally:

```bash
# 1. Update .env with Postgres URL
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# 2. Reset database
npx prisma migrate reset

# 3. Test app
npm run dev
```

## Troubleshooting

### Build Fails
- Check environment variables are set
- Ensure DATABASE_URL is correct
- Check Node version matches (18, 20, or 21+)

### Database Connection Issues
- Verify DATABASE_URL format
- Check IP allowlist (Neon/Supabase)
- Enable SSL: `?sslmode=require`

### App Doesn't Load in Shopify
- Update application_url in shopify.app.toml
- Redeploy extensions: `shopify app deploy`
- Check CORS settings

## Production Checklist

- [ ] Database migrated to Postgres
- [ ] All environment variables set in Vercel
- [ ] Shopify app URLs updated
- [ ] Database migrations run
- [ ] Extensions deployed
- [ ] Test form submission
- [ ] Test customer creation
- [ ] Test company creation

## Need Help?

Common issues and solutions at: https://vercel.com/docs/frameworks/remix

