const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { getStadiumState } = require('./stadiumState');

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Load static map
let stadiumMap = null;
try {
  const mapData = fs.readFileSync(path.join(__dirname, 'stadium_map.json'), 'utf8');
  stadiumMap = JSON.parse(mapData).stadium;
} catch (err) {
  console.error("Failed to load stadium_map.json:", err);
}

// ----------------------------------------------------
// Tool definitions / functions
// ----------------------------------------------------

function getLiveStadiumState() {
  return getStadiumState();
}

function getStaticStadiumMap() {
  return stadiumMap;
}

function getRouteRecommendation(targetSection) {
  if (!stadiumMap) return { error: "Stadium map not loaded" };

  const sectionNum = parseInt(targetSection, 10);
  if (isNaN(sectionNum)) {
    return { error: "Invalid section number. Please specify a number like 104 or 220." };
  }

  const liveState = getStadiumState();

  // Find nearest gate
  let bestGate = null;
  let minDistance = Infinity; // Simplistic representation: match nearest gate
  
  // Gate mapping by sections
  stadiumMap.gates.forEach(gate => {
    if (gate.sections.includes(sectionNum)) {
      bestGate = gate;
    }
  });

  // Fallback to closest gate by numerical sections mapping
  if (!bestGate) {
    let closestGate = stadiumMap.gates[0];
    let minSecDiff = Infinity;
    stadiumMap.gates.forEach(gate => {
      gate.sections.forEach(s => {
        const diff = Math.abs(s - sectionNum);
        if (diff < minSecDiff) {
          minSecDiff = diff;
          closestGate = gate;
        }
      });
    });
    bestGate = closestGate;
  }

  // Get live queue wait time for this gate
  const liveGate = liveState.gates.find(g => g.id === bestGate.id);
  const gateWaitTime = liveGate ? liveGate.waitTimeMinutes : 0;
  const gateQueueLength = liveGate ? liveGate.queueLength : 0;

  // Find nearest restroom
  let bestRestroom = null;
  let minRestroomDiff = Infinity;
  stadiumMap.restrooms.forEach(r => {
    const rSec = parseInt(r.location.replace("Section ", ""), 10);
    const diff = Math.abs(rSec - sectionNum);
    if (diff < minRestroomDiff) {
      minRestroomDiff = diff;
      bestRestroom = r;
    }
  });

  // Find nearest medical point
  let bestMedical = null;
  let minMedicalDiff = Infinity;
  stadiumMap.medical_points.forEach(m => {
    const mSec = parseInt(m.location.replace("Section ", ""), 10);
    const diff = Math.abs(mSec - sectionNum);
    if (diff < minMedicalDiff) {
      minMedicalDiff = diff;
      bestMedical = m;
    }
  });

  // Find nearest concessions
  let nearestConcessions = [];
  stadiumMap.concessions.forEach(c => {
    const cSec = parseInt(c.location.replace("Section ", ""), 10);
    const diff = Math.abs(cSec - sectionNum);
    nearestConcessions.push({ ...c, diff });
  });
  nearestConcessions.sort((a, b) => a.diff - b.diff);

  // Recommendations: Suggest alternative gate if current is heavily backlogged
  let altGateRecommendation = null;
  if (gateWaitTime > 5) {
    // Find gate with lowest wait time
    const sortedGates = [...liveState.gates].sort((a, b) => a.waitTimeMinutes - b.waitTimeMinutes);
    const lowestWaitGate = sortedGates[0];
    if (lowestWaitGate.id !== bestGate.id) {
      const staticGate = stadiumMap.gates.find(g => g.id === lowestWaitGate.id);
      altGateRecommendation = {
        id: lowestWaitGate.id,
        name: staticGate ? staticGate.name : lowestWaitGate.name,
        waitTimeMinutes: lowestWaitGate.waitTimeMinutes,
        reason: `Your primary gate (${bestGate.id}) has a ${gateWaitTime} min wait, while Gate ${lowestWaitGate.id} is only a ${lowestWaitGate.waitTimeMinutes} min wait.`
      };
    }
  }

  return {
    section: sectionNum,
    primaryGate: {
      id: bestGate.id,
      name: bestGate.name,
      queueLength: gateQueueLength,
      waitTimeMinutes: gateWaitTime
    },
    alternativeGate: altGateRecommendation,
    nearestRestroom: bestRestroom,
    nearestMedical: bestMedical,
    nearestConcessions: nearestConcessions.slice(0, 2).map(c => ({ name: c.name, cuisine: c.cuisine, location: c.location, menu: c.menu }))
  };
}

