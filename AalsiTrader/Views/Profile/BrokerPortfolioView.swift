import SwiftUI

struct BrokerPortfolioView: View {
    @State private var vm = BrokerPortfolioViewModel()
    @State private var showBrokerSetup = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        if vm.needsSetup {
                            needsBrokerSetupView
                        } else if let brokerErr = vm.brokerError {
                            brokerErrorView(brokerErr)
                        } else {
                            // Header
                            headerView

                            // Funds card
                            if let funds = vm.funds {
                                fundsSection(funds)
                            }

                            // Positions
                            if vm.hasPositions {
                                positionsSection
                            }

                            // Holdings
                            if vm.hasHoldings {
                                holdingsSection
                            }

                            // Empty state when no positions or holdings
                            if !vm.hasPositions && !vm.hasHoldings && vm.funds == nil && !vm.isLoading {
                                EmptyStateView(
                                    icon: "chart.bar.doc.horizontal",
                                    title: "No portfolio data",
                                    subtitle: "Portfolio data will appear once your broker is connected and active"
                                )
                            }
                        }
                    }
                    .padding()
                }
                .refreshable {
                    await vm.loadPortfolio()
                }

                if vm.isLoading && vm.portfolio == nil {
                    LoadingView(label: "Loading broker portfolio...")
                }
            }
            .navigationTitle("Broker Portfolio")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.loadPortfolio()
                vm.startPolling()
            }
            .onDisappear {
                vm.stopPolling()
            }
            .sheet(isPresented: $showBrokerSetup) {
                BrokerCredentialsView()
            }

            if let error = vm.error, !vm.needsSetup {
                ErrorBannerView(message: error) {
                    Task { await vm.loadPortfolio() }
                }
                .padding()
            }
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            HStack(spacing: 8) {
                Image(systemName: "building.columns.fill")
                    .foregroundStyle(Color.accentCyan)
                if vm.portfolio?.broker != nil {
                    PillBadgeView(text: vm.brokerName.uppercased(), color: Color.accentCyan)
                }
            }

            Spacer()

            Button {
                Task { await vm.loadPortfolio() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.subheadline)
                    .foregroundStyle(Color.accentCyan)
            }
        }
        .padding(12)
        .cardStyle()
    }

    // MARK: - Funds

    private func fundsSection(_ funds: BrokerFunds) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Funds")
                .sectionHeader()

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10)
            ], spacing: 10) {
                StatCardView(
                    title: "Total Balance",
                    value: (funds.totalBalance ?? 0).inrShort,
                    color: Color.accentCyan,
                    icon: "indianrupeesign.circle"
                )

                StatCardView(
                    title: "Available",
                    value: (funds.availableBalance ?? 0).inrShort,
                    color: Color.profitGreen,
                    icon: "checkmark.circle"
                )

                StatCardView(
                    title: "Margin Used",
                    value: (funds.usedMargin ?? 0).inrShort,
                    color: Color.statusWarning,
                    icon: "lock.circle"
                )

                if let dayPnl = funds.dayPnl {
                    StatCardView(
                        title: "Day P&L",
                        value: dayPnl.inrShort,
                        color: dayPnl >= 0 ? Color.profitGreen : Color.lossRed,
                        icon: dayPnl >= 0 ? "arrow.up.right" : "arrow.down.right"
                    )
                } else {
                    StatCardView(
                        title: "Day P&L",
                        value: "--",
                        color: Color.textMuted,
                        icon: "minus.circle"
                    )
                }
            }
        }
    }

    // MARK: - Positions

    private var positionsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Open Positions")
                    .sectionHeader()
                Spacer()
                Text("\(vm.positions.count) active")
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            ForEach(vm.positions) { position in
                positionRow(position)
            }

            // Total P&L row
            HStack {
                Text("Total P&L")
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                PnLTextView(value: vm.totalPositionPnL, font: .subheadline.bold())
            }
            .padding(12)
            .background(Color.appBackground.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private func positionRow(_ position: BrokerPosition) -> some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(position.symbol ?? "Unknown")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    HStack(spacing: 6) {
                        if let exchange = position.exchange ?? position.exchangeSegment {
                            Text(exchange)
                                .font(.caption2)
                                .foregroundStyle(Color.textMuted)
                        }
                        if let product = position.product ?? position.productType {
                            Text(product)
                                .font(.caption2)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Color.appBorder.opacity(0.3))
                                .clipShape(Capsule())
                                .foregroundStyle(Color.textSecondary)
                        }
                    }
                }
                Spacer()
                PnLTextView(value: position.profit, font: .subheadline.bold())
            }

            HStack {
                detailItem("Qty", "\(position.qty)")
                Spacer()
                detailItem("Avg", String(format: "%.2f", position.avgPrice))
                Spacer()
                detailItem("LTP", String(format: "%.2f", position.currentPrice))
            }
        }
        .padding(12)
        .cardStyle()
    }

    // MARK: - Holdings

    private var holdingsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Holdings")
                    .sectionHeader()
                Spacer()
                Text("\(vm.holdings.count) stocks")
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            ForEach(vm.holdings) { holding in
                holdingRow(holding)
            }
        }
    }

    private func holdingRow(_ holding: BrokerHolding) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(holding.symbol ?? "Unknown")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text("Qty: \(holding.qty)")
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                PnLTextView(value: holding.profit, font: .subheadline)
                Text("Avg: \(String(format: "%.2f", holding.avgPrice))")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(12)
        .cardStyle()
    }

    // MARK: - Empty / Error States

    private var needsBrokerSetupView: some View {
        VStack(spacing: 16) {
            EmptyStateView(
                icon: "building.columns",
                title: "No Broker Connected",
                subtitle: "Connect your broker account to view live portfolio data, positions, and holdings"
            )

            Button {
                showBrokerSetup = true
            } label: {
                Label("Connect a Broker", systemImage: "link.badge.plus")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.accentCyan)
        }
        .padding()
        .cardStyle()
    }

    private func brokerErrorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.statusWarning)

            Text("Broker Error")
                .font(.headline)
                .foregroundStyle(.white)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)

            Button {
                Task { await vm.loadPortfolio() }
            } label: {
                Label("Retry", systemImage: "arrow.clockwise")
                    .font(.subheadline.bold())
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.accentCyan)
            .padding(.top, 4)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .cardStyle()
    }

    // MARK: - Helpers

    private func detailItem(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.textMuted)
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(Color.textSecondary)
        }
    }
}
