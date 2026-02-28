import SwiftUI

struct ProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var auth = AuthViewModel.shared
    @State private var showBroker = false
    @State private var showBrokerPortfolio = false
    @State private var showSettings = false
    @State private var showLogoutConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        if let user = auth.user {
                            // Account info
                            VStack(spacing: 8) {
                                Circle()
                                    .fill(Color.accentCyan.opacity(0.2))
                                    .frame(width: 60, height: 60)
                                    .overlay(
                                        Text(String(user.username.prefix(1)).uppercased())
                                            .font(.title.bold())
                                            .foregroundStyle(Color.accentCyan)
                                    )

                                Text(user.username)
                                    .font(.title3.bold())
                                    .foregroundStyle(.white)
                                Text(user.email)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.textSecondary)

                                HStack(spacing: 8) {
                                    if let plan = user.plan {
                                        PillBadgeView(text: plan.rawValue.uppercased(), color: Color.accentCyan)
                                    }
                                    if let status = user.planStatus {
                                        PillBadgeView(text: status.rawValue.uppercased(), color: status == .active ? Color.profitGreen : Color.statusWarning)
                                    }
                                }
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .cardStyle()

                            // Broker credentials
                            Button {
                                showBroker = true
                            } label: {
                                profileRow(
                                    icon: "building.columns",
                                    title: "Broker Credentials",
                                    subtitle: user.brokerType?.rawValue.capitalized ?? "Not configured",
                                    color: Color.accentCyan
                                )
                            }

                            // Broker portfolio
                            Button {
                                showBrokerPortfolio = true
                            } label: {
                                profileRow(
                                    icon: "chart.bar.xaxis",
                                    title: "Broker Portfolio",
                                    subtitle: "Positions, holdings & funds",
                                    color: Color.profitGreen
                                )
                            }

                            // Settings
                            Button {
                                showSettings = true
                            } label: {
                                profileRow(
                                    icon: "gearshape",
                                    title: "Settings",
                                    subtitle: "Sound, approvals, preferences",
                                    color: Color.textSecondary
                                )
                            }

                            // Account details
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Account Details")
                                    .font(.headline).foregroundStyle(.white)

                                if let created = user.createdAt {
                                    detailRow("Joined", Date.fromEpoch(created).istDateTime)
                                }
                                if let lastLogin = user.lastLogin {
                                    detailRow("Last Login", Date.fromEpoch(lastLogin).istDateTime)
                                }
                                detailRow("Role", user.role.rawValue.capitalized)
                            }
                            .padding()
                            .cardStyle()
                        }

                        // Logout
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
                    }
                    .padding()
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
            .sheet(isPresented: $showBroker) {
                BrokerCredentialsView()
            }
            .sheet(isPresented: $showBrokerPortfolio) {
                BrokerPortfolioView()
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .alert("Logout?", isPresented: $showLogoutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Logout", role: .destructive) {
                    auth.logout()
                    dismiss()
                }
            }
        }
    }

    private func profileRow(icon: String, title: String, subtitle: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline).foregroundStyle(.white)
                Text(subtitle).font(.caption).foregroundStyle(Color.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption).foregroundStyle(Color.textMuted)
        }
        .padding()
        .cardStyle()
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(Color.textSecondary)
            Spacer()
            Text(value).font(.subheadline).foregroundStyle(.white)
        }
    }
}