// ----------------------------------------------------
// Tool Definition for Gemini API
// ----------------------------------------------------
const tools = [
  {
    functionDeclarations: [
      {
        name: "getLiveStadiumState",
        description: "Returns the current live stadium metrics: gate queues, wait times, weather, alert status, and current match score."
      },
      {
        name: "getStaticStadiumMap",
        description: "Returns the static layout database containing all gates, concessions, restrooms, and medical points in MetLife Stadium."
      },
      {
        name: "getRouteRecommendation",
        description: "Provides customized wayfinding from a seating section to the nearest gate, restroom, concession, or first-aid point. Analyzes queue times to recommend less-congested alternatives.",
        parameters: {
          type: "OBJECT",
          properties: {
            targetSection: {
              type: "STRING",
              description: "The seating section number (e.g. '112', '204')."
            }
          },
          required: ["targetSection"]
        }
      }
    ]
  }
];

// ----------------------------------------------------
// Emergency Check Rules
// ----------------------------------------------------
const EMERGENCY_KEYWORDS = [
  "heart attack", "chest pain", "dying", "fire", "stroke", "bleeding", 
  "emergency", "first aid", "choking", "cpr", "breathing", "hurt", 
  "unconscious", "seizure", "wound", "doctor", "ambulance", "hospital",
  "paralysis", "broken bone", "burn",
  // Spanish terms
  "emergencia", "médico", "médica", "primeros auxilios", "herido", "ambulancia", 
  "fuego", "desangrando", "infarto", "dolor de pecho", "sangre", "ahogando",
  // French terms
  "urgence", "médical", "médicale", "blessé", "secours", "feu", "infarctus", 
  "arrêt cardiaque", "sang", "ambulance", "hôpital", "étouffement"
];

const EMERGENCY_REPLY = {
  en: "⚠️ EMERGENCY: If you or someone else is in immediate danger or needs medical attention, please contact venue security or call official emergency services immediately. You can find the nearest First Aid center at Section 112, Section 132, or Section 220.",
  es: "⚠️ EMERGENCIA: Si usted o alguien más está en peligro inmediato o necesita atención médica, comuníquese con el personal de seguridad del estadio o llame a los servicios de emergencia de inmediato. Puede encontrar el centro de Primeros Auxilios más cercano en la Sección 112, Sección 132 o Sección 220.",
  fr: "⚠️ URGENCE: Si vous ou quelqu'un d'autre êtes en danger immédiat ou avez besoin d'une assistance médicale, veuillez contacter la sécurité du stade ou appeler immédiatement les services d'urgence. Le centre de premiers secours le plus proche se trouve à la Section 112, Section 132 ou Section 220."
};

function hasEmergencyKeywords(text) {
  const normalized = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(keyword => normalized.includes(keyword));
}

