# StadiumPulse AI — Smart Stadium & Tournament Operations Copilot

StadiumPulse AI is a dual-sided GenAI copilot designed for a World Cup 2026 stadium (MetLife Stadium) to optimize tournament operations and enhance the fan experience through intelligent, real-time assistance.

This is a fully working, deployable submission for the GenAI Hackathon Challenge.

---

## 🏟️ Product Concept & Core Features

1. **Fan Concierge Chat (Experience Enhancement)**
   - Text chat assistant for stadium wayfinding (sections, concessions, restrooms, first aid).
   - Real-time gate wait times integrated to suggest the fastest entry and exit routes.
   - Multilingual support for English, Spanish, and French, with automatic sub-agent usage and grounding citations.
   - **Emergency Guardrail**: Input and output filters that detect medical or safety emergencies, immediately intercepting and routing the user to official emergency services and First Aid centers.

2. **Ops Command Dashboard (Operations Optimization)**
   - Real-time visual telemetry of gate queues (SVG-based bar chart with tooltips).
   - Live Active Incident feed tracking emergency requests, liquid spills, and turnstile issues.
   - **GenAI Operations Briefing**: Periodic summary of stadium telemetry compiled by the orchestrator, giving prioritized guidance (e.g., advising staff to route traffic from Gate C to Gate A or dispatch cleaning crews to Section 104).

---

## 🏗️ Architecture

```
                       ┌────────────────────────────────────────┐
                       │           FAN CONCIERGE CHAT           │
                       └───────────────────┬────────────────────┘
                                           │ (API POST /api/chat)
                                           ▼
┌──────────────────┐   ┌────────────────────────────────────────┐   ┌───────────────────────────┐
│  OPS DASHBOARD   ├──►│      CENTRAL AGENT ORCHESTRATOR        │◄──┤  SIMULATED REAL-TIME DATA │
└──────────────────┘   │     (Google Gemini LLM Router)         │   │   (Interval Simulator)    │
                       └───────────┬─────┬──────────┬───────────┘   └───────────────────────────┘
                                   │     │          │
                                   ▼     ▼          ▼
                       ┌─────────────┐┌─────────┐┌──────────────┐
                       │ Wayfinding  ││ Safety  ││ Crowd/Congest│
                       │   Agent     ││  Agent  ││    Agent     │
                       └─────────────┘└─────────┘└──────────────┘
```

### 1. Simulated Real-Time Data Layer
Exposes gate telemetry and incidents via a REST API. The in-memory interval loop updates values every 8 seconds, simulating live stadium telemetry.

* **Production Integration Replacement**: In a live stadium, this layer would connect directly to turnstile counters (e.g., Skidata, ticket scanners), CCTV crowd density analytics (computer vision), and local dispatch systems (CAD).

### 2. Central Agent Orchestrator
Uses the Google Gemini API (`gemini-2.5-flash`) with Function Calling (Tools) to route requests to specialized agents:
- **Wayfinding Agent**: Evaluates seating sections and returns closest gates, restrooms, food, and first aid points, calculating wait-time alternatives.
- **Safety & Incident Agent**: Checks current system incidents. Enforces the emergency override guardrails.
- **Crowd & Congestion Agent**: Calculates gate rates and predicts bottleneck congestion for the Ops briefing.
- **Fan Info Agent**: Inspects concessions and match details.

---

## ⚙️ Environment & Deployment

The codebase includes configuration files for local development and cloud hosting platforms.

### Environment Variables
Refer to the [.env.example](file:///.env.example) file in the root directory:
* `PORT`: (Optional) The port the backend server listens on (defaults to `5000`).
* `GEMINI_API_KEY`: The API key to connect to Google Gemini. If missing, the app defaults to a local rule-based system.

### 🚂 Deploying to Railway (Recommended)
This repository is configured to deploy automatically on Railway using Nixpacks.
1. Create a [Railway](https://railway.app) account and connect your GitHub repository.
2. Select **New Project** → **Deploy from GitHub repo** → Choose `STADIUMPULSE-AI`.
3. In the project dashboard, go to the **Variables** tab and add:
   * `GEMINI_API_KEY` = *[Your actual Google Gemini key]*
4. Nixpacks will auto-detect the root `package.json` (using [railway.json](file:///railway.json)), install all sub-dependencies, build the frontend statically, and launch the backend.
5. Once deployed, Railway generates a public URL (found in the settings tab).

### 🚀 Deploying to Render
1. Create a [Render](https://render.com) account and connect your GitHub repository.
2. Create a new **Web Service** and choose `STADIUMPULSE-AI`.
3. Set the following details:
   * **Runtime**: `Node`
   * **Build Command**: `npm run build`
   * **Start Command**: `npm start`
4. Under **Advanced**, add the environment variable `GEMINI_API_KEY`.
5. Trigger deploy.

> [!NOTE]
> **Free Tier Sleep/Cold Starts**: If you deploy on Render's free tier, the service will "sleep" after 15 minutes of inactivity. The first request after a sleep period can experience a 50-60 second "cold start" delay. On Railway, this behavior does not exist on developer/paid tiers, but on hobby plans, check current limits. If the page loads slowly on initial visit, please wait 1 minute for the container to wake up.

---

## 🚀 Setup & Execution Instructions

Ensure you have **Node.js (LTS)** and **npm** installed.

### 1. Install Dependencies
Run from the root directory:
```bash
npm run install-all
```

### 2. Start the Backend API Server
```bash
npm run dev:backend
```
The server will run on `http://localhost:5000`.

### 3. Start the Frontend Client
```bash
npm run dev:frontend
```
The Vite development client will run on `http://localhost:5173`. Open it in your browser.

### 4. Build for Production
To package the app so the Express server serves the static built frontend assets:
```bash
npm run build:prod
npm start
```
Open `http://localhost:5000`.

---

## 🧪 Running the Test Suite

We use Jest to run unit tests. These test:
- **Safety override rules**: Asserts that asking for medical/first aid advice in multiple languages immediately intercepts the query and defers to stadium security.
- **Wayfinding logic**: Asserts that mapping a section returns correct nearby facility details.
- **Simulated data bounds**: Asserts that in-memory values update correctly and stay within expected ranges.

To execute tests, run from the root:
```bash
npm run test
```

---

## ♿ Accessibility Notes (WCAG AA Compliance)

A manual keyboard-only navigation audit was performed along with browser accessibility tests:
- **Semantic HTML**: Proper use of `<header>`, `<main>`, `<nav>`, `<section>`, and `<footer>` tags.
- **Icon Controls**: Icon buttons feature explicit labels (`aria-label`) for screen readers.
- **Keyboard Navigation**: The chat input, tab buttons, theme controls, and SVG chart elements are fully reachable using standard `Tab` / `Shift+Tab` and triggerable using `Enter` / `Space`.
- **Visible Focus States**: Custom blue-cyan focus outline (`focus-visible`) styled for all interactive elements.
- **Motion Reduction**: Integrates `@media (prefers-reduced-motion: reduce)` to disable layout transitions and keyframe animations for users with motion sensitivities.
- **Color Contrast**: Color palette uses slate-950, slate-900, slate-800, and gray-100/slate-200 text with emerald and cyan highlights meeting WCAG AA standards.
