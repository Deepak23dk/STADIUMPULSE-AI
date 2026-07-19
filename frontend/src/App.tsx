import React, { useState, useEffect } from 'react';
import FanConcierge from './components/FanConcierge';
import OpsDashboard from './components/OpsDashboard';
import { Shield, Cloud, Clock, Eye, AlertCircle, MessageSquare } from 'lucide-react';

export interface Gate {
  id: string;
  name: string;
  queueLength: number;
  entryRate: number;
  capacity: number;
  waitTimeMinutes: number;
}

export interface Incident {
  id: string;
  title: string;
  section: string;
  severity: 'Low' | 'Medium' | 'High';
  status: 'Active' | 'Responding' | 'Resolved';
  timestamp: string;
}

export interface StadiumState {
  lastUpdated: string;
  weather: {
    temperature: string;
    condition: string;
    humidity: string;
    wind: string;
  };
  alertStatus: string;
  matchState: {
    match: string;
    score: string;
    half: string;
    minute: number;
    status: string;
  };
  gates: Gate[];
  incidents: Incident[];
}

export const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : '';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fan' | 'ops'>('fan');
  const [stadiumState, setStadiumState] = useState<StadiumState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStadiumState = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stadium-state`);
      if (!res.ok) throw new Error("Failed to fetch state");
      const data = await res.json();
      setStadiumState(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Unable to sync live stadium data feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStadiumState();
    // Poll the simulated real-time data every 5 seconds for visual freshness
    const interval = setInterval(fetchStadiumState, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stadiumState) {
    return (
      <div className="min-h-screen bg-[#090d16] text-[#f8fafc] flex items-center justify-center flex-col gap-3 font-mono">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#00f2fe]"></div>
        <span>Synchronizing MetLife Stadium telemetry...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stadium-bg text-stadium-text flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* Top Banner (Scoreboard Aesthetic) */}
      <header className="bg-stadium-card border-b border-stadium-border p-4 scanlines flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-stadium-accent/15 border border-stadium-accent p-2 rounded">
            <span className="text-xl font-bold font-mono tracking-wider text-stadium-accent glow-text">SP-AI</span>
          </div>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wide">StadiumPulse AI</h1>
            <p className="text-xs text-stadium-muted">MetLife Stadium • Tournament Copilot</p>
          </div>
        </div>

        {/* Live Match Info Scoreboard */}
        {stadiumState && (
          <div className="bg-black/40 border border-stadium-border rounded-lg px-4 py-2 flex items-center gap-6 font-mono text-center shadow-inner">
            <div>
              <span className="text-[10px] text-stadium-muted block uppercase">Match Status</span>
              <span className="text-sm font-semibold text-stadium-accent flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stadium-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-stadium-accent"></span>
                </span>
                {stadiumState.matchState.status}
              </span>
            </div>
            
            <div className="h-8 w-[1px] bg-stadium-border"></div>

            <div>
              <span className="text-[10px] text-stadium-muted block uppercase">Live Score</span>
              <span className="text-base font-bold text-white tracking-widest">
                {stadiumState.matchState.match.split(" vs ")[0].slice(0, 3).toUpperCase()}{" "}
                <span className="text-stadium-warning">{stadiumState.matchState.score}</span>{" "}
                {stadiumState.matchState.match.split(" vs ")[1].slice(0, 3).toUpperCase()}
              </span>
            </div>

            <div className="h-8 w-[1px] bg-stadium-border"></div>

            <div>
              <span className="text-[10px] text-stadium-muted block uppercase">Minute</span>
              <span className="text-sm text-stadium-accent font-semibold flex items-center gap-1 justify-center">
                <Clock className="w-3.5 h-3.5" />
                {stadiumState.matchState.minute}'
              </span>
            </div>
          </div>
        )}

        {/* System & Alert statuses */}
        {stadiumState && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-stadium-border/30 px-3 py-1.5 rounded-full border border-stadium-border">
              <Cloud className="w-3.5 h-3.5 text-stadium-accent" />
              <span>{stadiumState.weather.temperature} • {stadiumState.weather.condition}</span>
            </div>

            <div className="flex items-center gap-2 bg-stadium-border/30 px-3 py-1.5 rounded-full border border-stadium-border">
              <Shield className={`w-3.5 h-3.5 ${stadiumState.alertStatus === 'Normal' ? 'text-stadium-accent' : 'text-stadium-danger'}`} />
              <span>Alert: <strong className="text-white">{stadiumState.alertStatus}</strong></span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row relative">
        {/* Navigation Sidebar */}
        <nav className="w-full md:w-64 bg-stadium-card/85 border-b md:border-b-0 md:border-r border-stadium-border p-4 flex flex-row md:flex-col gap-2 z-20 shrink-0">
          <button
            onClick={() => setActiveTab('fan')}
            className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'fan'
                ? 'bg-stadium-accent/15 border border-stadium-accent text-stadium-accent glow-border'
                : 'border border-transparent hover:bg-stadium-border/40 hover:text-white'
            }`}
            aria-label="Switch to Fan Concierge view"
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline md:inline">Fan Concierge</span>
          </button>
          
          <button
            onClick={() => setActiveTab('ops')}
            className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'ops'
                ? 'bg-stadium-accent/15 border border-stadium-accent text-stadium-accent glow-border'
                : 'border border-transparent hover:bg-stadium-border/40 hover:text-white'
            }`}
            aria-label="Switch to Operations Command view"
          >
            <Eye className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline md:inline">Ops Dashboard</span>
          </button>

          <div className="hidden md:block mt-auto p-3 bg-black/20 rounded-lg border border-stadium-border text-center text-[10px] text-stadium-muted">
            <p>Live stream connected</p>
            <p className="font-mono mt-1 text-stadium-accent uppercase animate-pulse">● online</p>
          </div>
        </nav>

        {/* View Switcher */}
        <section className="flex-1 flex flex-col relative h-[calc(100vh-210px)] md:h-[calc(100vh-81px)] overflow-hidden">
          {error && (
            <div className="bg-stadium-danger/10 border-b border-stadium-danger text-stadium-danger text-center p-2 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'fan' ? (
            <FanConcierge stadiumState={stadiumState} />
          ) : (
            <OpsDashboard stadiumState={stadiumState} reloadState={fetchStadiumState} />
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