// ----------------------------------------------------
// Orchestrator Query Handler
// ----------------------------------------------------
async function handleUserQuery(query, userLanguage = 'en', isOps = false) {
  const lang = ['en', 'es', 'fr'].includes(userLanguage.toLowerCase()) ? userLanguage.toLowerCase() : 'en';

  // 1. Input Safety Filter Check
  if (hasEmergencyKeywords(query)) {
    return {
      response: EMERGENCY_REPLY[lang],
      subAgentUsed: "Safety & Incident Agent (Safety Override)",
      groundedSource: "Safety Rules"
    };
  }

  // If Gemini API Key is missing, run in mock mode
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not defined. Using local fallback rule-based agent.");
    return handleLocalFallback(query, lang, isOps);
  }

  try {
    // 2. Set agent instructions based on whether it is fan-facing or staff-facing
    let systemInstruction = "";
    if (isOps) {
      systemInstruction = `You are the Ops Command Agent for StadiumPulse AI. You assist stadium operations staff by interpreting live state data (gates, incidents, weather) and making predictions or actionable recommendations.
      Make calculations about crowd rates and predict bottlenecks.
      If there is an active incident, focus on summarizing it and suggesting resources.
      Always respond in the language code requested: '${lang}'. Keep responses precise, bulleted, and professional.`;
    } else {
      systemInstruction = `You are the Fan Concierge Agent for the FIFA World Cup 2026 at MetLife Stadium. You assist fans with wayfinding, gate wait times, concession menus, and match info.
      
      CRITICAL SAFETY RULE: You are NEVER allowed to provide first-aid, medical, or safety rescue instructions under any circumstances. If the user asks for medical help, instructions on treating an injury, or indicates an emergency, you must immediately decline and instruct them to contact stadium security or call official emergency services, pointing out the First Aid points (Section 112, 132, 220).
      
      Always ground your response in the tools provided:
      - Use getRouteRecommendation for wayfinding to seating sections. Always mention specific wait times (e.g. 'Gate A wait time: 3 mins') when advising routes.
      - Use getLiveStadiumState for live match scores, weather, and general gate queues.
      - Use getStaticStadiumMap for concessions and restroom locations.
      
      Always respond in the requested language code: '${lang}'. Be friendly, welcoming, and concise.`;
    }

    // 3. Initiate the Gemini call
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        temperature: 0.1 // Keep it grounded and consistent
      }
    });

    let functionCalls = response.functionCalls || [];
    let toolResponses = [];

    // Handle tool execution loop (up to 2 iterations for simplicity)
    if (functionCalls.length > 0) {
      for (const call of functionCalls) {
        const { name, args } = call;
        let functionResult;

        console.log(`[Orchestrator] Executing tool: ${name} with args:`, args);

        if (name === "getLiveStadiumState") {
          functionResult = getLiveStadiumState();
        } else if (name === "getStaticStadiumMap") {
          functionResult = getStaticStadiumMap();
        } else if (name === "getRouteRecommendation") {
          functionResult = getRouteRecommendation(args.targetSection);
        }

        toolResponses.push({
          functionResponse: {
            name: name,
            response: functionResult
          }
        });
      }

      // Send the tool results back to Gemini to get the final grounded answer
      const finalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: query }] },
          response.candidates[0].content, // contains the tool call request
          { role: 'user', parts: toolResponses } // contains the tool execution result
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1
        }
      });

      let finalAnswer = finalResponse.text || "";

      // 4. Output Safety Filter Check (double guardrail)
      if (hasEmergencyKeywords(finalAnswer)) {
        return {
          response: EMERGENCY_REPLY[lang],
          subAgentUsed: "Safety & Incident Agent (Safety Override Filter)",
          groundedSource: "Safety Rules"
        };
      }

      return {
        response: finalAnswer,
        subAgentUsed: functionCalls.map(c => c.name).join(", "),
        groundedSource: "Gemini Model Grounded Output"
      };
    } else {
      let directAnswer = response.text || "";
      if (hasEmergencyKeywords(directAnswer)) {
        return {
          response: EMERGENCY_REPLY[lang],
          subAgentUsed: "Safety & Incident Agent (Safety Override Filter)",
          groundedSource: "Safety Rules"
        };
      }
      return {
        response: directAnswer,
        subAgentUsed: "Central Orchestrator (Direct Match)",
        groundedSource: "Knowledge Base"
      };
    }

  } catch (error) {
    console.error("Gemini Orchestration failed:", error);
    return {
      response: lang === 'es' ? "Lo siento, experimentamos un error al procesar su solicitud. Intente de nuevo." :
                lang === 'fr' ? "Désolé, nous avons rencontré une erreur. Veuillez réessayer." :
                "Sorry, we encountered an error processing your request. Please try again.",
      subAgentUsed: "Error Fallback",
      groundedSource: "System Error"
    };
  }
}

