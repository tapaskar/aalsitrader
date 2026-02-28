import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, BarChart2, MessageSquare,
         TrendingUp, Search, Zap, CheckCircle, Bot } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface Step {
  icon: React.ReactNode;
  color: string;           // Tailwind text color class
  borderColor: string;     // Tailwind border color class
  bgColor: string;         // Tailwind bg color class
  label: string;           // Small tag above title
  title: string;
  description: string;
  hint: string;            // Where to look on screen
}

const STEPS: Step[] = [
  {
    icon: <Sparkles className="w-8 h-8" />,
    color: 'text-accent',
    borderColor: 'border-accent/30',
    bgColor: 'bg-accent/10',
    label: 'Welcome',
    title: 'Meet your AI Trading Squad',
    description:
      'Aalsi Trader runs 6 AI agents 24/7 — they read news, scan charts, check macro, manage risk, and make trade decisions while you focus on other things.',
    hint: '🎉 Your 7-day trial is active. Everything is free to explore.',
  },
  {
    icon: <Bot className="w-8 h-8" />,
    color: 'text-sigma',
    borderColor: 'border-sigma/30',
    bgColor: 'bg-sigma/10',
    label: 'Left Panel',
    title: 'The 6 Agents sidebar',
    description:
      'On the left you\'ll see your squad: Alpha (news), Beta (breakouts), Gamma (risk), Theta (macro), Delta (journal), and Sigma/Prime (makes the final call). Click any agent to see their detailed analysis.',
    hint: '👈 Look at the left sidebar — green dot means the agent is active right now.',
  },
  {
    icon: <BarChart2 className="w-8 h-8" />,
    color: 'text-beta',
    borderColor: 'border-beta/30',
    bgColor: 'bg-beta/10',
    label: 'Center Panel',
    title: 'Activity Feed — your mission control',
    description:
      'Every analysis, signal, breakout alert, and trade decision appears here in real time. Filter by agent or type (alerts, trades, info). Click any card for the full analysis.',
    hint: '📡 Updates every 15 min during market hours. New items glow at the top.',
  },
  {
    icon: <MessageSquare className="w-8 h-8" />,
    color: 'text-alpha',
    borderColor: 'border-alpha/30',
    bgColor: 'bg-alpha/10',
    label: 'Right Panel',
    title: 'Comm Panel — agents talking to each other',
    description:
      'Watch the squad deliberate in real time. When Gamma spots risk, it messages Prime. When Theta sees a macro shift, it warns the group. This is how your AI team coordinates.',
    hint: '👉 Look at the right panel — this is the inter-agent messaging feed.',
  },
  {
    icon: <TrendingUp className="w-8 h-8" />,
    color: 'text-delta',
    borderColor: 'border-delta/30',
    bgColor: 'bg-delta/10',
    label: 'Paper Trading',
    title: 'Paper Trading — trade without risk',
    description:
      'Prime auto-executes paper trades in your virtual ₹10,00,000 portfolio every 15 minutes. Enable Auto-Trading in the Paper Trading panel to let Prime trade for you. Track your P&L, win rate, and equity curve.',
    hint: '💹 Tap "Paper Trading" in the top navigation to open your portfolio.',
  },
  {
    icon: <Search className="w-8 h-8" />,
    color: 'text-theta',
    borderColor: 'border-theta/30',
    bgColor: 'bg-theta/10',
    label: 'Screener',
    title: 'Smart Money Screener',
    description:
      'Scans 97+ Nifty 50 stocks every 15 min for BOS (Break of Structure) and CHOCH (Change of Character) signals — the same patterns institutional traders use. Results feed directly into Prime\'s decisions.',
    hint: '🔍 Tap "Screener" in the top navigation to see live breakout setups.',
  },
  {
    icon: <Zap className="w-8 h-8" />,
    color: 'text-gamma',
    borderColor: 'border-gamma/30',
    bgColor: 'bg-gamma/10',
    label: 'Go Live',
    title: 'Connect your broker when ready',
    description:
      'Paper trading is active by default — no broker needed. When you\'re confident, connect Zerodha, Dhan, Angel One, or Upstox in your Profile to switch to live trading. Your AI squad executes orders automatically.',
    hint: '⚙️ Profile → Broker Setup (top-right menu). Live trading is off by default.',
  },
  {
    icon: <CheckCircle className="w-8 h-8" />,
    color: 'text-sigma',
    borderColor: 'border-sigma/30',
    bgColor: 'bg-sigma/10',
    label: "You're set!",
    title: "Prime is already watching the markets",
    description:
      'The squad scans every 15 minutes during market hours (9:15 AM – 3:30 PM IST). You\'ll see activities populate automatically. Come back after market open to see your first signals.',
    hint: '🚀 Close this guide and watch the activity feed — it\'s already running.',
  },
];

export function OnboardingGuide() {
  const { completeOnboarding, user } = useAuthStore();
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className={`bg-card border ${current.borderColor} rounded-2xl w-full max-w-lg shadow-2xl flex flex-col`}
           style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Getting Started
            </span>
            <span className="text-xs text-muted-foreground">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <button
            onClick={completeOnboarding}
            className="p-1.5 rounded-lg hover:bg-card-hover text-muted-foreground hover:text-white transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-border mx-0">
          <div
            className={`h-full ${current.bgColor.replace('bg-', 'bg-').replace('/10', '/60')} transition-all duration-300`}
            style={{ width: `${progress}%`, background: 'var(--tw-gradient-stops)' }}
          />
        </div>
        {/* Simple colored progress */}
        <div className="h-0.5 bg-border relative overflow-hidden -mt-0.5">
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-500 ${current.color.replace('text-', 'bg-')}`}
            style={{ width: `${progress}%`, opacity: 0.7 }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Icon + label */}
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl ${current.bgColor} border ${current.borderColor} flex items-center justify-center ${current.color} flex-shrink-0`}>
              {current.icon}
            </div>
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${current.color} opacity-80`}>
                {current.label}
              </span>
              <h2 className="text-xl font-bold text-white leading-tight mt-0.5">
                {current.title}
              </h2>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>

          {/* Hint pill */}
          <div className={`rounded-lg px-4 py-3 ${current.bgColor} border ${current.borderColor}`}>
            <p className={`text-sm ${current.color} font-medium`}>
              {current.hint}
            </p>
          </div>

          {/* Welcome step: show user's plan info */}
          {step === 0 && user && (
            <div className="rounded-lg border border-border bg-card-hover px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-semibold text-white">{user.username}</p>
              {user.trialEndsAt && (
                <p className="text-xs text-accent">
                  Trial ends {new Date(user.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 py-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-200 ${
                i === step
                  ? `w-5 h-2 ${current.color.replace('text-', 'bg-')}`
                  : i < step
                    ? `w-2 h-2 ${current.color.replace('text-', 'bg-')} opacity-40`
                    : 'w-2 h-2 bg-border'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-1 gap-3">
          <button
            onClick={completeOnboarding}
            className="text-xs text-muted-foreground hover:text-white transition-colors underline underline-offset-2"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card-hover hover:bg-card-hover/80 text-sm font-medium text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={completeOnboarding}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-lg ${current.bgColor} border ${current.borderColor} hover:opacity-90`}
              >
                <CheckCircle className="w-4 h-4" />
                Let's go!
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all bg-accent/20 border border-accent/30 hover:bg-accent/30"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
