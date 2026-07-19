import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertOctagon, Terminal, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE } from '../App';
import type { StadiumState } from '../App';

interface OpsDashboardProps {
  stadiumState: StadiumState | null;
  reloadState: () => void;
}

const OpsDashboard: React.FC<OpsDashboardProps> = ({ stadiumState, reloadState }) => {
  const [aiBriefing, setAiBriefing] = useState<string>('');
  const [loadingBriefing, setLoadingBriefing] = useState<boolean>(true);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [highContrast, setHighContrast] = useState<boolean>(false);

  // Trigger AI briefing fetch based on live data changes (debounced/throttled or every 30s)
  const fetchAiBriefing = async () => {
    if (!stadiumState) return;
    setLoadingBriefing(true);
    try {
      // Formulate a summary prompt with the actual values for the LLM
      const gatesSummary = stadiumState.gates
        .map(g => `${g.name}: Queue=${g.queueLength}, Wait=${g.waitTimeMinutes}min, Rate=${g.entryRate}/min, Cap=${g.capacity}/min`)
        .join("; ");
      const incidentsSummary = stadiumState.incidents.length > 0
        ? stadiumState.incidents.map(i => `${i.title} at ${i.section} (Severity: ${i.severity}, Status: ${i.status})`).join("; ")
        : "No active incidents";

      const prompt = `System State Report:
      Gates: ${gatesSummary}
      Incidents: ${incidentsSummary}
      Weather: ${stadiumState.weather.condition}, Temp: ${stadiumState.weather.temperature}
      Alert Status: ${stadiumState.alertStatus}
      
      Generate a concise operations briefing. Detail current bottleneck gates (wait time > 5 min), active incidents, and recommended staff actions (e.g. divert fans, dispatch first aid).`;

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, language: 'en', isOps: true })
      });

      if (!res.ok) throw new Error("Failed to generate briefing");
      const data = await res.json();
      setAiBriefing(data.response);
    } catch (err) {
      console.error(err);
      setAiBriefing("Could not compile GenAI briefing. Operations guidelines fallback: Monitor Gate C (historically high flow). Ensure cleaning team responds to any Section spills.");
    } finally {
      setLoadingBriefing(false);
    }
  };

  useEffect(() => {
    // Fetch briefing initially and every 30 seconds
    fetchAiBriefing();
    const interval = setInterval(fetchAiBriefing, 30000);
    return () => clearInterval(interval);
  }, [stadiumState?.lastUpdated]); // Refresh when state updates

  if (!stadiumState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center font-mono text-stadium-muted text-sm gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-stadium-accent" />
        <span>Synchronizing with live Operations Command server...</span>
      </div>
    );
  }

  // Find max queue length to scale bar chart
  const maxQueue = Math.max(...stadiumState.gates.map(g => g.queueLength), 100);

  return (
    <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${highContrast ? 'contrast-125' : ''}`}>
      {/* Controls Bar for Accessibility */}
      <div className="bg-stadium-card/60 border border-stadium-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-stadium-accent" />
          <span>Ops Dashboard Controls</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`px-3 py-1 rounded border transition-all ${
              reducedMotion
                ? 'bg-stadium-accent/20 border-stadium-accent text-stadium-accent'
                : 'border-stadium-border text-stadium-muted hover:text-white'
            }`}
          >
            {reducedMotion ? 'Animations Off' : 'Animations On'}
          </button>
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`px-3 py-1 rounded border transition-all ${
              highContrast
                ? 'bg-stadium-accent/20 border-stadium-accent text-stadium-accent'
                : 'border-stadium-border text-stadium-muted hover:text-white'
            }`}
          >
            High Contrast
          </button>
          <button
            onClick={reloadState}
            className="flex items-center gap-1.5 px-3 py-1 rounded border border-stadium-border hover:border-stadium-accent hover:text-white text-stadium-muted transition-all"
            aria-label="Force refresh live feed data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync State</span>
          </button>
        </div>
      </div>

      {/* Top Section: Charts & Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gate Queue Bar Chart (SVG-based for complete accessibility and responsiveness) */}
        <div className="lg:col-span-2 bg-stadium-card border border-stadium-border rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Live Gate Wait Times</h2>
              <p className="text-xs text-stadium-muted">Comparison of turnstile queues and delay thresholds</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-stadium-accent rounded"></span>Normal (&lt;150)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-stadium-danger rounded"></span>Congested (&gt;=150)</span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="flex-1 min-h-[220px] relative flex items-end justify-between px-2 pt-6 border-b border-l border-stadium-border">
            {stadiumState.gates.map((g) => {
              const isCongested = g.queueLength >= 150;
              const barHeightPercent = (g.queueLength / maxQueue) * 80; // keep max at 80% to leave room for labels
              const hoverState = selectedGate === g.id;

              return (
                <div
                  key={g.id}
                  className="flex flex-col items-center flex-1 group"
                  onMouseEnter={() => setSelectedGate(g.id)}
                  onMouseLeave={() => setSelectedGate(null)}
                >
                  {/* Tooltip on hover */}
                  <div
                    className={`absolute top-0 bg-slate-950 border border-stadium-border rounded-md px-3 py-1.5 text-[10px] font-mono shadow-xl transition-opacity duration-200 z-10 ${
                      hoverState ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <p className="text-white font-bold">{g.name}</p>
                    <p>Queue: {g.queueLength} fans</p>
                    <p>Flow Rate: {g.entryRate}/min (Cap: {g.capacity})</p>
                    <p>Wait: {g.waitTimeMinutes} mins</p>
                  </div>

                  {/* Accessible Tabbable Bar */}
                  <button
                    tabIndex={0}
                    aria-label={`Gate ${g.id}: ${g.queueLength} fans in queue. Wait time is ${g.waitTimeMinutes} minutes.`}
                    onFocus={() => setSelectedGate(g.id)}
                    onBlur={() => setSelectedGate(null)}
                    className="w-12 sm:w-16 rounded-t-md transition-all duration-500 relative focus:outline-none"
                    style={{
                      height: `${Math.max(10, barHeightPercent)}%`,
                      backgroundColor: isCongested ? 'rgba(239, 68, 68, 0.85)' : 'rgba(0, 242, 254, 0.85)',
                      boxShadow: isCongested ? '0 0 15px rgba(239, 68, 68, 0.4)' : '0 0 15px rgba(0, 242, 254, 0.4)',
                      transition: reducedMotion ? 'none' : 'height 0.5s ease-out, background-color 0.3s'
                    }}
                  />

                  {/* Gate identifier label */}
                  <span className="mt-3 text-sm font-bold font-mono tracking-wide">{g.id}</span>
                  <span className="text-[10px] text-stadium-muted font-mono">{g.waitTimeMinutes}m wait</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Incident List */}
        <div className="bg-stadium-card border border-stadium-border rounded-xl p-5 shadow-lg flex flex-col h-[320px] lg:h-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-stadium-danger" />
              <span>Active Incidents</span>
            </h2>
            <span className="bg-stadium-danger/15 text-stadium-danger border border-stadium-danger/25 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
              {stadiumState.incidents.filter(i => i.status !== 'Resolved').length} Active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {stadiumState.incidents.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col gap-2 text-xs text-stadium-muted font-mono">
                <CheckCircle className="w-6 h-6 text-stadium-accent" />
                <span>Stadium clear. No incidents reported.</span>
              </div>
            ) : (
              stadiumState.incidents.map((inc) => {
                const isHigh = inc.severity === 'High';
                const isMed = inc.severity === 'Medium';
                
                return (
                  <div
                    key={inc.id}
                    className={`p-3 rounded-lg border flex items-start gap-2.5 transition-all duration-300 ${
                      inc.status === 'Resolved' ? 'bg-stadium-accent/5 border-stadium-accent/20 opacity-60' :
                      isHigh ? 'bg-stadium-danger/10 border-stadium-danger/30' :
                      isMed ? 'bg-stadium-warning/10 border-stadium-warning/30' :
                      'bg-stadium-border/20 border-stadium-border'
                    }`}
                  >
                    <AlertOctagon className={`w-4 h-4 shrink-0 mt-0.5 ${
                      inc.status === 'Resolved' ? 'text-stadium-accent' :
                      isHigh ? 'text-stadium-danger animate-pulse' :
                      isMed ? 'text-stadium-warning' :
                      'text-stadium-muted'
                    }`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-white block truncate">{inc.title}</span>
                        <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${
                          inc.status === 'Resolved' ? 'bg-stadium-accent/20 text-stadium-accent' :
                          inc.status === 'Responding' ? 'bg-stadium-warning/20 text-stadium-warning' :
                          'bg-stadium-danger/20 text-stadium-danger'
                        }`}>
                          {inc.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-stadium-muted font-mono mt-1">
                        <span>Location: <strong className="text-white">{inc.section}</strong></span>
                        <span>{new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Operations AI Briefing Panel */}
      <div className="bg-stadium-card border border-stadium-border rounded-xl p-5 shadow-lg relative overflow-hidden">
        {/* Subtle grid lines background to match the stadium Lit vibe */}
        <div className="absolute inset-0 glow-bg pointer-events-none opacity-30"></div>

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="bg-stadium-accent/15 border border-stadium-accent p-1.5 rounded">
              <span className="text-xs font-bold font-mono tracking-widest text-stadium-accent glow-text">AI</span>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">GenAI Copilot Operations Briefing</h2>
              <p className="text-xs text-stadium-muted">Prioritized alerts and resource suggestions based on live telemetry</p>
            </div>
          </div>
          
          <button
            onClick={fetchAiBriefing}
            disabled={loadingBriefing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stadium-accent text-slate-950 text-xs font-bold hover:bg-cyan-400 focus:outline-none transition-all"
            aria-label="Refresh operational brief manually"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBriefing ? 'animate-spin' : ''}`} />
            <span>Recalculate Briefing</span>
          </button>
        </div>

        {/* AI Briefing Content Display */}
        <div className="bg-black/50 border border-stadium-border p-5 rounded-lg min-h-[140px] flex items-start gap-4 relative z-10">
          {loadingBriefing ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 font-mono text-stadium-muted text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-stadium-accent" />
              <span>Analyzing live queues, incident priority, and entry trends...</span>
            </div>
          ) : (
            <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-200">
              {aiBriefing}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[10px] text-stadium-muted font-mono relative z-10 border-t border-stadium-border/30 pt-3">
          <AlertCircle className="w-3.5 h-3.5 text-stadium-accent" />
          <span>Note: This is real-time simulated telemetry. In production, this feed connects to digital turnstiles, CCTV crowd counters, and local law enforcement dispatch channels.</span>
        </div>
      </div>
    </div>
  );
};

export default OpsDashboard;