// ----------------------------------------------------
// Local rule-based fallback when API key is missing
// ----------------------------------------------------
function handleLocalFallback(query, lang, isOps) {
  const queryLower = query.toLowerCase();
  const state = getStadiumState();

  if (isOps) {
    // Basic ops brief generation in local mode
    let brief = "";
    if (lang === 'es') {
      brief = "**Resumen de Operaciones (Modo de Respaldo Local)**:\n";
      state.gates.forEach(g => {
        if (g.queueLength > 150) {
          brief += `- ⚠️ Alerta: La ${g.name} supera la capacidad cómoda con ${g.queueLength} personas. Tiempo de espera actual: ${g.waitTimeMinutes} min. Se recomienda habilitar desvíos.\n`;
        }
      });
      if (state.incidents.length > 0) {
        brief += `- Hay ${state.incidents.length} incidentes activos en resolución.\n`;
      }
    } else if (lang === 'fr') {
      brief = "**Résumé des opérations (Mode Local)** :\n";
      state.gates.forEach(g => {
        if (g.queueLength > 150) {
          brief += `- ⚠️ Alerte: La ${g.name} dépasse la capacité avec ${g.queueLength} personnes. Attente: ${g.waitTimeMinutes} min.\n`;
        }
      });
      if (state.incidents.length > 0) {
        brief += `- Il y a ${state.incidents.length} incidents actifs en cours de traitement.\n`;
      }
    } else {
      brief = "**Operations Summary (Local Fallback Mode)**:\n";
      state.gates.forEach(g => {
        if (g.queueLength > 150) {
          brief += `- ⚠️ Alert: ${g.name} is congested with ${g.queueLength} fans. Wait time: ${g.waitTimeMinutes} min. Suggest opening adjacent lanes.\n`;
        }
      });
      const activeIncs = state.incidents.filter(i => i.status !== 'Resolved');
      if (activeIncs.length > 0) {
        brief += `- Active Incidents: ${activeIncs.map(i => `${i.title} at ${i.section}`).join(', ')}.\n`;
      } else {
        brief += `- No severe active incidents at this moment.\n`;
      }
    }
    return {
      response: brief,
      subAgentUsed: "Crowd & Incident Local Rules",
      groundedSource: "In-memory state"
    };
  }

  // Fan local routing
  let reply = "";
  let subAgent = "Fan Info Local Rules";

  // Section match
  const sectionMatch = queryLower.match(/section\s+(\d+)/) || queryLower.match(/sección\s+(\d+)/) || queryLower.match(/section\s+(\d+)/);
  if (sectionMatch) {
    subAgent = "Wayfinding Local Rules";
    const sec = sectionMatch[1];
    const recommendation = getRouteRecommendation(sec);
    if (recommendation.error) {
      reply = recommendation.error;
    } else {
      if (lang === 'es') {
        reply = `Para la **Sección ${sec}**, use la **${recommendation.primaryGate.name}** (Espera: ${recommendation.primaryGate.waitTimeMinutes} min). `;
        if (recommendation.alternativeGate) {
          reply += `⚠️ Atención: la puerta principal está congestionada. Se recomienda usar la **${recommendation.alternativeGate.name}** (${recommendation.alternativeGate.waitTimeMinutes} min de espera). `;
        }
        if (recommendation.nearestRestroom) {
          reply += `Baño más cercano: **${recommendation.nearestRestroom.location}**. `;
        }
        if (recommendation.nearestMedical) {
          reply += `Punto médico: **${recommendation.nearestMedical.name}** en ${recommendation.nearestMedical.location}. `;
        }
      } else if (lang === 'fr') {
        reply = `Pour la **Section ${sec}**, veuillez utiliser la **${recommendation.primaryGate.name}** (Attente: ${recommendation.primaryGate.waitTimeMinutes} min). `;
        if (recommendation.alternativeGate) {
          reply += `⚠️ Attention: la porte principale est chargée. Nous conseillons la **${recommendation.alternativeGate.name}** (${recommendation.alternativeGate.waitTimeMinutes} min d'attente). `;
        }
        if (recommendation.nearestRestroom) {
          reply += `Toilettes les plus proches: **${recommendation.nearestRestroom.location}**. `;
        }
      } else {
        reply = `For **Section ${sec}**, your best entry point is **${recommendation.primaryGate.name}** (Current wait time: ${recommendation.primaryGate.waitTimeMinutes} min). `;
        if (recommendation.alternativeGate) {
          reply += `⚠️ Warning: your primary gate is backed up. We recommend using **${recommendation.alternativeGate.name}** (only ${recommendation.alternativeGate.waitTimeMinutes} min wait). `;
        }
        if (recommendation.nearestRestroom) {
          reply += `Nearest restrooms: near **${recommendation.nearestRestroom.location}**. `;
        }
        if (recommendation.nearestMedical) {
          reply += `First Aid: **${recommendation.nearestMedical.name}** located at ${recommendation.nearestMedical.location}. `;
        }
        if (recommendation.nearestConcessions.length > 0) {
          reply += `Food nearby: **${recommendation.nearestConcessions[0].name}** at ${recommendation.nearestConcessions[0].location}.`;
        }
      }
    }
  } else if (queryLower.includes("wait") || queryLower.includes("queue") || queryLower.includes("cola") || queryLower.includes("attente")) {
    subAgent = "Wayfinding/Queues Local Rules";
    if (lang === 'es') {
      reply = "Tiempos de espera actuales de las puertas:\n" + state.gates.map(g => `- ${g.name}: ${g.waitTimeMinutes} min (${g.queueLength} personas)`).join("\n");
    } else if (lang === 'fr') {
      reply = "Temps d'attente actuels des portes:\n" + state.gates.map(g => `- ${g.name}: ${g.waitTimeMinutes} min (${g.queueLength} personnes)`).join("\n");
    } else {
      reply = "Current gate queue wait times:\n" + state.gates.map(g => `- ${g.name}: ${g.waitTimeMinutes} mins (${g.queueLength} fans waiting)`).join("\n");
    }
  } else if (queryLower.includes("food") || queryLower.includes("eat") || queryLower.includes("comida") || queryLower.includes("manger") || queryLower.includes("beer") || queryLower.includes("cerveza")) {
    subAgent = "Fan Info Local Rules";
    if (lang === 'es') {
      reply = "Concesiones de comida populares:\n" + stadiumMap.concessions.map(c => `- **${c.name}** (${c.cuisine}) en la ${c.location}: ${c.menu.join(", ")}`).join("\n");
    } else if (lang === 'fr') {
      reply = "Points de restauration populaires:\n" + stadiumMap.concessions.map(c => `- **${c.name}** (${c.cuisine}) à la ${c.location}: ${c.menu.join(", ")}`).join("\n");
    } else {
      reply = "Popular food stands at MetLife Stadium:\n" + stadiumMap.concessions.map(c => `- **${c.name}** (${c.cuisine}) at ${c.location}. Menu: ${c.menu.join(", ")}`).join("\n");
    }
  } else if (queryLower.includes("score") || queryLower.includes("match") || queryLower.includes("partido") || queryLower.includes("schedule")) {
    subAgent = "Fan Info Local Rules";
    const m = state.matchState;
    if (lang === 'es') {
      reply = `Partido actual: **${m.match}** (${m.status}). Marcador: **${m.score}**, Minuto: **${m.minute}'** (${m.half}).`;
    } else if (lang === 'fr') {
      reply = `Match en cours: **${m.match}** (${m.status}). Score: **${m.score}**, Minute: **${m.minute}'** (${m.half}).`;
    } else {
      reply = `Current Match: **${m.match}** (${m.status}). Score: **${m.score}**, Minute: **${m.minute}'** (${m.half}).`;
    }
  } else {
    if (lang === 'es') {
      reply = "¡Hola! Bienvenido al asistente de MetLife Stadium para la Copa Mundial de la FIFA 2026. Pregúntame sobre accesos a secciones (ej: 'Sección 114'), tiempos de cola de las puertas, concesiones de comida o marcadores en vivo.";
    } else if (lang === 'fr') {
      reply = "Bonjour! Bienvenue au copilote de MetLife Stadium pour la Coupe du Monde de la FIFA 2026. Posez-moi des questions sur les sections (ex: 'Section 114'), les temps d'attente des portes, ou le score du match.";
    } else {
      reply = "Hello! Welcome to the MetLife Stadium Assistant for the FIFA World Cup 2026. Ask me about wayfinding to sections (e.g., 'Section 114'), gate wait times, food concessions, or the live match score.";
    }
  }

  return {
    response: reply,
    subAgentUsed: subAgent,
    groundedSource: "Local JSON/State"
  };
}

module.exports = {
  handleUserQuery,
  getRouteRecommendation,
  hasEmergencyKeywords,
  EMERGENCY_REPLY
};
