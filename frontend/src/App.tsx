import { useEffect, useState } from 'react';
import { useDashboardStore } from './store/dashboardStore';
import { useAuthStore } from './store/authStore';
import { useWebSocket, useSound } from './hooks';
import { Header } from './components/Header';
import { AgentSidebar } from './components/AgentSidebar';
import { ActivityFeed } from './components/ActivityFeed';
import { CommPanel } from './components/CommPanel';
import { AgentModal } from './components/AgentModal';

import { PaperTradingPanel } from './components/PaperTradingPanel';
import { SmartMoneyScreener } from './components/SmartMoneyScreener';
import { NiftyStraddlePanel } from './components/NiftyStraddlePanel';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { AdminPage } from './components/AdminPage';
import { UnsubscribePage } from './components/UnsubscribePage';
import { OnboardingGuide } from './components/OnboardingGuide';
import './App.css';

function App() {
  const {
    wsConnected,
    agents,
    selectedAgent,
    setSelectedAgent,
    soundEnabled,
    toggleSound,
    addActivity,
    addComm,
    updateAgentStatus,
    paperTrades,
    paperMode,
  } = useDashboardStore();

  const { isAuthenticated, user, fetchProfile, onboardingCompleted } = useAuthStore();

  const [activeView, setActiveView] = useState<'dashboard' | 'paper-trading' | 'screener' | 'nifty-straddle' | 'admin'>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  
  const { playNotification, playAlert } = useSound();
  
  // Connect WebSocket
  useWebSocket();

  // Refresh user profile on mount (picks up credential changes made outside this session)
  useEffect(() => {
    if (isAuthenticated) fetchProfile();
  }, [isAuthenticated]);

  // Fetch real activities and comms from API on load and periodically
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';
    const fetchData = async () => {
      try {
        const [activitiesRes, commsRes] = await Promise.all([
          fetch(`${API_URL}/activities`),
          fetch(`${API_URL}/comms`),
        ]);
        if (activitiesRes.ok) {
          const data = await activitiesRes.json();
          (data.activities || []).forEach((a: any) => addActivity(a));
        }
        if (commsRes.ok) {
          const data = await commsRes.json();
          (data.comms || []).forEach((c: any) => addComm(c));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [addActivity, addComm]);

  // Handle /unsubscribe route (works without auth)
  if (window.location.pathname === '/unsubscribe') {
    return <UnsubscribePage />;
  }

  // Show landing page when not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <LandingPage
          onSignIn={() => { setAuthInitialMode('login'); setShowAuthModal(true); }}
          onStartTrial={() => { setAuthInitialMode('register'); setShowAuthModal(true); }}
        />
        {showAuthModal && (
          <AuthModal
            initialMode={authInitialMode}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white font-sans">
      <Header
        wsConnected={wsConnected}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      
      {/* Trial Expiry / Plan Banner */}
      {user?.planStatus === 'trial' && user.trialEndsAt && (() => {
        const daysLeft = Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const upgradeLink = `https://aalsitrader.lemonsqueezy.com/checkout/buy/a7780a5a-9a8f-42dc-a742-815a1476f3b1?checkout[email]=${encodeURIComponent(user.email)}`;
        if (daysLeft <= 3 && daysLeft > 0) {
          return (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-400">
              Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.{' '}
              <a href={upgradeLink} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-300">Subscribe now</a>
            </div>
          );
        }
        if (daysLeft <= 0) {
          return (
            <div className="bg-danger/10 border-b border-danger/30 px-4 py-2 text-center text-sm text-danger">
              Your free trial has expired.{' '}
              <a href={upgradeLink} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-red-300">Subscribe to continue</a>
            </div>
          );
        }
        return null;
      })()}
      {(user?.planStatus === 'expired' || user?.planStatus === 'cancelled') && (
        <div className="bg-danger/10 border-b border-danger/30 px-4 py-2 text-center text-sm text-danger">
          Your subscription has {user.planStatus}.{' '}
          <a href={`https://aalsitrader.lemonsqueezy.com/checkout/buy/a7780a5a-9a8f-42dc-a742-815a1476f3b1?checkout[email]=${encodeURIComponent(user.email)}`} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-red-300">Resubscribe</a>
        </div>
      )}

      <main className="p-4 md:p-6">
        <div className="max-w-[1920px] mx-auto">
          {activeView === 'dashboard' ? (
            /* Dashboard View */
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_380px] gap-4 md:gap-6" style={{ height: 'calc(100vh - 120px)' }}>

              {/* Left: Agent Sidebar */}
              <div className="flex flex-col overflow-hidden">
                <AgentSidebar
                  agents={agents}
                  onSelectAgent={setSelectedAgent}
                  paperTrades={paperTrades}
                  paperMode={paperMode}
                />
              </div>

              {/* Center: Activity Feed - fixed height with scroll */}
              <div className="flex flex-col overflow-hidden">
                <ActivityFeed />
              </div>

              {/* Right: Comm Panel - fixed height with scroll */}
              <div className="flex flex-col overflow-hidden">
                <CommPanel />
              </div>
            </div>
          ) : activeView === 'paper-trading' ? (
            /* Paper Trading View */
            <PaperTradingPanel />
          ) : activeView === 'screener' ? (
            /* Smart Money Screener View */
            <SmartMoneyScreener />
          ) : activeView === 'admin' ? (
            /* Admin View */
            <AdminPage />
          ) : (
            /* Nifty Scalper View */
            <NiftyStraddlePanel />
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedAgent && activeView === 'dashboard' && (
        <AgentModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Onboarding guide — shown to new users until they complete or skip it */}
      {isAuthenticated && !onboardingCompleted && (
        <OnboardingGuide />
      )}
      
    </div>
  );
}

export default App;
