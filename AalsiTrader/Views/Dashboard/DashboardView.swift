import SwiftUI

struct DashboardView: View {
    @State private var vm = DashboardViewModel()
    @State private var paperVM = PaperTradingViewModel()
    private let ws = WebSocketManager.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // 1. Market data bar
                        MarketDataBarView()

                        // 2. Connection + Mode status row
                        HStack {
                            // WS indicator
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(ws.isConnected ? Color.statusActive : Color.statusDanger)
                                    .frame(width: 8, height: 8)
                                Text(ws.isConnected ? "Live" : "Offline")
                                    .font(.caption2)
                                    .foregroundStyle(ws.isConnected ? Color.statusActive : Color.statusDanger)
                            }

                            Spacer()

                            // Show pending approvals count if any
                            if !paperVM.pendingApprovals.isEmpty {
                                HStack(spacing: 4) {
                                    Image(systemName: "bell.badge.fill")
                                        .font(.caption)
                                        .foregroundStyle(Color.statusWarning)
                                    Text("\(paperVM.pendingApprovals.count) pending")
                                        .font(.caption2)
                                        .foregroundStyle(Color.statusWarning)
                                }
                            }
                        }
                        .padding(.horizontal)

                        // 3. Quick Stats Row
                        if let portfolio = paperVM.portfolio {
                            QuickStatsRow(portfolio: portfolio)
                        }

                        // 4. Agent Squad
                        AgentListView(agents: vm.agents, activities: vm.activities)

                        // 5. Trial/Plan status banner
                        TrialBannerView()

                        // 6. Filter bar
                        FilterBarView(
                            selected: $vm.filter,
                            options: vm.filterOptions
                        )

                        // 7. Activity Feed
                        ActivityFeedView(activities: vm.filteredActivities)

                        // 8. Recent Paper Trades (inline, last 5)
                        if !paperVM.openTrades.isEmpty {
                            RecentTradesSection(trades: paperVM.openTrades)
                        }

                        // 9. Comms panel
                        if !vm.comms.isEmpty {
                            CommPanelView(comms: vm.comms)
                        }
                    }
                    .padding(.vertical)
                }
                .refreshable {
                    await vm.loadData()
                    await paperVM.loadAll()
                }

            }
            .navigationTitle("AalsiTrader")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if !paperVM.pendingApprovals.isEmpty {
                        NavigationLink {
                            SigmaApprovalsView(
                                approvals: paperVM.pendingApprovals,
                                onApprove: { id in Task { await paperVM.approveSignal(id) } },
                                onReject: { id in Task { await paperVM.rejectSignal(id) } }
                            )
                            .navigationTitle("Approvals")
                        } label: {
                            Image(systemName: "bell.badge.fill")
                                .foregroundStyle(Color.statusWarning)
                        }
                    }
                }
            }
            .task {
                await vm.loadData()
                await paperVM.loadAll()
                vm.setupWebSocket()
                paperVM.setupWebSocket()
                vm.startPolling()
            }
            .onDisappear {
                vm.stopPolling()
            }

            if vm.isLoading && vm.activities.isEmpty {
                LoadingView(label: "Loading dashboard...")
            }

            if let error = vm.error, vm.activities.isEmpty {
                ErrorBannerView(message: error) {
                    Task { await vm.loadData() }
                }
                .padding()
            }
        }
    }
}
