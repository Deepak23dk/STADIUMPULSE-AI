const fs = require('fs');
const path = require('path');

// Load static map to reference sections/gates
let stadiumMap = null;
try {
  const mapData = fs.readFileSync(path.join(__dirname, 'stadium_map.json'), 'utf8');
  stadiumMap = JSON.parse(mapData).stadium;
} catch (err) {
  console.error("Failed to load stadium_map.json in stadiumState.js:", err);
}

// Initial state
let state = {
  lastUpdated: new Date().toISOString(),
  weather: {
    temperature: "78°F / 25°C",
    condition: "Partly Cloudy",
    humidity: "62%",
    wind: "8 mph NE"
  },
  alertStatus: "Normal",
  matchState: {
    match: "Argentina vs France",
    score: "2 - 1",
    half: "Second Half",
    minute: 74,
    status: "Live"
  },
  gates: [
    { id: "A", name: "Gate A (MetLife Gate)", queueLength: 45, entryRate: 15, capacity: 50, waitTimeMinutes: 3 },
    { id: "B", name: "Gate B (Verizon Gate)", queueLength: 180, entryRate: 40, capacity: 60, waitTimeMinutes: 5 },
    { id: "C", name: "Gate C (HCLTech Gate)", queueLength: 290, entryRate: 35, capacity: 50, waitTimeMinutes: 8 },
    { id: "D", name: "Gate D (Bud Light Gate)", queueLength: 85, entryRate: 20, capacity: 45, waitTimeMinutes: 4 },
    { id: "E", name: "Gate E (Pepsi Gate)", queueLength: 120, entryRate: 30, capacity: 55, waitTimeMinutes: 4 }
  ],
  incidents: [
    {
      id: "inc-101",
      title: "Liquid spill blocking staircase",
      section: "Section 104",
      severity: "Low",
      status: "Responding",
      timestamp: new Date(Date.now() - 8 * 60000).toISOString() // 8 mins ago
    },
    {
      id: "inc-102",
      title: "Medical assistance requested (heat exhaustion)",
      section: "Section 112",
      severity: "Medium",
      status: "Active",
      timestamp: new Date(Date.now() - 3 * 60000).toISOString() // 3 mins ago
    }
  ]
};

// Start update loop (every 8 seconds)
setInterval(() => {
  state.lastUpdated = new Date().toISOString();

  // 1. Update Match minute
  if (state.matchState.status === "Live") {
    state.matchState.minute += 1;
    if (state.matchState.minute >= 90 + Math.floor(Math.random() * 5)) {
      state.matchState.minute = 90;
      state.matchState.status = "Completed";
    }
    // Random chance of goal
    if (Math.random() < 0.05) {
      const scores = state.matchState.score.split(" - ").map(Number);
      if (Math.random() > 0.5) scores[0] += 1;
      else scores[1] += 1;
      state.matchState.score = `${scores[0]} - ${scores[1]}`;
    }
  }

  // 2. Fluctuating Gate Queues (Random Walk)
  state.gates = state.gates.map(gate => {
    // entryRate is how many fans enter per minute.
    // Let's add some fluctuation to the queue length
    const change = Math.floor(Math.random() * 31) - 15; // -15 to +15
    let newQueue = Math.max(5, gate.queueLength + change);
    
    // During rush (e.g. Gate C), queue might grow
    if (gate.id === 'C' && Math.random() > 0.3) {
      newQueue = Math.min(400, newQueue + Math.floor(Math.random() * 15));
    }
    
    // Adjust entry rate based on queue density
    let newRate = gate.entryRate;
    if (newQueue > 150) {
      newRate = Math.min(gate.capacity, Math.floor(gate.capacity * 0.8) + Math.floor(Math.random() * 10));
    } else {
      newRate = Math.max(10, Math.floor(newQueue * 0.15) + Math.floor(Math.random() * 5));
    }

    // Wait time = queueLength / entryRate * (scale factor)
    // Wait time in minutes = Math.ceil(queueLength / (entryRate per minute))
    const waitTimeMinutes = Math.max(1, Math.ceil(newQueue / (newRate || 10)));

    return {
      ...gate,
      queueLength: newQueue,
      entryRate: newRate,
      waitTimeMinutes: waitTimeMinutes
    };
  });

  // 3. Incident Lifecycle Simulator
  // Occasionally resolve a responding incident
  state.incidents = state.incidents.map(inc => {
    if (inc.status === "Active" && Math.random() < 0.15) {
      return { ...inc, status: "Responding" };
    }
    if (inc.status === "Responding" && Math.random() < 0.1) {
      return { ...inc, status: "Resolved" };
    }
    return inc;
  });

  // Clear resolved incidents after 30 seconds
  state.incidents = state.incidents.filter(inc => {
    if (inc.status === "Resolved") {
      const resolvedAge = Date.now() - new Date(inc.timestamp).getTime();
      return resolvedAge < 30000;
    }
    return true;
  });

  // Small chance of generating a new incident (every 8s, ~5% chance)
  if (state.incidents.filter(i => i.status !== "Resolved").length < 4 && Math.random() < 0.08) {
    const titles = [
      { title: "Ticket scanner hardware malfunction", severity: "Medium", sections: ["Gate B", "Gate D", "Gate A"] },
      { title: "Minor altercation between supporters", severity: "Medium", sections: ["Section 130", "Section 224", "Section 108"] },
      { title: "Fan slipped on wet concourse floor", severity: "Low", sections: ["Section 122", "Section 140", "Section 218"] },
      { title: "Lost child reported near merchandise stand", severity: "Medium", sections: ["Section 118", "Section 134"] },
      { title: "Overcrowding pressure at entrance turnstiles", severity: "High", sections: ["Gate C", "Gate E"] }
    ];
    
    const randomTemplate = titles[Math.floor(Math.random() * titles.length)];
    const randomSec = randomTemplate.sections[Math.floor(Math.random() * randomTemplate.sections.length)];
    
    state.incidents.push({
      id: `inc-${Math.floor(Math.random() * 900) + 100}`,
      title: randomTemplate.title,
      section: randomSec,
      severity: randomTemplate.severity,
      status: "Active",
      timestamp: new Date().toISOString()
    });
  }

}, 8000);

function getStadiumState() {
  return state;
}

module.exports = {
  getStadiumState
};
