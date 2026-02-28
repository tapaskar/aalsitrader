import SwiftUI

struct TradingRulesView: View {
    @State private var vm = TradingRulesViewModel()
    @State private var showResetConfirmation = false
    @State private var addingRuleType: RuleType?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Success banner
                        if let success = vm.successMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Color.profitGreen)
                                Text(success)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Color.profitGreen)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(Color.profitGreen.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .padding(.horizontal)
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        // Error banner
                        if let error = vm.error {
                            ErrorBannerView(message: error) {
                                Task { await vm.loadRules() }
                            }
                            .padding(.horizontal)
                        }

                        // Section 1: Position Sizing & Capital
                        positionSizingSection

                        // Section 2: Entry Conditions
                        entryConditionsSection

                        // Section 3: Exit Conditions
                        exitConditionsSection

                        // Section 4: Risk Management
                        riskManagementSection

                        // Action buttons
                        actionButtonsSection

                        // Last updated info
                        lastUpdatedSection
                    }
                    .padding(.vertical)
                }
                .refreshable {
                    await vm.loadRules()
                }

                if vm.isLoading && vm.rules == nil {
                    LoadingView(label: "Loading trading rules...")
                }
            }
            .navigationTitle("Trading Rules")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.loadRules()
            }
            .alert("Reset to Defaults", isPresented: $showResetConfirmation) {
                Button("Reset", role: .destructive) {
                    vm.resetToDefaults()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will reset all trading rules to their default values. You will still need to save to apply changes.")
            }
            .animation(.easeInOut(duration: 0.3), value: vm.successMessage)
        }
    }

    // MARK: - Section 1: Position Sizing & Capital

    private var positionSizingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Position Sizing & Capital", icon: "indianrupeesign.circle")

            VStack(spacing: 14) {
                // Starting Capital
                RulesTextField(
                    label: "Starting Capital",
                    placeholder: "1000000",
                    value: Binding(
                        get: { vm.config.startingCapital.map { String(format: "%.0f", $0) } ?? "" },
                        set: { vm.config.startingCapital = Double($0) }
                    ),
                    prefix: "INR",
                    keyboardType: .numberPad
                )

                // Max Risk Per Trade
                RulesSliderRow(
                    label: "Max Risk Per Trade",
                    value: Binding(
                        get: { vm.config.maxRiskPerTradePct ?? 2.0 },
                        set: { vm.config.maxRiskPerTradePct = $0 }
                    ),
                    range: 0.5...5.0,
                    step: 0.5,
                    unit: "%"
                )

                // Daily Loss Limit
                RulesSliderRow(
                    label: "Daily Loss Limit",
                    value: Binding(
                        get: { vm.config.dailyLossLimitPct ?? 5.0 },
                        set: { vm.config.dailyLossLimitPct = $0 }
                    ),
                    range: 1.0...10.0,
                    step: 0.5,
                    unit: "%"
                )

                // Max Open Positions
                RulesStepperRow(
                    label: "Max Open Positions",
                    value: Binding(
                        get: { vm.config.maxPositions ?? 5 },
                        set: { vm.config.maxPositions = $0 }
                    ),
                    range: 1...20
                )

                // Max Sector Exposure
                RulesSliderRow(
                    label: "Max Sector Exposure",
                    value: Binding(
                        get: { vm.config.maxSectorExposurePct ?? 30.0 },
                        set: { vm.config.maxSectorExposurePct = $0 }
                    ),
                    range: 10.0...50.0,
                    step: 5.0,
                    unit: "%"
                )
            }
            .padding(14)
            .cardStyle()
        }
        .padding(.horizontal)
    }

    // MARK: - Section 2: Entry Conditions

    private var entryConditionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Entry Conditions", icon: "arrow.right.circle")

            VStack(spacing: 14) {
                // RSI Oversold Threshold
                RulesSliderRow(
                    label: "RSI Oversold Threshold",
                    value: Binding(
                        get: { vm.config.rsiOversoldThreshold ?? 30 },
                        set: { vm.config.rsiOversoldThreshold = $0 }
                    ),
                    range: 15...40,
                    step: 1,
                    unit: "",
                    decimals: 0
                )

                // RSI Overbought Threshold
                RulesSliderRow(
                    label: "RSI Overbought Threshold",
                    value: Binding(
                        get: { vm.config.rsiOverboughtThreshold ?? 70 },
                        set: { vm.config.rsiOverboughtThreshold = $0 }
                    ),
                    range: 60...85,
                    step: 1,
                    unit: "",
                    decimals: 0
                )

                // Min Reward:Risk Ratio
                RulesStepperDoubleRow(
                    label: "Min Reward:Risk Ratio",
                    value: Binding(
                        get: { vm.config.minRewardRiskRatio ?? 2.0 },
                        set: { vm.config.minRewardRiskRatio = $0 }
                    ),
                    range: 1.0...5.0,
                    step: 0.5,
                    formatString: "%.1f"
                )

                // Min Timeframe Confidence
                RulesSliderRow(
                    label: "Min Timeframe Confidence",
                    value: Binding(
                        get: { vm.config.minTimeframeConfidence ?? 70 },
                        set: { vm.config.minTimeframeConfidence = $0 }
                    ),
                    range: 50...100,
                    step: 5,
                    unit: "%",
                    decimals: 0
                )

                // Toggle: Reject High False Breakout
                RulesToggleRow(
                    label: "Reject High False Breakout",
                    isOn: Binding(
                        get: { vm.config.rejectHighFalseBreakout ?? true },
                        set: { vm.config.rejectHighFalseBreakout = $0 }
                    )
                )

                // Toggle: Require Agent Alignment
                RulesToggleRow(
                    label: "Require Agent Alignment",
                    isOn: Binding(
                        get: { vm.config.requireAgentAlignment ?? true },
                        set: { vm.config.requireAgentAlignment = $0 }
                    )
                )

                // Custom entry rules
                CustomRulesSection(
                    title: "Custom Entry Rules",
                    rules: $vm.customEntryRules,
                    onAdd: { vm.addEntryRule() },
                    onDelete: { vm.deleteEntryRule(at: $0) },
                    newRule: $vm.newRule
                )
            }
            .padding(14)
            .cardStyle()
        }
        .padding(.horizontal)
    }

    // MARK: - Section 3: Exit Conditions

    private var exitConditionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Exit Conditions", icon: "arrow.left.circle")

            VStack(spacing: 14) {
                // Max Trade Duration Hours
                RulesStepperRow(
                    label: "Max Trade Duration (hrs)",
                    value: Binding(
                        get: { vm.config.maxTradeDurationHours ?? 6 },
                        set: { vm.config.maxTradeDurationHours = $0 }
                    ),
                    range: 1...24
                )

                // Max Swing Holding Days
                RulesStepperRow(
                    label: "Max Swing Holding (days)",
                    value: Binding(
                        get: { vm.config.maxSwingHoldingDays ?? 5 },
                        set: { vm.config.maxSwingHoldingDays = $0 }
                    ),
                    range: 1...30
                )

                // Intraday Exit Time
                RulesTextField(
                    label: "Intraday Exit Time",
                    placeholder: "15:15",
                    value: Binding(
                        get: { vm.config.intradayExitTime ?? "" },
                        set: { vm.config.intradayExitTime = $0 }
                    ),
                    prefix: nil,
                    keyboardType: .default
                )

                // Toggle: Exit on Momentum Exhaustion
                RulesToggleRow(
                    label: "Exit on Momentum Exhaustion",
                    isOn: Binding(
                        get: { vm.config.exitOnMomentumExhaustion ?? true },
                        set: { vm.config.exitOnMomentumExhaustion = $0 }
                    )
                )

                // Toggle: Exit on Reversal Signal
                RulesToggleRow(
                    label: "Exit on Reversal Signal",
                    isOn: Binding(
                        get: { vm.config.exitOnReversalSignal ?? true },
                        set: { vm.config.exitOnReversalSignal = $0 }
                    )
                )

                // Custom exit rules
                CustomRulesSection(
                    title: "Custom Exit Rules",
                    rules: $vm.customExitRules,
                    onAdd: { vm.addExitRule() },
                    onDelete: { vm.deleteExitRule(at: $0) },
                    newRule: $vm.newRule
                )
            }
            .padding(14)
            .cardStyle()
        }
        .padding(.horizontal)
    }

    // MARK: - Section 4: Risk Management

    private var riskManagementSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Risk Management", icon: "shield.checkered")

            VStack(spacing: 14) {
                // Toggle: Hedging Enabled
                RulesToggleRow(
                    label: "Hedging Enabled",
                    isOn: Binding(
                        get: { vm.config.hedgeEnabled ?? false },
                        set: { vm.config.hedgeEnabled = $0 }
                    )
                )

                // Brokerage Per Order
                RulesTextField(
                    label: "Brokerage Per Order",
                    placeholder: "20",
                    value: Binding(
                        get: { vm.config.brokeragePerOrder.map { String(format: "%.0f", $0) } ?? "" },
                        set: { vm.config.brokeragePerOrder = Double($0) }
                    ),
                    prefix: "INR",
                    keyboardType: .numberPad
                )

                // Custom risk rules
                CustomRulesSection(
                    title: "Custom Risk Rules",
                    rules: $vm.customRiskRules,
                    onAdd: { vm.addRiskRule() },
                    onDelete: { vm.deleteRiskRule(at: $0) },
                    newRule: $vm.newRule
                )
            }
            .padding(14)
            .cardStyle()
        }
        .padding(.horizontal)
    }

    // MARK: - Action Buttons

    private var actionButtonsSection: some View {
        VStack(spacing: 12) {
            // Save Button
            Button {
                Task { await vm.saveRules() }
            } label: {
                HStack(spacing: 8) {
                    if vm.isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "square.and.arrow.down")
                    }
                    Text(vm.isSaving ? "Saving..." : "Save Rules")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentCyan)
                .foregroundStyle(.black)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(vm.isSaving)
            .opacity(vm.isSaving ? 0.7 : 1)

            // Reset to Defaults
            Button {
                showResetConfirmation = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Reset to Defaults")
                        .font(.subheadline.weight(.medium))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.cardBackground)
                .foregroundStyle(Color.statusWarning)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.statusWarning.opacity(0.3), lineWidth: 1)
                )
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Last Updated

    private var lastUpdatedSection: some View {
        Group {
            if let lastUpdated = vm.rules?.lastUpdated {
                VStack(spacing: 4) {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption2)
                        Text("Last updated: \(formatTimestamp(lastUpdated))")
                            .font(.caption)
                    }
                    .foregroundStyle(Color.textMuted)

                    if let updatedBy = vm.rules?.updatedBy {
                        HStack(spacing: 4) {
                            Image(systemName: "person")
                                .font(.caption2)
                            Text("Modified by: \(updatedBy)")
                                .font(.caption)
                        }
                        .foregroundStyle(Color.textMuted)
                    }
                }
                .padding(.bottom, 20)
            }
        }
    }

    // MARK: - Helpers

    private func sectionTitle(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(Color.accentCyan)
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.textPrimary)
        }
        .padding(.horizontal, 4)
    }

    private func formatTimestamp(_ timestamp: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: timestamp) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .short
            return display.string(from: date)
        }
        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: timestamp) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .short
            return display.string(from: date)
        }
        return timestamp
    }
}

