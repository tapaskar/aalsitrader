import Foundation

@Observable
final class AdminViewModel {
    var users: [User] = []
    var stats: AdminService.SystemStats?
    var isLoading = false
    var error: String?
    var searchText = ""

    var filteredUsers: [User] {
        guard !searchText.isEmpty else { return users }
        return users.filter {
            $0.email.localizedCaseInsensitiveContains(searchText) ||
            $0.username.localizedCaseInsensitiveContains(searchText)
        }
    }

    func loadAll() async {
        isLoading = true
        error = nil
        do {
            async let u = AdminService.fetchUsers()
            async let s = AdminService.fetchStats()
            let (users, stats) = try await (u, s)
            self.users = users
            self.stats = stats
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func updatePlan(email: String, plan: PlanType, status: PlanStatus) async {
        do {
            try await AdminService.updatePlan(email: email, plan: plan, planStatus: status)
            await loadAll()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func updateTrial(email: String, days: Int) async {
        do {
            try await AdminService.updateTrial(email: email, days: days)
            await loadAll()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func updateTrading(email: String, enabled: Bool) async {
        do {
            try await AdminService.updateTrading(email: email, enabled: enabled)
            await loadAll()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func updateAccount(email: String, enabled: Bool) async {
        do {
            try await AdminService.updateAccount(email: email, enabled: enabled)
            await loadAll()
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }

    func deleteUser(email: String) async {
        do {
            try await AdminService.deleteUser(email: email)
            users.removeAll { $0.email == email }
            HapticService.success()
        } catch {
            self.error = error.localizedDescription
            HapticService.error()
        }
    }
}
