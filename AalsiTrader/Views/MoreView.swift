import SwiftUI

struct MoreView: View {
    @State private var auth = AuthViewModel.shared

    @State private var showProfile = false
    @State private var showBrokerSetup = false
    @State private var showBrokerPortfolio = false
    @State private var showTradingRules = false
    @State private var showSettings = false
    @State private var showAdmin = false
    @State private var showOnboarding = false
    @State private var showLogoutConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // MARK: - Account Section
                        sectionView(title: "Account") {
                            VStack(spacing: 0) {
                                menuRow(
                                    icon: "person.circle",
                                    iconColor: Color.accentCyan,
                                    title: "Profile",
                                    subtitle: auth.user?.username ?? "View your account"
                                ) {
                                    showProfile = true
                                }

                                Divider()
                                    .background(Color.appBorder.opacity(0.3))
                                    .padding(.leading, 48)

                                menuRow(
                                    icon: "building.columns",
                                    iconColor: Color.betaTeal,
                                    title: "Broker Setup",
                                    subtitle: auth.user?.brokerType?.rawValue.capitalized ?? "Connect your broker"
                                ) {
                                    showBrokerSetup = true
                                }

                                Divider()
                                    .background(Color.appBorder.opacity(0.3))
                                    .padding(.leading, 48)

                                menuRow(
                                    icon: "chart.bar.xaxis",
                                    iconColor: Color.profitGreen,
                                    title: "Broker Portfolio",
                                    subtitle: "Positions, holdings & funds"
                                ) {
                                    showBrokerPortfolio = true
                                }
                            }
                        }

                        // MARK: - Trading Section
                        sectionView(title: "Trading") {
                            VStack(spacing: 0) {
                                menuRow(
                                    icon: "slider.horizontal.3",
                                    iconColor: Color.thetaOrange,
                                    title: "Trading Rules",
                                    subtitle: "Entry, exit & risk parameters"
                                ) {
                                    showTradingRules = true
                                }

                                Divider()
                                    .background(Color.appBorder.opacity(0.3))
                                    .padding(.leading, 48)

                                menuRow(
                                    icon: "gearshape",
                                    iconColor: Color.textSecondary,
                                    title: "Settings",
                                    subtitle: "Sound, approvals, preferences"
                                ) {
                                    showSettings = true
                                }
                            }
                        }

                        // MARK: - Admin Section (conditional)
                        if auth.user?.isAdmin == true {
                            sectionView(title: "Admin") {
                                menuRow(
                                    icon: "gearshape.2",
                                    iconColor: Color.gammaPurple,
                                    title: "Admin Panel",
                                    subtitle: "Users, stats & system overview"
                                ) {
                                    showAdmin = true
                                }
                            }
                        }

                        // MARK: - App Section
                        sectionView(title: "App") {
                            VStack(spacing: 0) {
                                menuRow(
                                    icon: "questionmark.circle",
                                    iconColor: Color.deltaBlue,
                                    title: "Onboarding Guide",
                                    subtitle: "Learn how AalsiTrader works"
                                ) {
                                    showOnboarding = true
                                }

                                Divider()
                                    .background(Color.appBorder.opacity(0.3))
                                    .padding(.leading, 48)

                                // About row (inline, no navigation)
                                HStack(spacing: 12) {
                                    Image(systemName: "info.circle")
                                        .font(.title3)
                                        .foregroundStyle(Color.textMuted)
                                        .frame(width: 28)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("About")
                                            .font(.subheadline)
                                            .foregroundStyle(.white)
                                        Text("AalsiTrader iOS v1.0.0")
                                            .font(.caption)
                                            .foregroundStyle(Color.textSecondary)
                                    }

                                    Spacer()
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)

                                Divider()
                                    .background(Color.appBorder.opacity(0.3))
                                    .padding(.leading, 48)

                                // Support row (mailto link)
                                Button {
                                    if let url = URL(string: "mailto:support@aalsitrader.com") {
                                        UIApplication.shared.open(url)
                                    }
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "envelope")
                                            .font(.title3)
                                            .foregroundStyle(Color.sigmaGreen)
                                            .frame(width: 28)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Support")
                                                .font(.subheadline)
                                                .foregroundStyle(.white)
                                            Text("support@aalsitrader.com")
                                                .font(.caption)
                                                .foregroundStyle(Color.textSecondary)
                                        }

                                        Spacer()

                                        Image(systemName: "arrow.up.right")
                                            .font(.caption)
                                            .foregroundStyle(Color.textMuted)
                                    }
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 12)
                                }
                            }
                        }

                        // MARK: - Logout Button
                        Button {
                            showLogoutConfirm = true
                        } label: {
                            Label("Logout", systemImage: "rectangle.portrait.and.arrow.right")
                                .font(.headline)
                                .foregroundStyle(Color.statusDanger)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        }
                        .buttonStyle(.bordered)
                        .tint(Color.statusDanger)

                        // App version footer
                        VStack(spacing: 4) {
                            Text("AalsiTrader iOS")
                                .font(.caption)
                                .foregroundStyle(Color.textSecondary)
                            Text("v1.0.0 (Build 1)")
                                .font(.caption2)
                                .foregroundStyle(Color.textMuted)
                        }
                        .padding(.top, 8)
                        .padding(.bottom, 24)
                    }
                    .padding()
                }
            }
            .navigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showProfile) {
                ProfileView()
            }
            .sheet(isPresented: $showBrokerSetup) {
                BrokerCredentialsView()
            }
            .sheet(isPresented: $showBrokerPortfolio) {
                BrokerPortfolioView()
            }
            .sheet(isPresented: $showTradingRules) {
                TradingRulesView()
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showAdmin) {
                AdminView()
            }
            .sheet(isPresented: $showOnboarding) {
                OnboardingView()
            }
            .alert("Logout?", isPresented: $showLogoutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Logout", role: .destructive) {
                    auth.logout()
                }
            } message: {
                Text("Are you sure you want to log out of your account?")
            }
        }
    }

    // MARK: - Section Container

    private func sectionView(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.bold())
                .foregroundStyle(Color.textMuted)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                content()
            }
            .cardStyle()
        }
    }

    // MARK: - Menu Row

    private func menuRow(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(iconColor)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
    }
}
