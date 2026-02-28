import Foundation

@Observable
final class DashboardViewModel {
    var agents: [Agent] = AgentDefinitions.all.map { def in
        Agent(id: def.id, name: def.name, greek: def.greek, role: def.role, color: def.id, status: AgentStatus(rawValue: def.defaultStatus) ?? .active, currentTask: nil, lastActivity: nil, stats: nil)
    }

    var activities: [Activity] = []
    var comms: [CommMessage] = []
    var filter: String = "all"
    var isLoading = false
    var error: String?

    private var pollingTask: Task<Void, Never>?
    private let ws = WebSocketManager.shared

    var filteredActivities: [Activity] {
        guard filter != "all" else { return activities }
        if filter == "alerts" {
            return activities.filter { $0.type == .alert || $0.type == .warning }
        }
        if filter == "trades" {
            return activities.filter { $0.tags?.contains("trade") == true }
        }
        return activities.filter { $0.agentId == filter }
    }

    var filterOptions: [(id: String, label: String)] {
        [
            ("all", "All"),
            ("alpha", "Professor"),
            ("beta", "Techno-Kid"),
            ("gamma", "Risko"),
            ("sigma", "Prime"),
            ("theta", "Macro"),
            ("delta", "Booky"),
            ("alerts", "Alerts"),
            ("trades", "Trades"),
        ]
    }

    // MARK: - Data Loading

    func loadData() async {
        isLoading = true
        error = nil
        do {
            async let activitiesResult = DashboardService.fetchActivities()
            async let commsResult = DashboardService.fetchComms()
            let (acts, cms) = try await (activitiesResult, commsResult)
            activities = acts.sorted { $0.date > $1.date }
            comms = cms.sorted { $0.date > $1.date }
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    // MARK: - WebSocket

    func setupWebSocket() {
        ws.onAgentActivity = { [weak self] activity in
            guard let self else { return }
            // Deduplicate
            if !self.activities.contains(where: { $0.id == activity.id }) {
                self.activities.insert(activity, at: 0)
                if self.activities.count > 200 {
                    self.activities = Array(self.activities.prefix(200))
                }
            }
        }

        ws.onAgentStatusChange = { [weak self] agentId, status, task in
            guard let self else { return }
            if let idx = self.agents.firstIndex(where: { $0.id == agentId }) {
                self.agents[idx].status = status
                self.agents[idx].currentTask = task
            }
        }

        ws.onCommMessage = { [weak self] comm in
            guard let self else { return }
            if !self.comms.contains(where: { $0.id == comm.id }) {
                self.comms.insert(comm, at: 0)
            }
        }

        ws.connect()
    }

    // MARK: - Polling

    func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Constants.dashboardPollInterval))
                guard !Task.isCancelled else { break }
                await loadData()
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
