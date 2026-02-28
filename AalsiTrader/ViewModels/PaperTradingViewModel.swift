import Foundation

@Observable
final class PaperTradingViewModel {
    var portfolio: PaperPortfolio?
    var trades: [PaperTrade] = []
    var metrics: PaperMetrics?
    var equityCurve: [EquityPoint] = []
    var approvals: [SigmaApproval] = []
    var mode: String = "paper"
    var autoTradingEnabled: Bool = false
    var requireSigmaApproval: Bool = true
    var modeEnabled: Bool = false

    var isLoading = false
    var error: String?
    var selectedTab: PaperTab = .portfolio

    var isLiveMode: Bool { mode == "live" }

    var openTrades: [PaperTrade] {
        trades.filter { $0.status == .open }
    }

    var closedTrades: [PaperTrade] {
        trades.filter { $0.status == .closed }
    }

    var pendingApprovals: [SigmaApproval] {
        approvals.filter { $0.status == .pending }
    }

    // MARK: - Data Loading

    func loadAll() async {
        isLoading = true
        error = nil
        do {
            async let p = PaperTradingService.fetchPortfolio(mode: mode)
            async let t = PaperTradingService.fetchTrades(mode: mode)
            async let m = PaperTradingService.fetchMetrics(mode: mode)
            async let e = PaperTradingService.fetchEquityCurve(mode: mode)
            async let a = PaperTradingService.fetchApprovals()

            let (portfolio, trades, metrics, curve, approvals) = try await (p, t, m, e, a)
            self.portfolio = portfolio
            self.trades = trades
            self.metrics = metrics
            self.equityCurve = curve
            self.approvals = approvals
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func approveSignal(_ tradeId: String) async {
        do {
            try await PaperTradingService.approveTradeSignal(tradeId)
            if let idx = approvals.firstIndex(where: { $0.tradeId == tradeId }) {
                approvals[idx].status = .approved
            }
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func rejectSignal(_ tradeId: String) async {
        do {
            try await PaperTradingService.rejectTradeSignal(tradeId)
            if let idx = approvals.firstIndex(where: { $0.tradeId == tradeId }) {
                approvals[idx].status = .rejected
            }
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    // MARK: - Mode Management

    func loadMode() async {
        do {
            let response = try await PaperTradingService.fetchMode()
            if let m = response.mode { self.mode = m }
            if let e = response.enabled { self.modeEnabled = e }
            if let a = response.autoTradingEnabled { self.autoTradingEnabled = a }
            if let s = response.requireSigmaApproval { self.requireSigmaApproval = s }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func setMode(_ newMode: String) async {
        do {
            let response = try await PaperTradingService.setMode(body: ["mode": newMode])
            if let m = response.mode { self.mode = m }
            if let e = response.enabled { self.modeEnabled = e }
            if let a = response.autoTradingEnabled { self.autoTradingEnabled = a }
            if let s = response.requireSigmaApproval { self.requireSigmaApproval = s }
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func toggleAutoTrading() async {
        do {
            let newValue = !autoTradingEnabled
            let response = try await PaperTradingService.setMode(body: ["autoTradingEnabled": newValue])
            if let a = response.autoTradingEnabled { self.autoTradingEnabled = a }
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func toggleSigmaApproval() async {
        do {
            let newValue = !requireSigmaApproval
            let response = try await PaperTradingService.setMode(body: ["requireSigmaApproval": newValue])
            if let s = response.requireSigmaApproval { self.requireSigmaApproval = s }
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    // MARK: - WebSocket handlers

    func setupWebSocket() {
        let ws = WebSocketManager.shared
        ws.onPaperTradeOpen = { [weak self] trade in
            self?.trades.insert(trade, at: 0)
            if let p = self?.portfolio {
                var updated = p
                updated.openPositions += 1
                self?.portfolio = updated
            }
            HapticService.impact(.medium)
        }

        ws.onPaperTradeClose = { [weak self] trade in
            if let idx = self?.trades.firstIndex(where: { $0.id == trade.id }) {
                self?.trades[idx] = trade
            }
            HapticService.impact(.light)
        }

        ws.onPaperPortfolioUpdate = { [weak self] portfolio in
            self?.portfolio = portfolio
        }
    }
}

enum PaperTab: String, CaseIterable {
    case portfolio = "Portfolio"
    case trades = "Trades"
    case rules = "Rules"
    case analytics = "Analytics"
    case approvals = "Approvals"
}
