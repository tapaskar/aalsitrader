import Foundation

@Observable
final class StraddleViewModel {
    var status: EngineStatus?
    var capital: StraddleCapital?
    var position: StraddlePosition?
    var trades: [StraddleTrade] = []

    var isLoading = false
    var error: String?
    var isPerformingAction = false

    var dateFrom: Date = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
    var dateTo: Date = Date()

    private var pollingTask: Task<Void, Never>?

    var isEngineRunning: Bool {
        status?.engine.running ?? false
    }

    var currentMode: TradingMode {
        status?.engine.mode ?? .paper
    }

    // MARK: - Data Loading

    func loadAll() async {
        isLoading = true
        error = nil
        do {
            async let s = StraddleService.fetchStatus()
            async let c = StraddleService.fetchCapital()
            async let p = StraddleService.fetchPosition()
            async let t = StraddleService.fetchTrades(
                from: dateFrom.istFormatted("yyyy-MM-dd"),
                to: dateTo.istFormatted("yyyy-MM-dd")
            )

            let (status, capital, position, trades) = try await (s, c, p, t)
            self.status = status
            self.capital = capital
            self.position = position
            self.trades = trades
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func loadTrades() async {
        do {
            trades = try await StraddleService.fetchTrades(
                from: dateFrom.istFormatted("yyyy-MM-dd"),
                to: dateTo.istFormatted("yyyy-MM-dd")
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Engine Controls

    func startEngine() async {
        isPerformingAction = true
        do {
            _ = try await StraddleService.startEngine()
            await refreshStatus()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
        isPerformingAction = false
    }

    func stopEngine() async {
        isPerformingAction = true
        do {
            _ = try await StraddleService.stopEngine()
            await refreshStatus()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
        isPerformingAction = false
    }

    func setMode(_ mode: TradingMode) async {
        isPerformingAction = true
        do {
            _ = try await StraddleService.setMode(mode)
            await refreshStatus()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
        isPerformingAction = false
    }

    private func refreshStatus() async {
        do {
            status = try await StraddleService.fetchStatus()
        } catch {}
    }

    // MARK: - Polling

    func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Constants.straddlePollInterval))
                guard !Task.isCancelled else { break }
                do {
                    async let s = StraddleService.fetchStatus()
                    async let p = StraddleService.fetchPosition()
                    async let c = StraddleService.fetchCapital()
                    let (status, position, capital) = try await (s, p, c)
                    self.status = status
                    self.position = position
                    self.capital = capital
                } catch {}
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
