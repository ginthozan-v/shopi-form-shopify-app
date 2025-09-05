#!/usr/bin/env node

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

async function setupProductionDatabase() {
  console.log('🚀 Setting up production database...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('💡 Set your DATABASE_URL and run this script again');
    process.exit(1);
  }
  
  console.log('📊 DATABASE_URL is set');
  
  try {
    // Generate Prisma client
    console.log('🔄 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Push database schema
    console.log('🔄 Pushing database schema...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    
    // Test connection
    console.log('🔄 Testing database connection...');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('📊 Database version:', result[0]?.version || 'Unknown');
    
    // Check tables
    try {
      const sessionCount = await prisma.session.count();
      const formCount = await prisma.form.count();
      console.log(`📋 Tables verified - Sessions: ${sessionCount}, Forms: ${formCount}`);
    } catch (error) {
      console.log('⚠️ Tables might not be fully created yet, but schema push completed');
    }
    
    await prisma.$disconnect();
    
    console.log('✅ Production database setup complete!');
    console.log('🎉 Your app should now work on Vercel');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupProductionDatabase();
