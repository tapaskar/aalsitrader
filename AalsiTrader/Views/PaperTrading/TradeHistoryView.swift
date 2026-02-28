import SwiftUI

struct TradeHistoryView: View {
    let openTrades: [PaperTrade]
    let closedTrades: [PaperTrade]
    @State private var showOpen = true
    @State private var selectedTrade: PaperTrade?

    private var displayedTrades: [PaperTrade] {
        showOpen ? openTrades : closedTrades
    }

    var body: some View {
        VStack(spacing: 12) {
            // Toggle
            Picker("Status", selection: $showOpen) {
                Text("Open (\(openTrades.count))").tag(true)
                Text("Closed (\(closedTrades.count))").tag(false)
            }
            .pickerStyle(.segmented)

            if displayedTrades.isEmpty {
                EmptyStateView(
                    icon: showOpen ? "tray" : "archivebox",
                    title: "No \(showOpen ? "open" : "closed") trades"
                )
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(displayedTrades) { trade in
                        TradeRowView(trade: trade)
                            .onTapGesture {
                                selectedTrade = trade
                            }
                    }
                }
            }
        }
        .sheet(item: $selectedTrade) { trade in
            TradeDetailSheet(trade: trade)
        }
    }
}
