# Testing Suite

Comprehensive testing for the Trading Squad Dashboard.

## Structure

```
tests/
├── unit/                   # Unit tests
│   ├── store.test.ts      # State management tests
│   ├── components.test.tsx # React component tests
│   └── setup.ts           # Test setup & mocks
├── integration/           # Integration tests
│   ├── api.test.ts       # API & WebSocket tests
│   └── setup.ts          # Integration setup
├── package.json
├── vitest.unit.config.ts
└── vitest.integration.config.ts
```

## Running Tests

### Unit Tests

```bash
cd tests
npm install
npm run test:unit

# With coverage
npm run test:coverage

# With UI
npm run test:ui
```

### Integration Tests

```bash
# Start services first
docker-compose up -d

# Run tests
npm run test:integration
```

### All Tests

```bash
npm test
```

## What's Tested

### Unit Tests

- ✅ Store state management (Zustand)
- ✅ Activity filtering and sorting
- ✅ Trade CRUD operations
- ✅ Stats calculations (win rate, P&L)
- ✅ Agent status updates

### Integration Tests

- ✅ DynamoDB connectivity
- ✅ WebSocket connectivity
- ✅ Message broadcasting
- ✅ HTTP API endpoints
- ✅ Trade creation & retrieval

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardStore } from '@/store/dashboardStore';

describe('Agent Status', () => {
  it('should update agent status', () => {
    const { result } = renderHook(() => useDashboardStore());
    
    act(() => {
      result.current.updateAgentStatus('alpha', 'active', 'Testing');
    });
    
    const agent = result.current.agents.find(a => a.id === 'alpha');
    expect(agent?.status).toBe('active');
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('WebSocket', () => {
  it('should broadcast activity', async () => {
    const ws = new WebSocket('ws://localhost:3001');
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    ws.send(JSON.stringify({
      action: 'agentActivity',
      activity: { /* ... */ }
    }));
    
    // Assert broadcast received
  });
});
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Before deployment to staging/production

See `.github/workflows/cicd.yml` for details.
