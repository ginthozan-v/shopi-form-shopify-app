#!/usr/bin/env node

import { execSync } from 'child_process';

async function setupDatabase() {
  console.log('🔄 Setting up database...');
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not found, skipping database setup');
      return;
    }
    
    console.log('📊 Running database push...');
    execSync('prisma db push --accept-data-loss', { stdio: 'inherit' });
    
    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    // Don't fail the build, just log the error
    console.log('⚠️  Continuing without database setup...');
  }
}

setupDatabase();
