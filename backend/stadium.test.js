const { hasEmergencyKeywords, getRouteRecommendation, handleUserQuery, EMERGENCY_REPLY } = require('./orchestrator');
const { getStadiumState } = require('./stadiumState');

describe('StadiumPulse AI Safety & Incident Agent Rules', () => {
  test('detects emergency keywords correctly', () => {
    expect(hasEmergencyKeywords('I think I am having a heart attack')).toBe(true);
    expect(hasEmergencyKeywords('where can I get first aid?')).toBe(true);
    expect(hasEmergencyKeywords('the stadium is on fire! help!')).toBe(true);
    expect(hasEmergencyKeywords('what is the score of the match?')).toBe(false);
  });

  test('forces redirect to emergency services on critical input', async () => {
    const resultEn = await handleUserQuery('I have severe chest pain', 'en');
    expect(resultEn.response).toContain('contact venue security or call official emergency services');
    expect(resultEn.response).toContain('EMERGENCY');

    const resultEs = await handleUserQuery('¿dónde está la ayuda médica? me estoy desangrando', 'es');
    expect(resultEs.response).toContain('comuníquese con el personal de seguridad del estadio');
    expect(resultEs.response).toContain('EMERGENCIA');
  });
});

describe('StadiumPulse AI Wayfinding & Section Routing', () => {
  test('maps seating section 112 to closest gate and facilities', () => {
    const route = getRouteRecommendation('112');
    expect(route).not.toHaveProperty('error');
    expect(route.primaryGate.id).toBe('B'); // Gate B serves section 112
    expect(route.nearestRestroom.location).toBe('Section 112');
    expect(route.nearestMedical.location).toBe('Section 112');
  });

  test('maps seating section 124 correctly', () => {
    const route = getRouteRecommendation('124');
    expect(route.primaryGate.id).toBe('C'); // Gate C serves section 124
    expect(route.nearestRestroom.location).toBe('Section 122'); // Section 122 is closest to 124
  });

  test('returns error for invalid non-numeric sections', () => {
    const route = getRouteRecommendation('abc');
    expect(route).toHaveProperty('error');
  });
});

describe('StadiumPulse AI Simulated Data Layer', () => {
  test('in-memory state matches expected schema', () => {
    const state = getStadiumState();
    expect(state).toHaveProperty('weather');
    expect(state).toHaveProperty('gates');
    expect(state.gates.length).toBe(5);
    expect(state).toHaveProperty('incidents');
  });

  test('gate queues and wait times are bounded and valid', () => {
    const state = getStadiumState();
    state.gates.forEach(gate => {
      expect(gate.queueLength).toBeGreaterThanOrEqual(5);
      expect(gate.queueLength).toBeLessThanOrEqual(500);
      expect(gate.waitTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });
});
