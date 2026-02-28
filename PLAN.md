# Native SwiftUI iOS App - Implementation Plan

## Overview
Create a native SwiftUI iOS app (`AalsiTrader`) at `/Volumes/wininstall/AalsiTrader/` that connects to the existing AWS backend APIs. Core trading dashboard MVP.

## Architecture
- **Pattern**: MVVM with async/await
- **Min target**: iOS 17.0 (SwiftUI Charts, modern APIs)
- **Networking**: URLSession + Codable (no 3rd party deps for MVP)
- **Auth**: JWT stored in Keychain
- **Charts**: Swift Charts framework (built-in)
- **State**: @Observable (iOS 17 Observation framework)

## Project Location
- Xcode project: `/Volumes/wininstall/AalsiTrader/`
- Keeps heavy build artifacts off the main SSD

## Screens (MVP)

### 1. Login / Registration
- Email + password login
- JWT token management via Keychain
- Auto-login on app relaunch if token valid

### 2. Dashboard (Home)
- Market overview: Nifty, Bank Nifty, Sensex (from `/market-data`)
- Portfolio summary card (total P&L, margin used)
- Quick stats from `/stats`

### 3. Portfolio
- Tab: **Positions** - open positions with live P&L
- Tab: **Holdings** - long-term holdings
- Tab: **Margins** - available margin breakdown
- Data from `/broker-portfolio`

### 4. Trade History
- List of executed trades from `/paper-trades` and `/trades`
- Filter by date, symbol
- Trade detail view

### 5. Equity Curve
- Swift Charts line chart from `/paper-equity-curve`
- Metrics cards: Sharpe, Sortino, max drawdown from `/paper-metrics`

### 6. Settings
- Profile view (from `/auth/profile`)
- Broker connection status
- Zerodha login flow (via `/zerodha-login-url`)
- Dark/light mode toggle

## File Structure
```
AalsiTrader/
├── AalsiTrader.xcodeproj
├── AalsiTrader/
│   ├── App/
│   │   └── AalsiTraderApp.swift
│   ├── Models/
│   │   ├── User.swift
│   │   ├── Trade.swift
│   │   ├── Position.swift
│   │   ├── MarketData.swift
│   │   └── PortfolioMetrics.swift
│   ├── Services/
│   │   ├── APIClient.swift          (URLSession wrapper, JWT injection)
│   │   ├── AuthService.swift        (login, register, token refresh)
│   │   ├── KeychainService.swift    (secure token storage)
│   │   └── WebSocketService.swift   (real-time updates)
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift
│   │   ├── DashboardViewModel.swift
│   │   ├── PortfolioViewModel.swift
│   │   ├── TradesViewModel.swift
│   │   └── EquityCurveViewModel.swift
│   ├── Views/
│   │   ├── Auth/
│   │   │   ├── LoginView.swift
│   │   │   └── RegisterView.swift
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.swift
│   │   │   └── MarketCard.swift
│   │   ├── Portfolio/
│   │   │   ├── PortfolioView.swift
│   │   │   ├── PositionsTab.swift
│   │   │   ├── HoldingsTab.swift
│   │   │   └── MarginsTab.swift
│   │   ├── Trades/
│   │   │   ├── TradeListView.swift
│   │   │   └── TradeDetailView.swift
│   │   ├── EquityCurve/
│   │   │   └── EquityCurveView.swift
│   │   ├── Settings/
│   │   │   └── SettingsView.swift
│   │   └── Components/
│   │       ├── PnLBadge.swift
│   │       ├── StatCard.swift
│   │       └── LoadingView.swift
│   ├── Extensions/
│   │   ├── Color+Theme.swift
│   │   └── Date+Formatting.swift
│   └── Assets.xcassets/
├── AalsiTraderTests/
└── Preview Content/
```

## Implementation Steps

### Step 1: Create Xcode project & core infrastructure
- Create SwiftUI project at `/Volumes/wininstall/AalsiTrader/`
- Set up APIClient with base URL, JWT header injection, error handling
- KeychainService for secure token storage
- App-wide theme/colors matching web dark theme (#18181b)

### Step 2: Auth flow
- LoginView + RegisterView
- AuthViewModel handling login/register API calls
- Token persistence + auto-login
- Navigation to main app on success

### Step 3: Dashboard & Market Data
- DashboardView with market data cards
- Live Nifty/BankNifty/Sensex from `/market-data`
- Portfolio summary stats
- TabView navigation (Dashboard, Portfolio, Trades, Settings)

### Step 4: Portfolio screen
- Three-tab layout: Positions, Holdings, Margins
- Data from `/broker-portfolio` endpoint
- Color-coded P&L (green/red)

### Step 5: Trade History & Equity Curve
- Scrollable trade list with search/filter
- Swift Charts equity curve
- Performance metrics cards

### Step 6: Settings & Broker Connection
- Profile display
- Zerodha OAuth flow (open in SFSafariViewController)
- Broker status indicator

## API Endpoints Used
```
POST /auth/login              -> JWT token
POST /auth/register           -> Create account
GET  /auth/profile            -> User profile
GET  /market-data             -> Nifty, BankNifty, Sensex
GET  /stats                   -> Dashboard stats
GET  /broker-portfolio        -> Positions, Holdings, Margins
GET  /paper-trades            -> Trade history
GET  /paper-equity-curve      -> Equity chart data
GET  /paper-metrics           -> Sharpe, Sortino, etc.
GET  /zerodha-login-url       -> Broker OAuth
GET  /zerodha-status          -> Broker connectivity
WSS  wss://...                -> Real-time updates
```

## Theme
Match the web app's dark trading theme:
- Background: #18181b (zinc-900)
- Surface: #27272a (zinc-800)
- Accent: #a78bfa (violet-400)
- Profit: #4ade80 (green-400)
- Loss: #f87171 (red-400)
- Text: #fafafa (zinc-50)
