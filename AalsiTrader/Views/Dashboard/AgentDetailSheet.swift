import SwiftUI

struct AgentDetailSheet: View {
    let agent: Agent
    let activities: [Activity]
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: AgentDetailTab = .overview

    // Local-only settings (UI only for now)
    @State private var wakeOnMarketOpen = true
    @State private var alertOnCritical = true
    @State private var heartbeatInterval: HeartbeatInterval = .thirtyMin

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Tab picker
                    Picker("Tab", selection: $selectedTab) {
                        ForEach(AgentDetailTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                    // Tab content
                    ScrollView {
                        switch selectedTab {
                        case .overview:
                            overviewTab
                        case .history:
                            historyTab
                        case .settings:
                            settingsTab
                        }
                    }
                }
            }
            .navigationTitle(agent.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
        }
    }

    // MARK: - Overview Tab

    private var overviewTab: some View {
        VStack(spacing: 20) {
            // Header
            VStack(spacing: 8) {
                AgentAvatarView(agentId: agent.id, size: 80)

                Text(agent.name)
                    .font(.title2.bold())
                    .foregroundStyle(.white)

                Text(agent.role)
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary)

                PillBadgeView(
                    text: agent.status.rawValue.uppercased(),
                    color: agent.status == .active ? Color.statusActive :
                           agent.status == .sleeping ? Color.statusSleeping : Color.statusDanger
                )
            }
            .padding(.top)

            // Current task
            if let task = agent.currentTask {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Current Task")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                    Text(task)
                        .font(.body)
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .cardStyle()
            }

            // Stats
            if let stats = agent.stats {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Statistics")
                        .font(.headline)
                        .foregroundStyle(.white)

                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 12) {
                        StatCardView(
                            title: "Tasks",
                            value: "\(stats.tasksCompleted ?? 0)",
                            color: agent.displayColor
                        )
                        StatCardView(
                            title: "Alerts",
                            value: "\(stats.alertsSent ?? 0)",
                            color: Color.statusWarning
                        )
                        StatCardView(
                            title: "Accuracy",
                            value: "\(String(format: "%.0f", stats.accuracy ?? 0))%",
                            color: Color.statusActive
                        )
                    }
                }
            }
        }
        .padding()
    }

    // MARK: - History Tab

    private var historyTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header with count
            HStack {
                Text("Activity Log")
                    .sectionHeader()

                Text("\(activities.count)")
                    .font(.caption2.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(agent.displayColor.opacity(0.25))
                    .clipShape(Capsule())

                Spacer()
            }
            .padding(.horizontal)
            .padding(.top, 4)

            if activities.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.textMuted)

                    Text("No activity recorded")
                        .font(.subheadline)
                        .foregroundStyle(Color.textSecondary)

                    Text("Activities for \(agent.name) will appear here.")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
            } else {
                LazyVStack(spacing: 4) {
                    ForEach(activities) { activity in
                        ActivityRowView(activity: activity)
                    }
                }
            }
        }
        .padding(.bottom)
    }

    // MARK: - Settings Tab

    private var settingsTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Agent Configuration")
                .sectionHeader()
                .padding(.horizontal)
                .padding(.top, 4)

            // Wake on market open
            settingsToggleRow(
                icon: "sunrise.fill",
                iconColor: .statusWarning,
                title: "Wake on market open",
                subtitle: "Automatically activate when market opens at 9:15 AM IST",
                isOn: $wakeOnMarketOpen
            )

            // Alert on critical findings
            settingsToggleRow(
                icon: "exclamationmark.bubble.fill",
                iconColor: .statusDanger,
                title: "Alert on critical findings",
                subtitle: "Push notification for high-priority alerts from this agent",
                isOn: $alertOnCritical
            )

            // Heartbeat interval
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: "heart.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.lossRed)
                        .frame(width: 28)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Heartbeat interval")
                            .font(.subheadline)
                            .foregroundStyle(.white)
                        Text("How often the agent checks in with status updates")
                            .font(.caption2)
                            .foregroundStyle(Color.textSecondary)
                    }
                }

                Picker("Heartbeat", selection: $heartbeatInterval) {
                    ForEach(HeartbeatInterval.allCases, id: \.self) { interval in
                        Text(interval.label).tag(interval)
                    }
                }
                .pickerStyle(.segmented)
            }
            .padding()
            .cardStyle()
            .padding(.horizontal)

            // Note about settings being local
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
                Text("Settings are stored locally and will apply when server sync is available.")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
            .padding(.horizontal)
            .padding(.top, 8)

            Spacer()
        }
        .padding(.bottom)
    }

    // MARK: - Settings Helpers

    private func settingsToggleRow(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        isOn: Binding<Bool>
    ) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(iconColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(Color.accentCyan)
        }
        .padding()
        .cardStyle()
        .padding(.horizontal)
    }
}

// MARK: - Supporting Types

enum AgentDetailTab: String, CaseIterable {
    case overview = "Overview"
    case history = "History"
    case settings = "Settings"
}

enum HeartbeatInterval: String, CaseIterable {
    case fifteenMin = "15min"
    case thirtyMin = "30min"
    case oneHour = "1hr"

    var label: String {
        switch self {
        case .fifteenMin: return "15 min"
        case .thirtyMin: return "30 min"
        case .oneHour: return "1 hr"
        }
    }
}
