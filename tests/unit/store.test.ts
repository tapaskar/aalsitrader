import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardStore } from '@/store/dashboardStore';

describe('Dashboard Store', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useDashboardStore());
    act(() => {
      result.current.activities = [];
      result.current.trades = [];
      result.current.comms = [];
    });
  });

  it('should add activity', () => {
    const { result } = renderHook(() => useDashboardStore());
    
    act(() => {
      result.current.addActivity({
        agentId: 'alpha',
        agentName: 'Alpha',
        agentGreek: 'α',
        agentColor: '#ff6b6b',
        type: 'info',
        content: 'Test activity',
        tags: ['Test'],
      });
    });
    
    expect(result.current.activities).toHaveLength(1);
    expect(result.current.activities[0].content).toBe('Test activity');
  });

  it('should update agent status', () => {
    const { result } = renderHook(() => useDashboardStore());
    
    act(() => {
      result.current.updateAgentStatus('alpha', 'active', 'Testing');
    });
    
    const agent = result.current.agents.find(a => a.id === 'alpha');
    expect(agent?.status).toBe('active');
    expect(agent?.currentTask).toBe('Testing');
  });

  it('should add and update trade', () => {
    const { result } = renderHook(() => useDashboardStore());
    
    act(() => {
      result.current.addTrade({
        symbol: 'TEST',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        target: 120,
        setupType: 'Test',
        agentId: 'sigma',
        status: 'open',
        grade: 'A',
      });
    });
    
    expect(result.current.trades).toHaveLength(1);
    
    const tradeId = result.current.trades[0].id;
    
    act(() => {
      result.current.updateTrade(tradeId, {
        status: 'closed',
        exitPrice: 120,
        pnl: 20,
        pnlPercent: 20,
      });
    });
    
    const trade = result.current.trades.find(t => t.id === tradeId);
    expect(trade?.status).toBe('closed');
    expect(trade?.pnl).toBe(20);
  });

  it('should calculate stats correctly', () => {
    const { result } = renderHook(() => useDashboardStore());
    
    // Add winning trade
    act(() => {
      result.current.addTrade({
        symbol: 'WIN',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        target: 120,
        status: 'closed',
        exitPrice: 110,
        pnl: 10,
        pnlPercent: 10,
        setupType: 'Test',
        agentId: 'sigma',
        grade: 'A',
      });
    });
    
    // Add losing trade
    act(() => {
      result.current.addTrade({
        symbol: 'LOSS',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        target: 120,
        status: 'closed',
        exitPrice: 95,
        pnl: -5,
        pnlPercent: -5,
        setupType: 'Test',
        agentId: 'sigma',
        grade: 'C',
      });
    });
    
    expect(result.current.stats.totalTrades).toBe(2);
    expect(result.current.stats.winRate).toBe(50);
    expect(result.current.stats.totalPnl).toBe(5);
  });

  it('should filter activities by agent', () => {
    const { result } = renderHook(() => useDashboardStore());
    
    act(() => {
      result.current.addActivity({
        agentId: 'alpha',
        agentName: 'Alpha',
        agentGreek: 'α',
        agentColor: '#ff6b6b',
        type: 'info',
        content: 'Alpha activity',
        tags: [],
      });
      result.current.addActivity({
        agentId: 'beta',
        agentName: 'Beta',
        agentGreek: 'β',
        agentColor: '#4ecdc4',
        type: 'info',
        content: 'Beta activity',
        tags: [],
      });
    });
    
    act(() => {
      result.current.setFilter('alpha');
    });
    
    const filtered = result.current.filteredActivities();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].agentId).toBe('alpha');
  });
});
