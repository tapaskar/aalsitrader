import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Shield, BarChart3, Bot, ArrowRight, Check, Newspaper, Activity, ShieldAlert, Globe, Crown, BookMarked, Cable, UserPlus, Rocket, Mail, ChevronRight, Target, Zap } from 'lucide-react';
import { Logo } from './Logo';

interface LandingPageProps {
  onSignIn: () => void;
  onStartTrial: () => void;
}

const pricingTiers = [
  {
    name: 'Starter',
    price: 999,
    period: '/month',
    features: [
      'AI Trader (paper mode)',
      '6 AI trading agents',
      'Smart Money Screener',
      'Real-time market data',
      'Trade history & analytics',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
    checkoutUrl: '',
  },
  {
    name: 'Pro',
    price: 1999,
    period: '/month',
    features: [
      'Everything in Starter',
      'Nifty Scalper engine',
      'Live trading with real money',
      'Multi-broker support',
      'F&O futures orders',
      'Priority support',
    ],
    cta: 'Subscribe',
    highlighted: true,
    checkoutUrl: 'https://aalsitrader.lemonsqueezy.com/checkout/buy/a7780a5a-9a8f-42dc-a742-815a1476f3b1',
  },
  {
    name: 'Premium',
    price: 3999,
    period: '/month',
    features: [
      'Everything in Pro',
      'Unlimited live trades',
      'Custom trading rules',
      'Advanced risk controls',
      'Priority execution',
      'Dedicated support',
    ],
    cta: 'Subscribe',
    highlighted: false,
    checkoutUrl: 'https://aalsitrader.lemonsqueezy.com/checkout/buy/c1dcc0fc-3418-4013-a25b-7950bd3e252d',
  },
];

const squadMembers = [
  {
    name: 'Professor',
    role: 'Research Agent',
    icon: Newspaper,
    gradient: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/20',
    accent: 'text-rose-400',
    accentBg: 'bg-rose-500',
    tagBg: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    description: 'Scans news sources and market headlines, analyzes earnings reports and market-moving events. Spots opportunities before the crowd.',
    tags: ['News Intel', 'Sentiment', 'Earnings'],
  },
  {
    name: 'Techno-Kid',
    role: 'Technical Analyst',
    icon: Activity,
    gradient: 'from-cyan-500 to-teal-500',
    glow: 'shadow-cyan-500/20',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500',
    tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    description: 'Runs deep technical analysis — RSI, MACD, SMA, Bollinger Bands. Generates BUY/SELL signals with multi-timeframe confirmation.',
    tags: ['Charts', 'Signals', 'Patterns'],
  },
  {
    name: 'Risko-Frisco',
    role: 'Risk Manager',
    icon: ShieldAlert,
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/20',
    accent: 'text-violet-400',
    accentBg: 'bg-violet-500',
    tagBg: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    description: 'Enforces 2% per-trade limits, 6% monthly loss caps, and 15% max position sizes. No single trade blows up your account.',
    tags: ['Stop-Loss', 'Position Size', 'Drawdown'],
  },
  {
    name: 'Macro',
    role: 'Macro Watcher',
    icon: Globe,
    gradient: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/20',
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500',
    tagBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    description: 'Scans VIX, DXY, crude oil, US yields, India VIX, USDINR, FII/DII flows. Produces a macro risk score for every trade.',
    tags: ['Global', 'FII/DII', 'Risk Score'],
  },
  {
    name: 'Booky',
    role: 'Trade Journal',
    icon: BookMarked,
    gradient: 'from-blue-500 to-indigo-500',
    glow: 'shadow-blue-500/20',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500',
    tagBg: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    description: 'Compiles trade journal entries, tracks win rate, P&L, drawdown, and process quality. Your squad\'s performance analyst.',
    tags: ['P&L', 'Win Rate', 'Analytics'],
  },
];

// ─── How It Works ───────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Create Account',
    description: 'Sign up with your email and get instant access. Full platform for 7 days — no credit card needed.',
    icon: UserPlus,
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500',
  },
  {
    title: 'Connect Your Broker',
    description: 'Go to Profile Settings, pick your broker, and paste your API credentials. Takes under 2 minutes.',
    icon: Cable,
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500',
  },
  {
    title: 'Paper Trade First',
    description: 'AI agents scan markets and simulate trades with zero risk. Build confidence before going live.',
    icon: Bot,
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500',
  },
  {
    title: 'Review & Tune',
    description: 'Check your win rate, P&L, and analytics. Adjust trading rules until the strategy fits your style.',
    icon: BarChart3,
    accent: 'text-violet-400',
    accentBg: 'bg-violet-500',
  },
  {
    title: 'Go Live',
    description: 'Flip to live mode. AI executes real F&O trades through your broker — fully automated.',
    icon: Rocket,
    accent: 'text-active',
    accentBg: 'bg-active',
  },
];

