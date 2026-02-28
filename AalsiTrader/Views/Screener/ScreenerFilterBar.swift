import SwiftUI

struct ScreenerFilterBar: View {
    @Binding var searchText: String
    @Binding var signalFilter: StockSignal?
    @Binding var structureFilter: MarketStructure?
    var onClear: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            SearchBarView(text: $searchText, placeholder: "Search symbol...")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    // Signal filters
                    ForEach([StockSignal.BUY, .SELL, .NEUTRAL], id: \.self) { signal in
                        filterPill(
                            label: signal.rawValue,
                            isSelected: signalFilter == signal,
                            color: signal == .BUY ? Color.profitGreen : signal == .SELL ? Color.lossRed : Color.textSecondary
                        ) {
                            signalFilter = signalFilter == signal ? nil : signal
                        }
                    }

                    Divider()
                        .frame(height: 20)
                        .overlay(Color.appBorder)

                    // Structure filters
                    ForEach([MarketStructure.BOS_BULLISH, .BOS_BEARISH, .CHOCH_BULLISH, .CHOCH_BEARISH, .RANGE], id: \.self) { structure in
                        filterPill(
                            label: structure.displayName,
                            isSelected: structureFilter == structure,
                            color: structure.isBullish ? Color.profitGreen : Color.lossRed
                        ) {
                            structureFilter = structureFilter == structure ? nil : structure
                        }
                    }

                    if signalFilter != nil || structureFilter != nil {
                        Button {
                            onClear()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Color.textMuted)
                        }
                    }
                }
            }
        }
    }

    private func filterPill(label: String, isSelected: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.caption2.bold())
                .foregroundStyle(isSelected ? .white : Color.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(isSelected ? color.opacity(0.3) : Color.cardBackground)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(isSelected ? color : Color.appBorder.opacity(0.3)))
        }
    }
}
