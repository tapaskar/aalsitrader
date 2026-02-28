import { useState, useEffect } from 'react';
import { Agent, Activity as ActivityType } from '../types';
import { X, Activity, AlertCircle, CheckCircle, TrendingUp, TrendingDown, Info, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

interface AgentModalProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentModal({ agent, onClose }: AgentModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'settings'>('overview');
  const [history, setHistory] = useState<ActivityType[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Fetch agent history when the history tab is selected
  useEffect(() => {
    if (activeTab !== 'history' || historyLoaded) return;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`${API_URL}/activities?agentId=${agent.id}`);
        if (res.ok) {
          const data = await res.json();
          const activities = (data.activities || [])
            .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
          setHistory(activities);
        }
      } catch (err) {
        console.error('Failed to fetch agent history:', err);
      } finally {
        setHistoryLoading(false);
        setHistoryLoaded(true);
      }
    };
    fetchHistory();
  }, [activeTab, agent.id, historyLoaded]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-card rounded-2xl border max-w-lg w-full max-h-[80vh] overflow-hidden"
        style={{ borderColor: agent.color }}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold"
                style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
              >
                {agent.greek}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{agent.name}</h2>
                <p className="text-gray-400">{agent.role}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: agent.status === 'active' ? agent.color : '#6b7280' }}
                  />
                  <span className={`text-sm ${agent.status === 'active' ? 'text-active' : 'text-gray-500'}`}>
                    {agent.status === 'active' ? 'Active' : 'Sleeping'}
                  </span>
                  {agent.currentTask && (
                    <span className="text-sm text-gray-500">• {agent.currentTask}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-card-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['overview', 'history', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{ borderColor: activeTab === tab ? agent.color : undefined }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[400px]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card-hover rounded-xl p-4 text-center">
                  <Activity className="w-5 h-5 mx-auto mb-2" style={{ color: agent.color }} />
                  <div className="text-2xl font-bold">{agent.stats.tasksCompleted}</div>
                  <div className="text-xs text-gray-500">Tasks Done</div>
                </div>
                <div className="bg-card-hover rounded-xl p-4 text-center">
                  <AlertCircle className="w-5 h-5 mx-auto mb-2 text-warning" />
                  <div className="text-2xl font-bold">{agent.stats.alertsSent}</div>
                  <div className="text-xs text-gray-500">Alerts Sent</div>
                </div>
                <div className="bg-card-hover rounded-xl p-4 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-2 text-active" />
                  <div className="text-2xl font-bold">{agent.stats.accuracy}%</div>
                  <div className="text-xs text-gray-500">Accuracy</div>
                </div>
              </div>

              {/* Current Status */}
              <div className="bg-card-hover rounded-xl p-4">
                <h4 className="font-semibold mb-3">Current Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">State</span>
                    <span style={{ color: agent.status === 'active' ? agent.color : '#6b7280' }}>
                      {agent.status === 'active' ? 'Active & Working' : 'Sleeping'}
                    </span>
                  </div>
                  {agent.currentTask && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current Task</span>
                      <span>{agent.currentTask}</span>
                    </div>
                  )}
                  {agent.nextWake && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Next Wake</span>
                      <span>{agent.nextWake}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Activity</span>
                    <span>{new Date(agent.lastActivity).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 leading-relaxed">
                {agent.name} is responsible for {agent.role.toLowerCase()}. 
                {agent.id === 'alpha' && 'Monitors news, earnings, and analyst reports to identify market-moving events.'}
                {agent.id === 'beta' && 'Analyzes price action, technical levels, and chart patterns for trade setups.'}
                {agent.id === 'gamma' && 'Monitors portfolio risk, position sizing, and stop-losses to protect capital.'}
                {agent.id === 'sigma' && 'Orchestrates the squad, identifies trade opportunities, and coordinates execution.'}
                {agent.id === 'theta' && 'Tracks global markets, FII/DII flows, and macro indicators for context.'}
                {agent.id === 'delta' && 'Documents all trades, calculates performance metrics, and extracts lessons.'}
              </p>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {historyLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading history...</span>
                </div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="text-center py-8">
                  <Info className="w-6 h-6 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">No activity history yet</p>
                </div>
              )}
              {history.map((item) => {
                const ts = typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime();
                const typeColors: Record<string, string> = {
                  success: 'border-active/30 bg-active/5',
                  alert: 'border-danger/30 bg-danger/5',
                  warning: 'border-warning/30 bg-warning/5',
                  error: 'border-danger/30 bg-danger/5',
                  info: 'border-accent/20 bg-accent/5',
                };
                const typeIcons: Record<string, React.ReactNode> = {
                  success: <CheckCircle className="w-3.5 h-3.5 text-active shrink-0" />,
                  alert: <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />,
                  warning: <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />,
                  error: <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />,
                  info: <Info className="w-3.5 h-3.5 text-accent shrink-0" />,
                };
                return (
                  <div key={item.id} className={`rounded-lg border p-3 ${typeColors[item.type] || typeColors.info}`}>
                    <div className="flex items-start gap-2">
                      {typeIcons[item.type] || typeIcons.info}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white leading-relaxed">{item.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-gray-500">
                            {new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {' '}
                            {new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.tags?.length > 0 && (
                            <div className="flex gap-1">
                              {item.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-card-hover rounded text-gray-400">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-card-hover rounded-lg">
                <span className="text-sm">Wake on market open</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" />
              </div>
              <div className="flex items-center justify-between p-3 bg-card-hover rounded-lg">
                <span className="text-sm">Alert on critical findings</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" />
              </div>
              <div className="flex items-center justify-between p-3 bg-card-hover rounded-lg">
                <span className="text-sm">Heartbeat interval</span>
                <select className="bg-background border border-border rounded px-2 py-1 text-sm">
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>1 hour</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
