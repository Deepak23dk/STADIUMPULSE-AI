import React, { useState, useRef, useEffect } from 'react';
import { Send, MapPin, Coffee, HelpCircle, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { API_BASE } from '../App';
import type { StadiumState } from '../App';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  language: string;
  subAgentUsed?: string;
  groundedSource?: string;
  timestamp: Date;
}

interface FanConciergeProps {
  stadiumState: StadiumState | null;
}

const FanConcierge: React.FC<FanConciergeProps> = ({ stadiumState }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Welcome to the MetLife Stadium FIFA World Cup 2026 Concierge! Ask me anything about wayfinding, restrooms, food stands, or live gate queue wait times. Try asking: 'Where is Section 112?' or 'How long is the wait at Gate C?'",
      language: 'en',
      subAgentUsed: "System Welcome",
      groundedSource: "FAQ Knowledge Base",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState<'en' | 'es' | 'fr'>('en');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLanguageChange = (lang: 'en' | 'es' | 'fr') => {
    setLanguage(lang);
    
    // Add translation welcome message
    let welcomeMsg = "";
    if (lang === 'es') {
      welcomeMsg = "¡Bienvenido al Asistente del Estadio MetLife para la Copa Mundial de la FIFA 2026! Pregúntame sobre accesos, baños, comida o colas. Intenta: '¿Dónde está la Sección 112?' o '¿Cuánto se espera en la Puerta C?'";
    } else if (lang === 'fr') {
      welcomeMsg = "Bienvenue au copilote de MetLife Stadium pour la Coupe du Monde de la FIFA 2026 ! Posez-moi des questions sur les portes, toilettes, poutines ou scores. Exemple : 'Où se trouve la Section 112 ?'";
    } else {
      welcomeMsg = "Welcome to the MetLife Stadium FIFA World Cup 2026 Concierge! Ask me anything about wayfinding, restrooms, food stands, or live gate queue wait times. Try asking: 'Where is Section 112?' or 'How long is the wait at Gate C?'";
    }

    setMessages(prev => [
      ...prev,
      {
        id: `lang-change-${Date.now()}`,
        sender: 'bot',
        text: welcomeMsg,
        language: lang,
        subAgentUsed: "Language System Router",
        groundedSource: "System config",
        timestamp: new Date()
      }
    ]);
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const queryText = (customText || inputText).trim();
    if (!queryText || isSending) return;

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      language: language,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, language: language, isOps: false })
      });

      if (!res.ok) {
        throw new Error("Chat service error");
      }

      const data = await res.json();
      
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.response,
        language: language,
        subAgentUsed: data.subAgentUsed,
        groundedSource: data.groundedSource,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      
      let errorMsg = "Sorry, I am having trouble connecting to the tournament service. Please try again.";
      if (language === 'es') errorMsg = "Lo siento, tengo problemas para conectarme al servicio. Intente de nuevo.";
      if (language === 'fr') errorMsg = "Désolé, problème de connexion avec le service du tournoi. Veuillez réessayer.";

      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: errorMsg,
          language: language,
          subAgentUsed: "System Fallback Rules",
          groundedSource: "Static Local Rules",
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Helper for quick suggestion cards
  const suggestions = {
    en: [
      { text: "Where is Section 112?", label: "Section 112 Info", icon: <MapPin className="w-3.5 h-3.5" /> },
      { text: "How long is the wait at Gate C?", label: "Gate C queues", icon: <Clock className="w-3.5 h-3.5" /> },
      { text: "Where can I get tacos?", label: "Find food", icon: <Coffee className="w-3.5 h-3.5" /> },
      { text: "What is the match score?", label: "Match Score", icon: <HelpCircle className="w-3.5 h-3.5" /> }
    ],
    es: [
      { text: "¿Dónde está la Sección 114?", label: "Info Sección 114", icon: <MapPin className="w-3.5 h-3.5" /> },
      { text: "¿Cuál es el tiempo de espera en la Puerta B?", label: "Cola Puerta B", icon: <Clock className="w-3.5 h-3.5" /> },
      { text: "¿Dónde venden comida vegetariana?", label: "Comida vegetariana", icon: <Coffee className="w-3.5 h-3.5" /> },
      { text: "¿Cuál es el marcador?", label: "Marcador en vivo", icon: <HelpCircle className="w-3.5 h-3.5" /> }
    ],
    fr: [
      { text: "Où se trouve la Section 124?", label: "Section 124 Info", icon: <MapPin className="w-3.5 h-3.5" /> },
      { text: "Attente aux files d'attente?", label: "Vérifier files", icon: <Clock className="w-3.5 h-3.5" /> },
      { text: "Où manger de la poutine?", label: "Trouver de la poutine", icon: <Coffee className="w-3.5 h-3.5" /> },
      { text: "Quel est le score?", label: "Score du match", icon: <HelpCircle className="w-3.5 h-3.5" /> }
    ]
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-950/40 relative">
        {/* Language & Header controls */}
        <div className="bg-stadium-card/60 border-b border-stadium-border px-6 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-stadium-accent animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider font-mono text-stadium-accent">Copilot Active</span>
          </div>

          <div className="flex rounded-md bg-black/40 p-1 border border-stadium-border" role="tablist">
            {(['en', 'es', 'fr'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                role="tab"
                aria-selected={language === lang}
                className={`px-3 py-1 text-xs rounded transition-all uppercase font-semibold ${
                  language === lang
                    ? 'bg-stadium-accent text-slate-950 font-bold'
                    : 'text-stadium-muted hover:text-white'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 glow-bg" role="log" aria-live="polite">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isBot ? 'self-start' : 'self-end ml-auto'}`}
              >
                <div
                  className={`p-4 rounded-xl shadow-md border ${
                    isBot
                      ? 'bg-stadium-card/90 border-stadium-border text-stadium-text rounded-tl-none'
                      : 'bg-stadium-accent/15 border-stadium-accent text-stadium-text rounded-tr-none glow-border'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Grounding metadata for LLM-verified outputs */}
                {isBot && msg.subAgentUsed && (
                  <div className="flex items-center gap-2 mt-1.5 px-1 text-[10px] text-stadium-muted font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-stadium-accent shrink-0" />
                    <span>Agent: <strong className="text-stadium-accent">{msg.subAgentUsed}</strong></span>
                    <span>• Source: <span className="text-white">{msg.groundedSource}</span></span>
                  </div>
                )}
              </div>
            );
          })}
          {isSending && (
            <div className="self-start flex flex-col max-w-[70%]">
              <div className="bg-stadium-card/90 border border-stadium-border p-4 rounded-xl rounded-tl-none flex items-center gap-2 text-stadium-muted text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stadium-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-stadium-accent"></span>
                </span>
                <span>Copilot is searching tournament data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-6 py-2 flex flex-wrap gap-2 bg-black/10">
          {suggestions[language].map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(undefined, s.text)}
              className="flex items-center gap-1.5 text-xs bg-stadium-card hover:bg-stadium-border border border-stadium-border hover:border-stadium-accent px-3 py-1.5 rounded-full text-stadium-text transition-all duration-200"
              aria-label={`Ask suggestion: ${s.label}`}
            >
              {s.icon}
              <span>{s.text}</span>
            </button>
          ))}
        </div>

        {/* Chat Input Field */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-stadium-border bg-stadium-card flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              language === 'es' ? "Pregunte por accesos, baños, comida..." :
              language === 'fr' ? "Poser des questions sur les portes, poutines..." :
              "Ask about routes, gates, wait times, food..."
            }
            disabled={isSending}
            className="flex-1 bg-black/40 border border-stadium-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-stadium-accent text-white placeholder-stadium-muted disabled:opacity-50"
            aria-label="Chat query input"
          />
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="bg-stadium-accent text-slate-950 p-3 rounded-lg hover:bg-cyan-400 focus:outline-none transition-all duration-200 shadow-md disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Right Sidebar: Real-Time Gate Monitor for Quick Reference */}
      <div className="w-full md:w-80 bg-stadium-card/45 border-t md:border-t-0 md:border-l border-stadium-border p-5 flex flex-col shrink-0 overflow-y-auto">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stadium-accent mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>Live Gate Status</span>
        </h2>

        {stadiumState ? (
          <div className="space-y-4">
            {stadiumState.gates.map((g) => {
              const isCongested = g.queueLength > 150;
              return (
                <div
                  key={g.id}
                  className={`p-3.5 rounded-lg border bg-stadium-card shadow-sm transition-all duration-300 ${
                    isCongested ? 'border-stadium-danger/40 bg-stadium-danger/5' : 'border-stadium-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-white tracking-wide">{g.name}</span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                        isCongested
                          ? 'bg-stadium-danger/25 text-stadium-danger border border-stadium-danger/30'
                          : 'bg-stadium-accent/25 text-stadium-accent border border-stadium-accent/30'
                      }`}
                    >
                      {isCongested ? 'Congested' : 'Normal'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-stadium-muted block text-[10px] uppercase">Wait Time</span>
                      <strong className={isCongested ? 'text-stadium-danger text-sm font-bold' : 'text-white text-sm'}>
                        {g.waitTimeMinutes} mins
                      </strong>
                    </div>
                    <div>
                      <span className="text-stadium-muted block text-[10px] uppercase">Queue Size</span>
                      <strong className="text-white text-sm">{g.queueLength} fans</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-stadium-muted font-mono">
            Connecting to gate feeds...
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-black/30 border border-stadium-border text-xs leading-relaxed text-stadium-muted">
          <h3 className="font-bold text-white mb-1.5 uppercase font-mono tracking-wider">💡 Concierge Tips</h3>
          <p>You can ask for the fastest entrance gate. The sub-agents automatically compare gate wait times and suggest alternative routes to avoid bottleneck congestion.</p>
        </div>
      </div>
    </div>
  );
};

export default FanConcierge;
