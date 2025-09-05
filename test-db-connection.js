import { PrismaClient } from '@prisma/client';

async function testConnection() {
  console.log('🔗 Testing database connection...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    // Test the connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('📊 Database version:', result[0].version);
    
    console.log('🎯 Ready to run migrations!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 Check your DATABASE_URL environment variable');
    }
    if (error.message.includes('authentication')) {
      console.log('💡 Check your database credentials');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
