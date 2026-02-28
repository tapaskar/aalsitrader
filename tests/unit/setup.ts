import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
    setTimeout(() => this.onopen?.(), 0);
  }
  
  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  
  send(data: string) {
    // Mock implementation
  }
  
  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }
} as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
