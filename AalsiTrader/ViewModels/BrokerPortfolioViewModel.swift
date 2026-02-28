import Foundation

@Observable
final class BrokerPortfolioViewModel {
    var portfolio: BrokerPortfolio?
    var isLoading = false
    var error: String?

    private var pollTimer: Timer?

    // MARK: - Computed Properties

    var needsSetup: Bool {
        portfolio?.needsBrokerSetup == true
    }

    var brokerName: String {
        portfolio?.broker?.capitalized ?? "Unknown"
    }

    var positions: [BrokerPosition] {
        portfolio?.positions ?? []
    }

    var holdings: [BrokerHolding] {
        portfolio?.holdings ?? []
    }

    var funds: BrokerFunds? {
        portfolio?.funds
    }

    var brokerError: String? {
        portfolio?.error
    }

    var hasPositions: Bool {
        !positions.isEmpty
    }

    var hasHoldings: Bool {
        !holdings.isEmpty
    }

    var totalPositionPnL: Double {
        positions.reduce(0) { $0 + $1.profit }
    }

    // MARK: - Data Loading

    func loadPortfolio() async {
        isLoading = true
        error = nil
        do {
            portfolio = try await BrokerPortfolioService.fetchPortfolio()
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    // MARK: - Polling

    func startPolling() {
        stopPolling()
        pollTimer = Timer.scheduledTimer(withTimeInterval: Constants.brokerPollInterval, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                await self.loadPortfolio()
            }
        }
    }

    func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }
}