// MARK: - Rule Type

private enum RuleType {
    case entry, exit, risk
}

// MARK: - Reusable Row Components

private struct RulesSliderRow: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    var step: Double = 1
    var unit: String = ""
    var decimals: Int = 1

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                Text(formattedValue)
                    .font(.subheadline.weight(.semibold).monospaced())
                    .foregroundStyle(Color.accentCyan)
            }

            Slider(value: $value, in: range, step: step)
                .tint(Color.accentCyan)
        }
    }

    private var formattedValue: String {
        let formatted = String(format: "%.\(decimals)f", value)
        return unit.isEmpty ? formatted : "\(formatted)\(unit)"
    }
}

private struct RulesStepperRow: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            HStack(spacing: 12) {
                Button {
                    if value > range.lowerBound { value -= 1 }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(value > range.lowerBound ? Color.accentCyan : Color.textMuted)
                }
                .disabled(value <= range.lowerBound)

                Text("\(value)")
                    .font(.subheadline.weight(.semibold).monospaced())
                    .foregroundStyle(Color.accentCyan)
                    .frame(minWidth: 30)

                Button {
                    if value < range.upperBound { value += 1 }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(value < range.upperBound ? Color.accentCyan : Color.textMuted)
                }
                .disabled(value >= range.upperBound)
            }
        }
    }
}

