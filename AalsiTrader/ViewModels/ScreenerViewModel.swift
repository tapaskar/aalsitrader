import Foundation

@Observable
final class ScreenerViewModel {
    var stocks: [SmartMoneyStock] = []
    var isLoading = false
    var error: String?

    var searchText = ""
    var signalFilter: StockSignal?
    var structureFilter: MarketStructure?
    var sortField: SortField = .confidence
    var sortAscending = false

    var chartData: [CandleData] = []
    var isLoadingChart = false

    // MARK: - Computed

    var filteredStocks: [SmartMoneyStock] {
        var result = stocks

        if !searchText.isEmpty {
            result = result.filter { $0.symbol.localizedCaseInsensitiveContains(searchText) }
        }
        if let signalFilter {
            result = result.filter { $0.signal == signalFilter }
        }
        if let structureFilter {
            result = result.filter { $0.structure == structureFilter }
        }

        return result.sorted { a, b in
            let comparison: Bool
            switch sortField {
            case .symbol: comparison = a.symbol < b.symbol
            case .price: comparison = a.price < b.price
            case .trendStrength: comparison = a.trendStrength < b.trendStrength
            case .confidence: comparison = a.confidence < b.confidence
            case .rsi: comparison = a.rsi < b.rsi
            case .momentum: comparison = (a.momentum5d ?? 0) < (b.momentum5d ?? 0)
            }
            return sortAscending ? comparison : !comparison
        }
    }

    var bullishCount: Int { stocks.filter { $0.signal == .BUY }.count }
    var bearishCount: Int { stocks.filter { $0.signal == .SELL }.count }
    var strongCount: Int { stocks.filter { $0.confidence >= 70 }.count }

    // MARK: - Actions

    func loadStocks(force: Bool = false) async {
        isLoading = true
        error = nil
        do {
            let response = try await ScreenerService.fetchStocks(force: force)
            stocks = response.stocks
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func loadChart(symbol: String) async {
        isLoadingChart = true
        do {
            chartData = try await ScreenerService.fetchChart(symbol: symbol)
            isLoadingChart = false
        } catch {
            isLoadingChart = false
        }
    }

    func clearFilters() {
        searchText = ""
        signalFilter = nil
        structureFilter = nil
    }
}

enum SortField: String, CaseIterable {
    case symbol = "Symbol"
    case price = "Price"
    case trendStrength = "Trend"
    case confidence = "Confidence"
    case rsi = "RSI"
    case momentum = "Momentum"
}
