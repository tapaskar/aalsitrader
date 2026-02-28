import SwiftUI

struct PaperTradingView: View {
    @State private var vm = PaperTradingViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Mode indicator bar
                    ModeIndicatorBar(vm: vm)
                        .padding(.horizontal)
                        .padding(.top, 4)

                    // Horizontal pill tab bar
                    PaperTabBar(selectedTab: $vm.selectedTab)
                        .padding(.top, 8)

                    ScrollView {
                        switch vm.selectedTab {
                        case .portfolio:
                            VStack(spacing: 16) {
                                if let portfolio = vm.portfolio {
                                    PortfolioSummaryView(portfolio: portfolio)
                                }
                                EquityCurveChartView(points: vm.equityCurve)
                            }
                            .padding(.horizontal)

                        case .trades:
                            TradeHistoryView(
                                openTrades: vm.openTrades,
                                closedTrades: vm.closedTrades
                            )
                            .padding(.horizontal)

                        case .rules:
                            TradingRulesView()
                                .padding(.horizontal)

                        case .analytics:
                            if let metrics = vm.metrics {
                                PerformanceMetricsView(metrics: metrics)
                                    .padding(.horizontal)
                            } else {
                                EmptyStateView(icon: "chart.bar", title: "No analytics yet")
                            }

                        case .approvals:
                            SigmaApprovalsView(
                                approvals: vm.pendingApprovals,
                                onApprove: { id in Task { await vm.approveSignal(id) } },
                                onReject: { id in Task { await vm.rejectSignal(id) } }
                            )
                            .padding(.horizontal)
                        }
                    }
                    .refreshable {
                        await vm.loadAll()
                    }
                }

                if vm.isLoading && vm.portfolio == nil {
                    LoadingView(label: "Loading portfolio...")
                }
            }
            .navigationTitle(vm.isLiveMode ? "Live Trading" : "Paper Trading")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.loadMode()
                await vm.loadAll()
                vm.setupWebSocket()
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

// MARK: - Horizontal Pill Tab Bar

private struct PaperTabBar: View {
    @Binding var selectedTab: PaperTab

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(PaperTab.allCases, id: \.self) { tab in
                    Button {
                        HapticService.selection()
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedTab = tab
                        }
                    } label: {
                        Text(tab.rawValue)
                            .font(.caption.bold())
                            .foregroundStyle(selectedTab == tab ? .white : Color.textSecondary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(
                                selectedTab == tab
                                    ? AnyShapeStyle(Color.accentCyan.opacity(0.3))
                                    : AnyShapeStyle(Color.cardBackground)
                            )
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(
                                    selectedTab == tab ? Color.accentCyan : Color.appBorder.opacity(0.3),
                                    lineWidth: 1
                                )
                            )
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }
}