private struct RulesStepperDoubleRow: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    var step: Double = 0.5
    var formatString: String = "%.1f"

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            HStack(spacing: 12) {
                Button {
                    if value > range.lowerBound { value -= step }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(value > range.lowerBound ? Color.accentCyan : Color.textMuted)
                }
                .disabled(value <= range.lowerBound)

                Text(String(format: formatString, value))
                    .font(.subheadline.weight(.semibold).monospaced())
                    .foregroundStyle(Color.accentCyan)
                    .frame(minWidth: 30)

                Button {
                    if value < range.upperBound { value += step }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(value < range.upperBound ? Color.accentCyan : Color.textMuted)
                }
                .disabled(value >= range.upperBound)
            }
        }
    }
}

private struct RulesToggleRow: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
        }
        .tint(Color.accentCyan)
    }
}

private struct RulesTextField: View {
    let label: String
    let placeholder: String
    @Binding var value: String
    var prefix: String?
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)

            HStack(spacing: 8) {
                if let prefix {
                    Text(prefix)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.textMuted)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                        .background(Color.appBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                TextField(placeholder, text: $value)
                    .font(.subheadline.monospaced())
                    .foregroundStyle(Color.textPrimary)
                    .keyboardType(keyboardType)
                    .autocorrectionDisabled()
            }
            .padding(10)
            .background(Color.appBackground)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.appBorder.opacity(0.4), lineWidth: 1)
            )
        }
    }
}

private struct CustomRulesSection: View {
    let title: String
    @Binding var rules: [String]
    let onAdd: () -> Void
    let onDelete: (IndexSet) -> Void
    @Binding var newRule: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
                .background(Color.appBorder.opacity(0.3))

            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.textPrimary)

            if rules.isEmpty {
                Text("No custom rules added")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(rules.enumerated()), id: \.offset) { index, rule in
                    HStack(spacing: 8) {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 4))
                            .foregroundStyle(Color.accentCyan)

                        Text(rule)
                            .font(.caption)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(2)

                        Spacer()

                        Button {
                            var offsets = IndexSet()
                            offsets.insert(index)
                            onDelete(offsets)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(Color.lossRed.opacity(0.7))
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            // Add new rule
            HStack(spacing: 8) {
                TextField("Add a rule...", text: $newRule)
                    .font(.caption)
                    .foregroundStyle(Color.textPrimary)
                    .padding(8)
                    .background(Color.appBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.appBorder.opacity(0.3), lineWidth: 1)
                    )

                Button {
                    onAdd()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(Color.accentCyan)
                }
                .disabled(newRule.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .opacity(newRule.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1)
            }
        }
    }
}
