import Foundation

@Observable
final class TradingRulesViewModel {
    var rules: TradingRules?
    var config: TradingConfig = TradingConfig()

    var customEntryRules: [String] = []
    var customExitRules: [String] = []
    var customRiskRules: [String] = []

    var newRule: String = ""

    var isLoading = false
    var isSaving = false
    var error: String?
    var successMessage: String?

    // MARK: - Data Loading

    func loadRules() async {
        isLoading = true
        error = nil
        do {
            let result = try await TradingRulesService.fetchRules()
            rules = result
            if let c = result.config {
                config = c
            }
            customEntryRules = result.entryRules ?? []
            customExitRules = result.exitRules ?? []
            customRiskRules = result.riskRules ?? []
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    // MARK: - Save

    func saveRules() async {
        isSaving = true
        error = nil
        successMessage = nil
        do {
            let result = try await TradingRulesService.saveRules(
                config: config,
                entryRules: customEntryRules,
                exitRules: customExitRules,
                riskRules: customRiskRules
            )
            rules = result
            if let c = result.config {
                config = c
            }
            customEntryRules = result.entryRules ?? customEntryRules
            customExitRules = result.exitRules ?? customExitRules
            customRiskRules = result.riskRules ?? customRiskRules
            successMessage = "Rules saved successfully"
            isSaving = false
            HapticService.success()

            // Clear success message after 3 seconds
            Task {
                try? await Task.sleep(for: .seconds(3))
                successMessage = nil
            }
        } catch {
            self.error = error.localizedDescription
            isSaving = false
            HapticService.error()
        }
    }

    // MARK: - Reset to Defaults

    func resetToDefaults() {
        config = TradingConfig(
            startingCapital: 1_000_000,
            maxRiskPerTradePct: 2.0,
            dailyLossLimitPct: 5.0,
            maxPositions: 5,
            maxSectorExposurePct: 30.0,
            rsiOversoldThreshold: 30,
            rsiOverboughtThreshold: 70,
            minRewardRiskRatio: 2.0,
            minTimeframeConfidence: 70,
            rejectHighFalseBreakout: true,
            requireAgentAlignment: true,
            maxTradeDurationHours: 6,
            exitOnMomentumExhaustion: true,
            exitOnReversalSignal: true,
            intradayExitTime: "15:15",
            maxSwingHoldingDays: 5,
            hedgeEnabled: false,
            brokeragePerOrder: 20
        )
        customEntryRules = []
        customExitRules = []
        customRiskRules = []
        HapticService.impact(.medium)
    }

    // MARK: - Entry Rules

    func addEntryRule() {
        let trimmed = newRule.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        customEntryRules.append(trimmed)
        newRule = ""
        HapticService.impact(.light)
    }

    func deleteEntryRule(at offsets: IndexSet) {
        customEntryRules.remove(atOffsets: offsets)
    }

    // MARK: - Exit Rules

    func addExitRule() {
        let trimmed = newRule.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        customExitRules.append(trimmed)
        newRule = ""
        HapticService.impact(.light)
    }

    func deleteExitRule(at offsets: IndexSet) {
        customExitRules.remove(atOffsets: offsets)
    }

    // MARK: - Risk Rules

    func addRiskRule() {
        let trimmed = newRule.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        customRiskRules.append(trimmed)
        newRule = ""
        HapticService.impact(.light)
    }

    func deleteRiskRule(at offsets: IndexSet) {
        customRiskRules.remove(atOffsets: offsets)
    }
}
