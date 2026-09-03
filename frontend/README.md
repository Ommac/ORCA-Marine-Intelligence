# ORCA Mobile Frontend – Marine Intelligence for Fishermen

A production-quality React Native (Expo SDK 57, TypeScript 6.0, React 19, React Native 0.86, Expo Router 57) mobile application for Indian fishermen, providing real-time Potential Fishing Zones (PFZ), Marine Weather forecasts, Small Vessel Advisories (SVAS), and coastal hazard alerts.

---

## Key Features

- **Persistent 4-Tab Navigation**: Home, Map, Alerts, Ask ORCA.
- **Fisherman-First UX**: High-contrast, large touch targets (52px+), simplified ocean terminology, designed for outdoor sunlight readability.
- **Solapur Demo Workflow**: Coastal location selector (presets & manual coordinates) $\rightarrow$ Date picker $\rightarrow$ Boat size selector $\rightarrow$ Single-tap Condition Check.
- **GeoJSON-Native Map Architecture**: MapLibre React Native integration supporting `MultiLineString` PFZ zones, fisherman point, nearest zone marker, distance route lines, and interactive popup callouts.
- **Strict Data Contracts**: Unified `OrcaResponse` contract consuming normalized REST API (`POST /api/orca/query`).
- **Offline / Mock Mode**: Fully functional with realistic test cases (Palghar & Ratnagiri scenarios) without requiring a running backend.

---

## Directory Structure

```
frontend/
├── app/
│   ├── _layout.tsx              # Root Stack navigation & status bar
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Persistent 4-tab bottom navigation
│   │   ├── index.tsx            # Home Screen (Location, Date, Boat Size, CTA)
│   │   ├── map.tsx              # Map Screen (PFZ geometry, markers, layers)
│   │   ├── alerts.tsx           # Alerts Screen (SVAS card & hazard bulletins)
│   │   └── ask.tsx              # Ask ORCA Screen (Conversational trip assistant)
│   └── assessment.tsx           # Pushed Detail Screen (RiskCard, PFZ, Marine grid, SVAS)
│
├── components/
│   ├── OrcaHeader.tsx           # Reusable header with INCOIS live indicator
│   ├── BottomTabBar.tsx         # Large, high-contrast bottom navigation bar
│   ├── LocationSelector.tsx     # Coastal presets & manual lat/lon modal
│   ├── DateSelector.tsx         # Fishing trip date selector
│   ├── BoatSizeSelector.tsx     # 4 boat category selector (<4m, 4-6m, 6-7m, 7m+)
│   ├── CheckConditionsButton.tsx# Primary CTA button with loading states
│   ├── RiskCard.tsx             # Large status card (SAFE, CAUTION, NOT_RECOMMENDED)
│   ├── PFZCard.tsx              # Nearest PFZ card with distance & direction
│   ├── MarineConditionsCard.tsx # Wind, waves, period, SST, current grid
│   ├── SVASCard.tsx             # Small Vessel Advisory banner
│   ├── HazardCard.tsx           # Cyclone, tsunami, surge & wave hazard checklist
│   ├── AlertCard.tsx            # Individual maritime alert cards
│   ├── MapView.tsx              # MapLibre native map & interactive fallback
│   ├── MapLegend.tsx            # Toggleable map layers and color legend
│   ├── LoadingState.tsx         # Multi-step checking progress indicator
│   ├── ErrorState.tsx           # User-friendly error card with retry
│   └── EmptyState.tsx           # Fallback for missing/empty data
│
├── services/
│   └── api.ts                   # Centralized API service (USE_MOCK_API & EXPO_PUBLIC_API_URL)
│
├── types/
│   └── orca.ts                  # TypeScript data interfaces
│
├── mocks/
│   └── orcaResponse.ts          # Realistic mock datasets (Palghar & Ratnagiri)
│
├── constants/
│   ├── locations.ts             # Coastal presets (Palghar, Ratnagiri, Mumbai, Goa, etc.)
│   └── theme.ts                 # High-contrast outdoor color palette & typography
│
├── utils/
│   ├── formatting.ts            # Fisherman-friendly string & unit formatters
│   ├── validation.ts            # Coordinate & input validators
│   └── mapAdapters.ts           # GeoJSON converters for MapLibre
│
├── package.json
├── app.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## Running Locally

### 1. Install Dependencies
```bash
cd frontend
npm install --legacy-peer-deps
```

### 2. Start the Development Server
```bash
npx expo start
```

- Press `w` to open in **Web browser** (interactive preview).
- Press `i` to launch in **iOS Simulator** (with development build).
- Press `a` to launch in **Android Emulator**.
- Scan the QR code with **Expo Go** or an Expo Dev Client.

### 3. Running TypeScript Type Checks
```bash
npm run ts:check
```

---

## API & Backend Integration

### Switching from Mock Mode to Live Backend

In `frontend/services/api.ts`:
```typescript
// Set to false to call the live backend
export const USE_MOCK_API = false;
```

Set your backend endpoint via `.env`:
```env
EXPO_PUBLIC_API_URL=https://your-backend-api.com
```

The app will execute `POST /api/orca/query` sending:
```json
{
  "latitude": 19.72,
  "longitude": 72.70,
  "date": "2026-09-03",
  "boat_width_m": 5.0,
  "query": "Check conditions for Palghar"
}
```
and strictly consumes the normalized `OrcaResponse` structure.
