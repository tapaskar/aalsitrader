import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useDashboardStore } from '../store/dashboardStore';
import type { SigmaApprovalItem } from '../types';

const sounds = {
  alert: new Howl({
    src: ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVanu87plHQUuh9Dz2YU2Bhxqv+zplkcODVGm5O+4ZSAEMYrO89GFNwYdcfDr4ZdJDQtPp+XysWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAAAAA='],
    volume: 0.5,
  }),
  success: new Howl({
    src: ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVanu87plHQUuh9Dz2YU2Bhxqv+zplkcODVGm5O+4ZSAEMYrO89GFNwYdcfDr4ZdJDQtPp+XysWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAAAAA='],
    volume: 0.4,
  }),
  notification: new Howl({
    src: ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVanu87plHQUuh9Dz2YU2Bhxqv+zplkcODVGm5O+4ZSAEMYrO89GFNwYdcfDr4ZdJDQtPp+XysWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAFNo/M89CEMwYdcfDr4plHDAtQp+TwxWUeBjiOz/PShjYGH3Dw6+OZSA0MTqXl8bllHwU2jc7zzYU1Bhxwv+zmmUgNC1Ko5vO4ZSAAAAA='],
    volume: 0.3,
  }),
};

export function useSound() {
  const { soundEnabled } = useDashboardStore();
  const lastPlayed = useRef<Record<string, number>>({});

  const play = (soundName: keyof typeof sounds, throttleMs = 1000) => {
    if (!soundEnabled) return;
    
    const now = Date.now();
    const last = lastPlayed.current[soundName] || 0;
    
    if (now - last > throttleMs) {
      sounds[soundName].play();
      lastPlayed.current[soundName] = now;
    }
  };

  return {
    playAlert: () => play('alert'),
    playSuccess: () => play('success'),
    playNotification: () => play('notification', 500),
  };
}

export function useWebSocket() {
  const { 
    setWsConnected, 
    addActivity, 
    addComm, 
    updateAgentStatus, 
    addTrade,
    addPaperTrade,
    updatePaperTrade,
    closePaperTrade,
    setPaperPortfolio,
    setPendingApprovals,
    addPendingApproval,
    paperMode,
  } = useDashboardStore();
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const connect = () => {
      const wsUrl = import.meta.env.VITE_WS_URL || 'wss://your-api.execute-api.region.amazonaws.com/prod';
      
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'agentActivity':
            addActivity(data.activity);
            break;
          case 'agentStatusChange':
            updateAgentStatus(data.agentId, data.status, data.currentTask);
            break;
          case 'commMessage':
            addComm(data.comm);
            break;
          case 'tradeUpdate':
            if (data.trade.action === 'new') {
              addTrade(data.trade);
            }
            break;
          // Paper Trading Events
          case 'paperTradeOpen':
            addPaperTrade(data.trade);
            // Play sound for new paper trade
            break;
          case 'paperTradeClose':
            closePaperTrade(data.trade);
            // Play sound for closed trade
            break;
          case 'paperPortfolioUpdate':
            setPaperPortfolio(data.portfolio);
            break;
          case 'paperSignalGenerated':
            // Signal will be shown in activity feed, approvals fetched via API
            break;
        }
      };
      
      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Reconnect after 5 seconds
        reconnectTimeout.current = setTimeout(connect, 5000);
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      ws.current?.close();
    };
  }, [setWsConnected, addActivity, addComm, updateAgentStatus, addTrade, addPaperTrade, updatePaperTrade, closePaperTrade, setPaperPortfolio, setPendingApprovals, addPendingApproval, paperMode]);

  return { ws: ws.current };
}

export function useTimeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
