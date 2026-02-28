import Foundation

@Observable
final class MarketDataViewModel {
    var indices: [MarketIndex] = []
    var marketOpen: Bool = false
    var isLoading = false
    var error: String?

    private var pollingTask: Task<Void, Never>?

    // MARK: - Data Loading

    func loadData() async {
        isLoading = indices.isEmpty
        do {
            let response = try await DashboardService.fetchMarketData()
            indices = response.indices ?? []
            marketOpen = response.marketOpen ?? false
            isLoading = false
            error = nil
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    // MARK: - Polling (30s interval)

    func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                await loadData()
                try? await Task.sleep(for: .seconds(30))
                guard !Task.isCancelled else { break }
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
