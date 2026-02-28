import SwiftUI

struct ScreenerView: View {
    @State private var vm = ScreenerViewModel()
    @State private var selectedStock: SmartMoneyStock?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        ScreenerSummaryCards(
                            bullish: vm.bullishCount,
                            bearish: vm.bearishCount,
                            strong: vm.strongCount,
                            total: vm.stocks.count,
                            onFilterBullish: { vm.signalFilter = .BUY },
                            onFilterBearish: { vm.signalFilter = .SELL }
                        )

                        ScreenerFilterBar(
                            searchText: $vm.searchText,
                            signalFilter: $vm.signalFilter,
                            structureFilter: $vm.structureFilter,
                            onClear: { vm.clearFilters() }
                        )

                        // Stock list
                        if vm.filteredStocks.isEmpty {
                            EmptyStateView(
                                icon: "magnifyingglass",
                                title: "No stocks found",
                                subtitle: "Try adjusting your filters"
                            )
                        } else {
                            LazyVStack(spacing: 6) {
                                ForEach(vm.filteredStocks) { stock in
                                    StockRowView(stock: stock)
                                        .onTapGesture {
                                            selectedStock = stock
                                        }
                                }
                            }
                        }
                    }
                    .padding()
                }
                .refreshable {
                    await vm.loadStocks(force: true)
                }

                if vm.isLoading && vm.stocks.isEmpty {
                    LoadingView(label: "Scanning markets...")
                }
            }
            .navigationTitle("Smart Money")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.loadStocks()
            }
            .sheet(item: $selectedStock) { stock in
                StockDetailSheet(stock: stock, vm: vm)
            }
        }
    }
}