function StepMockup({ step }: { step: number }) {
  if (step === 0) {
    // Signup form mockup
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-active to-accent rounded-lg flex items-center justify-center">
            <Logo className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-white">AalsiTrader</span>
        </div>
        <div className="flex items-center gap-2 bg-background/80 border border-border rounded-lg px-3 py-2.5">
          <Mail className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">you@email.com</span>
        </div>
        <div className="bg-gradient-to-r from-active to-accent rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white">
          Start 7-Day Free Trial
        </div>
        <p className="text-[10px] text-gray-600 text-center">No credit card required</p>
      </div>
    );
  }

  if (step === 1) {
    // Broker selector mockup
    const brokers = [
      { name: 'Zerodha', color: 'bg-green-500' },
      { name: 'DhanHQ', color: 'bg-orange-500' },
      { name: 'Motilal', color: 'bg-blue-500' },
      { name: 'AngelOne', color: 'bg-red-500' },
      { name: 'Upstox', color: 'bg-purple-500' },
    ];
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400 font-medium mb-2">Select your broker</p>
        {brokers.map((b, i) => (
          <div
            key={b.name}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-all ${
              i === 1
                ? 'border-accent bg-accent/5 text-white'
                : 'border-border/50 text-gray-500'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${b.color}`} />
            <span className={i === 1 ? 'font-medium' : ''}>{b.name}</span>
            {i === 1 && <Check className="w-3.5 h-3.5 text-accent ml-auto" />}
          </div>
        ))}
      </div>
    );
  }

  if (step === 2) {
    // Trade signal mockup
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">AI Signal</span>
          <span className="text-[10px] px-2 py-0.5 bg-active/15 text-active rounded-full font-semibold">LIVE</span>
        </div>
        <div className="bg-active/5 border border-active/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs px-2 py-0.5 bg-active/20 text-active rounded font-bold">BUY</span>
              <span className="text-white font-bold ml-2">RELIANCE</span>
            </div>
            <span className="text-active text-sm font-semibold">+2.4%</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div><span className="text-gray-500">Entry</span><br/><span className="text-white font-medium">2,845</span></div>
            <div><span className="text-gray-500">Target</span><br/><span className="text-active font-medium">2,913</span></div>
            <div><span className="text-gray-500">Stop</span><br/><span className="text-danger font-medium">2,810</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <Zap className="w-3 h-3 text-sigma" />
          <span>Prime approved after consulting 5 agents</span>
        </div>
      </div>
    );
  }

  if (step === 3) {
    // Analytics mockup
    const bars = [35, 55, 42, 68, 52, 75, 60];
    return (
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-1.5 h-16">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t ${i === bars.length - 1 ? 'bg-active' : 'bg-accent/30'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-background/60 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500">Win Rate</div>
            <div className="text-sm font-bold text-active">68%</div>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500">Monthly P&L</div>
            <div className="text-sm font-bold text-active">+12.4K</div>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-500">Trades</div>
            <div className="text-sm font-bold text-white">47</div>
          </div>
        </div>
      </div>
    );
  }

  // Step 4 — Go live
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-background/60 rounded-xl p-4 border border-border/50">
        <div>
          <span className="text-xs text-gray-400">Trading Mode</span>
          <div className="text-white font-semibold mt-0.5">Live Trading</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Paper</span>
          <div className="w-11 h-6 bg-active rounded-full relative">
            <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow" />
          </div>
          <span className="text-xs text-active font-semibold">Live</span>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-active/5 border border-active/20 rounded-xl p-4">
        <div className="w-2.5 h-2.5 rounded-full bg-active animate-pulse" />
        <div>
          <div className="text-sm text-white font-medium">Connected to DhanHQ</div>
          <div className="text-[10px] text-gray-400">Executing via broker API</div>
        </div>
        <Target className="w-4 h-4 text-active ml-auto" />
      </div>
      <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
        <Shield className="w-3 h-3" />
        AES-256 encrypted credentials. Your funds stay with your broker.
      </div>
    </div>
  );
}

function HowItWorks({ onStartTrial }: { onStartTrial: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(() => {
      setActiveStep(prev => (prev + 1) % HOW_IT_WORKS_STEPS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isVisible, activeStep]);

  const step = HOW_IT_WORKS_STEPS[activeStep];
  const Icon = step.icon;

  return (
    <section
      id="how-it-works"
      aria-labelledby="hiw-heading"
      ref={sectionRef}
      className="py-16 px-4 relative"
      style={{ background: 'linear-gradient(180deg, rgba(13,13,32,0.4) 0%, rgba(19,19,42,0.5) 100%)' }}
    >
      <div className="absolute -left-10 top-10 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.10) 0%, transparent 70%)' }} />
      <div className="absolute -right-10 bottom-10 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)' }} />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <h2 id="hiw-heading" className="text-3xl font-bold mb-3">How It Works</h2>
          <p className="text-gray-400">From signup to live trading in 5 simple steps</p>
        </div>

        {/* Step indicator — horizontal bar */}
        <div className="flex items-center justify-center gap-0 mb-10 px-4">
          {HOW_IT_WORKS_STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === activeStep;
            const isPast = i < activeStep;
            return (
              <div key={i} className="flex items-center">
                <button
                  onClick={() => setActiveStep(i)}
                  className={`relative flex flex-col items-center gap-1.5 transition-all duration-300 group ${
                    isActive ? 'scale-110' : 'scale-100'
                  }`}
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? `${s.accentBg} text-white shadow-lg`
                      : isPast
                      ? 'bg-card-hover text-active border border-active/30'
                      : 'bg-card-hover text-gray-500 border border-border'
                  }`}>
                    <StepIcon className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className={`text-[10px] md:text-xs font-medium transition-colors hidden sm:block ${
                    isActive ? s.accent : isPast ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {s.title}
                  </span>
                  {/* Progress bar under active step */}
                  {isActive && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent animate-progress" key={activeStep} />
                    </div>
                  )}
                </button>

                {/* Connector line */}
                {i < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className={`w-6 md:w-12 h-[2px] mx-1 md:mx-2 rounded-full transition-colors duration-300 ${
                    isPast ? 'bg-active/40' : 'bg-border'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content panel */}
        <div
          key={activeStep}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-step-in"
        >
          {/* Left — text */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.accentBg} text-white`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${step.accent}`}>
                  Step {activeStep + 1}
                </span>
                <h3 className="text-xl font-bold text-white">{step.title}</h3>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed">{step.description}</p>
            <button
              onClick={() => {
                if (activeStep < HOW_IT_WORKS_STEPS.length - 1) {
                  setActiveStep(activeStep + 1);
                } else {
                  onStartTrial();
                }
              }}
              className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                activeStep === HOW_IT_WORKS_STEPS.length - 1
                  ? 'px-5 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80'
                  : `${step.accent} hover:underline`
              }`}
            >
              {activeStep === HOW_IT_WORKS_STEPS.length - 1 ? (
                <>Start Free Trial <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Next step <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          {/* Right — mockup panel */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl">
            <StepMockup step={activeStep} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ onSignIn, onStartTrial }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3" aria-label="AalsiTrader home">
            <div className="w-10 h-10 bg-gradient-to-br from-active to-accent rounded-lg flex items-center justify-center text-white">
              <Logo className="w-7 h-7" />
            </div>
            <span className="text-xl font-bold">AalsiTrader</span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#products" className="hover:text-white transition-colors">Products</a>
            <a href="#brokers" className="hover:text-white transition-colors">Brokers</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onStartTrial}
              className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      <main>
      {/* Hero */}
      <section id="hero" className="py-20 md:py-28 px-4 relative overflow-hidden">
        {/* Radial glow behind hero */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,212,255,0.12) 0%, transparent 70%)' }} />
        {/* Left orb */}
        <div className="absolute -left-20 top-10 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.15) 0%, transparent 70%)' }} />
        {/* Right orb — shifted to match GIF */}
        <div className="absolute -right-20 top-16 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — text content */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/30 rounded-full text-accent text-sm mb-6">
              <Bot className="w-4 h-4" />
              AI-Powered Trading for the Lazy Trader
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Be Lazy.{' '}
              <span className="bg-gradient-to-r from-accent to-active bg-clip-text text-transparent">
                Let AI Trade for You.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10">
              6 specialized AI agents work round the clock — scanning markets, analyzing opportunities,
              and executing trades while you sit back. From paper trading to live F&amp;O execution.
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <button
                onClick={onStartTrial}
                className="flex items-center gap-2 px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/80 transition-colors text-lg"
              >
                Start 7-Day Free Trial
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={onSignIn}
                className="px-8 py-3 border border-border text-gray-300 font-medium rounded-lg hover:bg-card-hover transition-colors text-lg"
              >
                Sign In
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">No credit card required. Full access for 7 days.</p>
          </div>
          {/* Right — relaxed trader GIF (Lottie Simple License, free commercial use) */}
          <div className="flex-shrink-0 relative">
            <div className="absolute -inset-4 rounded-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)' }} />
            <img
              src="/relaxed-trader.gif"
              alt="Relaxed trader chilling while AI handles the markets"
              className="w-72 md:w-96 rounded-2xl"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
        </div>
      </section>

      {/* Meet Your AI Squad */}
      <section id="ai-squad" aria-labelledby="squad-heading" className="py-16 px-4 relative" style={{ background: 'linear-gradient(180deg, rgba(19,19,42,0.6) 0%, rgba(13,13,32,0.4) 100%)' }}>
        {/* Side accents */}
        <div className="absolute -left-10 top-10 w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
        <div className="absolute -right-10 bottom-10 w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.10) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 id="squad-heading" className="text-3xl font-bold mb-3">Meet Your AI Trading Squad</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              6 AI agents, each a specialist. They communicate, collaborate, and make trading decisions
              so you don&apos;t have to. That&apos;s the AalsiTrader way.
            </p>
          </div>

          {/* Prime (vertical) + Squad (horizontal grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

            {/* Prime — Vertical Leader Bar */}
            <div className="rounded-2xl p-[1px] bg-gradient-to-b from-emerald-500 via-emerald-400 to-teal-400 shadow-lg shadow-emerald-500/10 lg:row-span-2">
              <div className="bg-card rounded-2xl p-6 h-full flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-4">
                  <Crown className="w-3 h-3" /> Squad Leader
                </span>
                <h3 className="text-xl font-bold mb-1">Prime</h3>
                <p className="text-xs text-emerald-400/80 font-medium mb-4">Trade Hunter / Orchestrator</p>
                <p className="text-sm text-gray-400 leading-relaxed mb-5 flex-1">
                  The mastermind. Consults every agent, resolves conflicts, approves final trade decisions, and broadcasts signals. The one who calls the shots.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {['Orchestrates all agents', 'Final trade approval', 'Real-time adaptation'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-300 font-semibold uppercase tracking-wide text-center">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Squad Cards — 3 top + 2 bottom (wider) fills all space */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
              {squadMembers.map((agent, i) => {
                const Icon = agent.icon;
                // Top 3 cards: span 2 cols each (2+2+2=6). Bottom 2 cards: span 3 cols each (3+3=6).
                const spanClass = i < 3 ? 'lg:col-span-2' : 'lg:col-span-3';
                return (
                  <div
                    key={agent.name}
                    className={`group relative bg-card border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300 hover:shadow-xl ${agent.glow} hover:-translate-y-1 ${spanClass}`}
                  >
                    {/* Gradient accent line at top */}
                    <div className={`absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r ${agent.gradient} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`} />

                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-11 h-11 bg-gradient-to-br ${agent.gradient} rounded-xl flex items-center justify-center shadow-lg ${agent.glow} flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold leading-tight">{agent.name}</h4>
                        <span className={`text-xs font-medium ${agent.accent}`}>{agent.role}</span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-400 leading-relaxed mb-3">
                      {agent.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {agent.tags.map((tag) => (
                        <span key={tag} className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${agent.tagBg}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" aria-labelledby="products-heading" className="py-16 px-4 relative">
        <div className="absolute -right-20 top-0 w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)' }} />
        <div className="absolute -left-20 bottom-0 w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 id="products-heading" className="text-3xl font-bold mb-3">Two Powerful Engines</h2>
            <p className="text-gray-400">Choose your trading style. Or use both.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Trader */}
            <div className="bg-card border border-border rounded-2xl p-8 hover:border-sigma/50 transition-colors">
              <div className="w-12 h-12 bg-sigma/10 rounded-xl flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-sigma" />
              </div>
              <h3 className="text-xl font-bold mb-2">AI Trader</h3>
              <p className="text-gray-400 mb-6">
                All 6 agents work together — scanning sectors, analyzing technicals, managing risk,
                and executing momentum trades with Smart Money Concepts.
              </p>
              <ul className="space-y-2">
                {[
                  'Multi-agent collaboration in real-time',
                  'Smart Money Concepts (BOS, CHoCH)',
                  'Auto position sizing & risk management',
                  'F&O futures execution via broker APIs',
                  'Full trade history & performance analytics',
                  'Paper mode to build confidence first',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-sigma flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Nifty Scalper */}
            <div className="bg-card border border-border rounded-2xl p-8 hover:border-amber-500/50 transition-colors">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Nifty Scalper</h3>
              <p className="text-gray-400 mb-6">
                Automated Nifty 50 straddle/strangle engine with real-time delta management,
                options pricing, and broker-integrated order execution.
              </p>
              <ul className="space-y-2">
                {[
                  'ATM straddle entry at market open',
                  'Real-time delta hedging',
                  'Black-Scholes option pricing',
                  'Multi-broker WebSocket feeds',
                  'Automatic profit booking & stop-loss',
                  'Paper & live mode with one click',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" aria-labelledby="features-heading" className="py-16 px-4 relative" style={{ background: 'linear-gradient(180deg, rgba(19,19,42,0.5) 0%, rgba(19,19,42,0.3) 100%)' }}>
        <div className="max-w-6xl mx-auto relative z-10">
          <h2 id="features-heading" className="sr-only">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-active/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-active" />
              </div>
              <h3 className="font-bold mb-2">Real-Time Analysis</h3>
              <p className="text-sm text-gray-400">
                Live market data, technical indicators, and news sentiment — processed by AI agents in real-time.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-bold mb-2">Risk Management</h3>
              <p className="text-sm text-gray-400">
                Position sizing, stop-losses, drawdown limits, and sector exposure caps — built into every trade.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-sigma/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Cable className="w-6 h-6 text-sigma" />
              </div>
              <h3 className="font-bold mb-2">Multi-Broker</h3>
              <p className="text-sm text-gray-400">
                Connect DhanHQ, Zerodha, Motilal Oswal, AngelOne, or Upstox. Switch brokers anytime. Execute F&O orders live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — animated walkthrough */}
      <HowItWorks onStartTrial={onStartTrial} />

      {/* Broker Integrations */}
      <section id="brokers" aria-labelledby="brokers-heading" className="py-16 px-4 relative">
        <div className="absolute -right-10 top-10 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <h2 id="brokers-heading" className="text-3xl font-bold mb-3">Broker Integrations</h2>
            <p className="text-gray-400">Connect your broker. We handle the rest.</p>
          </div>

          {/* Integrated */}
          <div className="mb-8">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4 text-center">Live &amp; Integrated</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'Zerodha', api: 'Kite Connect API', desc: 'India\'s largest broker. Zero brokerage on equity delivery, flat fee on F&O.' },
                { name: 'Dhan', api: 'DhanHQ API', desc: 'Lightning-fast order execution with free API access. Built for algo traders.' },
                { name: 'Motilal Oswal', api: 'MO Trading API', desc: 'Full-service broker with research insights, F&O trading, and portfolio tools.' },
                { name: 'Angel One', api: 'SmartAPI', desc: 'Popular discount broker with TOTP-based auto-login and real-time SmartStream feed.' },
                { name: 'Upstox', api: 'Upstox API v2', desc: 'Modern trading platform with OAuth2 access and comprehensive option chain data.' },
              ].map((b) => (
                <div key={b.name} className="bg-card border border-active/30 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-active" />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-active" />
                    <h4 className="font-bold text-white">{b.name}</h4>
                  </div>
                  <p className="text-[11px] text-active/80 font-medium mb-2">{b.api}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Soon */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4 text-center">Coming Soon</div>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
              {[
                { name: 'Fyers', api: 'Fyers API v3' },
                { name: 'Alice Blue', api: 'ANT API' },
                { name: '5paisa', api: '5paisa API' },
              ].map((b) => (
                <div key={b.name} className="bg-card border border-border rounded-xl p-4 text-center opacity-60 hover:opacity-80 transition-opacity">
                  <h4 className="font-semibold text-sm text-gray-300">{b.name}</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">{b.api}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 relative" id="pricing" aria-labelledby="pricing-heading">
        <div className="absolute -left-10 top-1/4 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute -right-10 bottom-1/4 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.12) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 id="pricing-heading" className="text-3xl font-bold mb-3">Simple Pricing</h2>
            <p className="text-gray-400">Starter plan includes a 7-day free trial. No credit card required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative bg-card border rounded-2xl p-6 flex flex-col ${
                  tier.highlighted
                    ? 'border-accent shadow-lg shadow-accent/10'
                    : 'border-border'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-white text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">
                    {tier.price.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm text-gray-400">{tier.period}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    (window as any).dataLayer?.push({
                      event: 'begin_checkout',
                      ecommerce: { currency: 'INR', value: tier.price, items: [{ item_name: tier.name }] },
                    });
                    if (tier.checkoutUrl) {
                      window.open(tier.checkoutUrl, '_blank');
                    } else {
                      onStartTrial();
                    }
                  }}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    tier.highlighted
                      ? 'bg-accent text-white hover:bg-accent/80'
                      : 'bg-card-hover text-white hover:bg-border'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border pt-8 pb-6 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Top row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Logo className="w-4 h-4" />
              <span>AalsiTrader</span>
            </div>
            <a href="mailto:support@aalsitrader.com" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              <Mail className="w-4 h-4" />
              support@aalsitrader.com
            </a>
          </div>

          {/* SEBI Disclaimers */}
          <div className="border-t border-border/50 pt-5 space-y-3">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">Risk Disclosure:</strong> Investments in securities market are subject to market risks. Read all the related documents carefully before investing. The price and value of investments and the income derived from them can go up or down, and you may not get back the amount you invest. Past performance is not indicative of future results.
            </p>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">Not Investment Advice:</strong> AalsiTrader is a technology platform that provides AI-powered trading tools. We are not registered with SEBI as investment advisors, research analysts, or portfolio managers. All information, signals, and analysis provided on this platform are for educational and informational purposes only and should not be construed as investment advice, recommendations, or solicitation to buy, sell, or hold any securities.
            </p>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">No Guaranteed Returns:</strong> This platform does not promise or guarantee any assured or risk-free returns. Trading in futures and options (F&amp;O) involves substantial risk of loss and is not suitable for all investors. 9 out of 10 individual traders in the equity F&amp;O segment incur net losses (SEBI study, January 2023).
            </p>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">Algorithmic Trading:</strong> As per SEBI Circular SEBI/HO/MIRSD/DOP/P/CIR/2022/117, AalsiTrader does not promise or guarantee any specific returns from algorithmic strategies. All algo-generated signals are for informational purposes; users must exercise their own judgment before placing trades.
            </p>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">User Responsibility:</strong> By using this platform, you acknowledge that you are fully aware of the risks involved in trading and investing in the stock market. You are solely responsible for your investment decisions. Consult a qualified financial advisor before making any investment. AalsiTrader shall not be liable for any profits or losses incurred as a result of using this platform.
            </p>
            <p className="text-[10px] text-gray-600 leading-relaxed">
              <strong className="text-gray-500">Broker Integrations:</strong> AalsiTrader integrates with SEBI-registered brokers (Zerodha, Dhan, Motilal Oswal, AngelOne, Upstox) via their official APIs. Your trading account, funds, and securities are held directly with your broker. AalsiTrader does not handle client funds or securities at any point.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
