import SwiftUI

struct StraddleView: View {
    @State private var vm = StraddleViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        if let status = vm.status {
                            EngineStatusView(status: status)
                            EngineControlView(
                                status: status,
                                isPerforming: vm.isPerformingAction,
                                onStart: { Task { await vm.startEngine() } },
                                onStop: { Task { await vm.stopEngine() } },
                                onSetMode: { mode in Task { await vm.setMode(mode) } }
                            )
                        }

                        if let capital = vm.capital {
                            CapitalSummaryView(capital: capital)
                        }

                        if let position = vm.position {
                            PositionCardView(position: position)
                        }

                        StraddleTradeHistoryView(
                            trades: vm.trades,
                            dateFrom: $vm.dateFrom,
                            dateTo: $vm.dateTo,
                            onDateChange: { Task { await vm.loadTrades() } }
                        )
                    }
                    .padding()
                }
                .refreshable {
                    await vm.loadAll()
                }

                if vm.isLoading && vm.status == nil {
                    LoadingView(label: "Loading straddle...")
                }
            }
            .navigationTitle("Nifty Scalper")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.loadAll()
                vm.startPolling()
            }
            .onDisappear {
                vm.stopPolling()
            }

            if let error = vm.error {
                ErrorBannerView(message: error) {
                    Task { await vm.loadAll() }
                }
                .padding()
            }
        }
    }
}
