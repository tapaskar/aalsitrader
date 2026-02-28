import { useDashboardStore } from '../store/dashboardStore';
import { Terminal, Activity } from 'lucide-react';

export function OutputPanel() {
  const { activities, trades, stats } = useDashboardStore();

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Combine activities and trades into output log
  const outputLines = [
    // Header
    { type: 'system', time: formatTime(new Date()), text: '=== AalsiTrader Mission Control ===' },
    { type: 'system', time: formatTime(new Date()), text: `Active Agents: ${stats.activeAgents} | Sleeping: ${stats.sleepingAgents}` },
    { type: 'system', time: formatTime(new Date()), text: `Total Trades Today: ${trades.length} | Win Rate: ${stats.winRate}%` },
    { type: 'system', time: formatTime(new Date()), text: '---' },
    
    // Recent activities
    ...activities.slice(0, 10).map((a) => ({
      type: 'agent',
      time: formatTime(a.timestamp),
      agent: a.agentName,
      agentGreek: a.agentGreek,
      agentColor: a.agentColor,
      text: a.content.slice(0, 60) + (a.content.length > 60 ? '...' : ''),
    })),
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-active" />
          <h3 className="font-semibold text-active">Squad Output Log</h3>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-xs text-gray-500">LIVE</span>
        </div>
      </div>

      <div className="bg-[#0a0a14] rounded-lg p-4 font-mono text-xs max-h-[300px] overflow-y-auto border border-border/30">
        {outputLines.map((line, i) => (
          <div key={i} className="mb-1.5">
            {line.type === 'system' ? (
              <span className="text-gray-400">
                <span className="text-gray-500">[{line.time}]</span> {line.text}
              </span>
            ) : (
              <span>
                <span className="text-gray-500">[{line.time}]</span>{' '}
                <span style={{ color: (line as any).agentColor }}>
                  [{(line as any).agentGreek}]
                </span>{' '}
                <span className="text-gray-200">{(line as any).text}</span>
              </span>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-2 text-gray-500">
          <span className="animate-pulse">_</span>
          <span>awaiting next activity...</span>
        </div>
      </div>
    </div>
  );
}
