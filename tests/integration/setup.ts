// Integration test setup
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Check if services are running
  console.log('Setting up integration tests...');
  
  // Wait for services to be ready
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // Check DynamoDB
      await fetch(process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000');
      
      // Check HTTP API
      const response = await fetch(process.env.API_URL || 'http://localhost:3000/trades');
      if (response.status === 200) {
        console.log('✅ Services are ready');
        break;
      }
    } catch (error) {
      attempts++;
      console.log(`Waiting for services... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (attempts >= maxAttempts) {
    console.warn('⚠️  Some services may not be ready. Tests might fail.');
  }
});

afterAll(() => {
  console.log('Integration tests complete');
});
