import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Trash2, Edit2, Save, X, RefreshCw,
  CheckCircle, AlertCircle, RotateCcw, DollarSign,
  LogIn, LogOut, Shield,
} from 'lucide-react';
import { getAuthHeaders } from '../store/authStore';
import type { TradingRules, TradingConfig } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

const DEFAULT_CONFIG: TradingConfig = {
  startingCapital: 1000000,
  maxRiskPerTradePct: 2.0,
  dailyLossLimitPct: 5.0,
  maxPositions: 3,
  maxSectorExposurePct: 30,
  rsiOversoldThreshold: 35,
  rsiOverboughtThreshold: 65,
  minRewardRiskRatio: 2.0,
  minTimeframeConfidence: 50,
  rejectHighFalseBreakout: true,
  requireAgentAlignment: true,
  maxTradeDurationHours: 24,
  exitOnMomentumExhaustion: true,
  exitOnReversalSignal: true,
  intradayExitTime: '15:15',
  maxSwingHoldingDays: 5,
  hedgeEnabled: true,
  brokeragePerOrder: 20,
};

interface TradingRulesPanelProps {
  onClose?: () => void;
}

// ─── Inline UI Helpers ───

function NumberField({
  label, value, onChange, min, max, step, suffix, prefix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string; prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card-hover/30">
      <span className="text-xs text-gray-400 flex-1">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[10px] text-gray-500">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step || 1}
          className="w-20 bg-card border border-border rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {suffix && <span className="text-[10px] text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleField({
  label, value, onChange, description,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card-hover/30">
      <div className="flex-1">
        <span className="text-xs text-gray-400">{label}</span>
        {description && <p className="text-[10px] text-gray-600 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          value ? 'bg-active' : 'bg-gray-700'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Text Rule List (reusable) ───

function TextRuleList({
  rules, type, onUpdate,
}: {
  rules: string[];
  type: 'entry' | 'exit' | 'risk';
  onUpdate: (newRules: string[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(rules[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editValue.trim()) return;
    const updated = [...rules];
    updated[editingIndex] = editValue.trim();
    onUpdate(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDelete = (index: number) => {
    onUpdate(rules.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!newValue.trim()) return;
    onUpdate([...rules, newValue.trim()]);
    setNewValue('');
    setAdding(false);
  };

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Custom {type} rules</span>
        <button
          onClick={() => setAdding(true)}
          className="p-0.5 hover:bg-card-hover rounded transition-colors"
          title={`Add ${type} rule`}
        >
          <Plus className="w-3.5 h-3.5 text-gray-500 hover:text-white" />
        </button>
      </div>

      {rules.map((rule, i) => (
        <div key={i} className="group flex items-start gap-2 p-1.5 rounded-lg hover:bg-card-hover/50 transition-colors">
          <span className="text-[10px] text-gray-600 font-mono w-4 flex-shrink-0 pt-0.5">{i + 1}.</span>
          {editingIndex === i ? (
            <div className="flex-1 flex gap-1.5">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 bg-card border border-border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              />
              <button onClick={handleSaveEdit} className="p-1 hover:bg-active/20 rounded text-active"><Save className="w-3 h-3" /></button>
              <button onClick={() => setEditingIndex(null)} className="p-1 hover:bg-danger/20 rounded text-danger"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-[11px] text-gray-300">{rule}</span>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                <button onClick={() => handleEdit(i)} className="p-0.5 hover:bg-accent/20 rounded text-accent"><Edit2 className="w-3 h-3" /></button>
                <button onClick={() => handleDelete(i)} className="p-0.5 hover:bg-danger/20 rounded text-danger"><Trash2 className="w-3 h-3" /></button>
              </div>
            </>
          )}
        </div>
      ))}

      {adding && (
        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-accent/10 border border-accent/30">
          <Plus className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`New ${type} rule...`}
            className="flex-1 bg-transparent text-[11px] focus:outline-none placeholder-gray-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} className="p-1 hover:bg-active/20 rounded text-active"><Save className="w-3 h-3" /></button>
          <button onClick={() => { setAdding(false); setNewValue(''); }} className="p-1 hover:bg-danger/20 rounded text-danger"><X className="w-3 h-3" /></button>
        </div>
      )}

      {rules.length === 0 && !adding && (
        <p className="text-[10px] text-gray-600 italic pl-6">No custom rules. Click + to add.</p>
      )}
    </div>
  );
}

// ─── Section Wrapper ───

function Section({
  title, icon, color, children,
}: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───

export function TradingRulesPanel({ onClose }: TradingRulesPanelProps) {
  const [rules, setRules] = useState<TradingRules | null>(null);
  const [config, setConfig] = useState<TradingConfig>(DEFAULT_CONFIG);
  const [entryRules, setEntryRules] = useState<string[]>([]);
  const [exitRules, setExitRules] = useState<string[]>([]);
  const [riskRules, setRiskRules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/trading-rules`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch rules');
      const data = await res.json();
      const r = data.rules as TradingRules;
      setRules(r);
      setConfig(r.config || DEFAULT_CONFIG);
      setEntryRules(r.entryRules || []);
      setExitRules(r.exitRules || []);
      setRiskRules(r.riskRules || []);
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load trading rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const updateConfig = (key: keyof TradingConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleEntryRulesChange = (newRules: string[]) => {
    setEntryRules(newRules);
    setHasChanges(true);
  };

  const handleExitRulesChange = (newRules: string[]) => {
    setExitRules(newRules);
    setHasChanges(true);
  };

  const handleRiskRulesChange = (newRules: string[]) => {
    setRiskRules(newRules);
    setHasChanges(true);
  };

  const saveAll = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/trading-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          entryRules,
          exitRules,
          riskRules,
          config,
        }),
      });
      if (!res.ok) throw new Error('Failed to save rules');
      const data = await res.json();
      setRules(data.rules);
      setHasChanges(false);
      setSuccess('All rules saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save rules');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    setEntryRules([
      'RSI below 35 (oversold) for BUY signals',
      'RSI above 65 (overbought) for SELL signals',
      'MACD crossover confirms trend direction',
      'Price above 20-day EMA for longs, below for shorts',
      'Minimum 2:1 reward-to-risk ratio required',
      'All 3 agents (Technical, News, Risk) must align for HIGH conviction',
    ]);
    setExitRules([
      'Stop loss hit - exit immediately (no averaging down)',
      'Target reached - book 50% profits, trail remaining',
      'RSI divergence against position - tighten stop',
      'News turns negative - reduce position by 50%',
      'End of day - close all intraday positions by 3:15 PM',
      'Maximum holding period: 5 trading days for swing trades',
    ]);
    setRiskRules([
      'Maximum 2% capital risk per trade',
      'Maximum 6 open positions at any time',
      'Maximum 10% daily drawdown - stop trading for the day',
      'No trading during major news events (RBI, earnings)',
      'Position sizing: lotSize = (2% of capital) / (entry - stopLoss)',
      'Hedge requirement: Every long must have a defined stop loss',
    ]);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-accent" />
          <span className="ml-2 text-gray-400">Loading trading rules...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sigma/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-sigma" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Trading Rules
              {hasChanges && (
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse" title="Unsaved changes" />
              )}
            </h2>
            <p className="text-xs text-gray-500">
              Configure all trading parameters and rules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRules}
            className="p-2 hover:bg-card-hover rounded-lg transition-colors"
            title="Reload from server"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-card-hover rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-active/10 border border-active/30 rounded-lg flex items-center gap-2 text-active text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Section 1: Position Sizing & Capital */}
      <Section
        title="Position Sizing & Capital"
        icon={<DollarSign className="w-3.5 h-3.5" />}
        color="bg-blue-500/20 text-blue-400"
      >
        <NumberField
          label="Starting Capital"
          value={config.startingCapital}
          onChange={(v) => updateConfig('startingCapital', v)}
          min={100000}
          step={100000}
          prefix="₹"
        />
        <NumberField
          label="Max Risk per Trade"
          value={config.maxRiskPerTradePct}
          onChange={(v) => updateConfig('maxRiskPerTradePct', v)}
          min={0.5}
          max={10}
          step={0.5}
          suffix="%"
        />
        <NumberField
          label="Daily Loss Limit"
          value={config.dailyLossLimitPct}
          onChange={(v) => updateConfig('dailyLossLimitPct', v)}
          min={1}
          max={20}
          step={0.5}
          suffix="%"
        />
        <NumberField
          label="Max Open Positions"
          value={config.maxPositions}
          onChange={(v) => updateConfig('maxPositions', v)}
          min={1}
          max={20}
        />
        <NumberField
          label="Max Sector Exposure"
          value={config.maxSectorExposurePct}
          onChange={(v) => updateConfig('maxSectorExposurePct', v)}
          min={10}
          max={100}
          step={5}
          suffix="%"
        />
      </Section>

      {/* Section 2: Entry Conditions */}
      <Section
        title="Entry Conditions"
        icon={<LogIn className="w-3.5 h-3.5" />}
        color="bg-active/20 text-active"
      >
        <NumberField
          label="RSI Oversold Threshold (BUY)"
          value={config.rsiOversoldThreshold}
          onChange={(v) => updateConfig('rsiOversoldThreshold', v)}
          min={10}
          max={50}
        />
        <NumberField
          label="RSI Overbought Threshold (SELL)"
          value={config.rsiOverboughtThreshold}
          onChange={(v) => updateConfig('rsiOverboughtThreshold', v)}
          min={50}
          max={90}
        />
        <NumberField
          label="Min Reward:Risk Ratio"
          value={config.minRewardRiskRatio}
          onChange={(v) => updateConfig('minRewardRiskRatio', v)}
          min={1}
          max={5}
          step={0.5}
          suffix=":1"
        />
        <NumberField
          label="Min Timeframe Confidence"
          value={config.minTimeframeConfidence}
          onChange={(v) => updateConfig('minTimeframeConfidence', v)}
          min={10}
          max={100}
          step={5}
          suffix="%"
        />
        <ToggleField
          label="Reject High False Breakout Risk"
          value={config.rejectHighFalseBreakout}
          onChange={(v) => updateConfig('rejectHighFalseBreakout', v)}
          description="Skip trades with high false breakout probability"
        />
        <ToggleField
          label="Require Agent Alignment"
          value={config.requireAgentAlignment}
          onChange={(v) => updateConfig('requireAgentAlignment', v)}
          description="All 3 agents must agree for entry"
        />
        <TextRuleList
          rules={entryRules}
          type="entry"
          onUpdate={handleEntryRulesChange}
        />
      </Section>

      {/* Section 3: Exit Conditions */}
      <Section
        title="Exit Conditions"
        icon={<LogOut className="w-3.5 h-3.5" />}
        color="bg-danger/20 text-danger"
      >
        <NumberField
          label="Max Trade Duration"
          value={config.maxTradeDurationHours}
          onChange={(v) => updateConfig('maxTradeDurationHours', v)}
          min={1}
          max={168}
          suffix="hrs"
        />
        <NumberField
          label="Max Swing Holding Period"
          value={config.maxSwingHoldingDays}
          onChange={(v) => updateConfig('maxSwingHoldingDays', v)}
          min={1}
          max={30}
          suffix="days"
        />
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card-hover/30">
          <span className="text-xs text-gray-400">Intraday Exit Time</span>
          <input
            type="time"
            value={config.intradayExitTime}
            onChange={(e) => updateConfig('intradayExitTime', e.target.value)}
            className="bg-card border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <ToggleField
          label="Exit on Momentum Exhaustion"
          value={config.exitOnMomentumExhaustion}
          onChange={(v) => updateConfig('exitOnMomentumExhaustion', v)}
          description="Auto-exit when momentum turns weak"
        />
        <ToggleField
          label="Exit on Reversal Signal"
          value={config.exitOnReversalSignal}
          onChange={(v) => updateConfig('exitOnReversalSignal', v)}
          description="Auto-exit when direction reverses"
        />
        <TextRuleList
          rules={exitRules}
          type="exit"
          onUpdate={handleExitRulesChange}
        />
      </Section>

      {/* Section 4: Risk Management */}
      <Section
        title="Risk Management"
        icon={<Shield className="w-3.5 h-3.5" />}
        color="bg-warning/20 text-warning"
      >
        <ToggleField
          label="Hedging Enabled"
          value={config.hedgeEnabled}
          onChange={(v) => updateConfig('hedgeEnabled', v)}
          description="Hedge every futures position with ATM put option"
        />
        <NumberField
          label="Brokerage per Order"
          value={config.brokeragePerOrder}
          onChange={(v) => updateConfig('brokeragePerOrder', v)}
          min={0}
          max={100}
          prefix="₹"
        />
        <TextRuleList
          rules={riskRules}
          type="risk"
          onUpdate={handleRiskRulesChange}
        />
      </Section>

      {/* Footer / Actions */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-card-hover rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
          </div>
          <div className="flex items-center gap-2">
            {rules && (
              <span className="text-[10px] text-gray-600 mr-2">
                Last saved: {new Date(rules.lastUpdated).toLocaleString()} by {rules.updatedBy === 'prime' ? 'Prime AI' : 'you'}
              </span>
            )}
            <button
              onClick={saveAll}
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                hasChanges
                  ? 'bg-active text-white hover:bg-active/80'
                  : 'bg-card-hover text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isSaving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
