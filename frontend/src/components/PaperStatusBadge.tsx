import { Beaker, Play, Pause, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

interface PaperStatusBadgeProps {
  mode: 'paper' | 'live';
  enabled: boolean;
  requireSigmaApproval?: boolean;
  pendingApprovals?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PaperStatusBadge({
  mode,
  enabled,
  requireSigmaApproval = true,
  pendingApprovals = 0,
  showLabel = true,
  size = 'md',
}: PaperStatusBadgeProps) {
  const isPaper = mode === 'paper';
  
  const sizeClasses = {
    sm: {
      container: 'px-2 py-0.5 text-[10px]',
      icon: 12,
    },
    md: {
      container: 'px-2.5 py-1 text-xs',
      icon: 14,
    },
    lg: {
      container: 'px-3 py-1.5 text-sm',
      icon: 16,
    },
  };

  if (!enabled) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-lg bg-gray-800/50 text-gray-500 ${sizeClasses[size].container}`}>
        <Pause size={sizeClasses[size].icon} />
        {showLabel && <span className="font-medium">Disabled</span>}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg ${
      isPaper 
        ? 'bg-sigma/10 text-sigma border border-sigma/30' 
        : 'bg-danger/10 text-danger border border-danger/30'
    } ${sizeClasses[size].container}`}>
      {isPaper ? (
        <>
          <Beaker size={sizeClasses[size].icon} />
          {showLabel && (
            <span className="font-medium">
              Paper Mode
              {pendingApprovals > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-sigma text-white rounded-full text-[10px]">
                  {pendingApprovals}
                </span>
              )}
            </span>
          )}
        </>
      ) : (
        <>
          <Play size={sizeClasses[size].icon} className="fill-current" />
          {showLabel && <span className="font-medium font-bold">LIVE MODE</span>}
        </>
      )}
      
      {requireSigmaApproval && isPaper && (
        <ShieldCheck size={sizeClasses[size].icon} className="ml-1 text-sigma/70" />
      )}
    </div>
  );
}

// Compact version for inline use
export function PaperModeIndicator({ mode, trades, winRate, pnl }: {
  mode: 'paper' | 'live';
  trades: number;
  winRate: number;
  pnl: number;
}) {
  const isPaper = mode === 'paper';
  
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
      isPaper ? 'bg-sigma/5 border border-sigma/20' : 'bg-danger/5 border border-danger/20'
    }`}>
      <div className={`w-2 h-2 rounded-full ${isPaper ? 'bg-sigma animate-pulse' : 'bg-danger animate-pulse'}`} />
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${isPaper ? 'text-sigma' : 'text-danger'}`}>
          {isPaper ? '🧪 Paper Test:' : '🔴 LIVE:'}
        </span>
        <span className="text-xs text-gray-400">
          {trades} trades · {winRate}% win · 
          <span className={pnl >= 0 ? 'text-active' : 'text-danger'}>
            ₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </span>
      </div>
    </div>
  );
}

// Sigma badge showing approval status
export function SigmaApprovalBadge({ 
  status, 
  tradesApproved, 
  tradesRejected 
}: { 
  status: 'idle' | 'pending' | 'reviewing';
  tradesApproved: number;
  tradesRejected: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-sigma" />
        <span className="text-xs font-medium text-sigma">Sigma Approval Active</span>
        {status === 'pending' && (
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
        )}
        {status === 'reviewing' && (
          <span className="px-1.5 py-0.5 bg-warning/20 text-warning text-[10px] rounded">
            Reviewing
          </span>
        )}
      </div>
      
      {(tradesApproved > 0 || tradesRejected > 0) && (
        <div className="flex items-center gap-3 text-[10px] text-gray-500 pl-6">
          <span className="text-active">{tradesApproved} approved</span>
          {tradesRejected > 0 && (
            <span className="text-danger">{tradesRejected} rejected</span>
          )}
        </div>
      )}
    </div>
  );
}
