import SwiftUI

struct UserDetailSheet: View {
    let user: User
    @Bindable var vm: AdminViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPlan: PlanType
    @State private var selectedPlanStatus: PlanStatus
    @State private var trialDays = 7
    @State private var showDeleteConfirm = false

    init(user: User, vm: AdminViewModel) {
        self.user = user
        self.vm = vm
        _selectedPlan = State(initialValue: user.plan ?? .starter)
        _selectedPlanStatus = State(initialValue: user.planStatus ?? .trial)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // User info
                        VStack(spacing: 8) {
                            Text(user.username)
                                .font(.title2.bold())
                                .foregroundStyle(.white)
                            Text(user.email)
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary)
                            HStack {
                                PillBadgeView(text: user.role.rawValue.uppercased(), color: user.isAdmin ? Color.statusWarning : Color.accentCyan)
                                if let plan = user.plan {
                                    PillBadgeView(text: plan.rawValue.uppercased(), color: Color.accentCyan)
                                }
                            }
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .cardStyle()

                        // Plan management
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Plan Management")
                                .font(.headline).foregroundStyle(.white)

                            Picker("Plan", selection: $selectedPlan) {
                                Text("Starter").tag(PlanType.starter)
                                Text("Pro").tag(PlanType.pro)
                                Text("Premium").tag(PlanType.premium)
                            }
                            .pickerStyle(.segmented)

                            Picker("Status", selection: $selectedPlanStatus) {
                                Text("Active").tag(PlanStatus.active)
                                Text("Trial").tag(PlanStatus.trial)
                                Text("Expired").tag(PlanStatus.expired)
                            }
                            .pickerStyle(.segmented)

                            Button("Update Plan") {
                                Task {
                                    await vm.updatePlan(email: user.email, plan: selectedPlan, status: selectedPlanStatus)
                                    dismiss()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.accentCyan)
                        }
                        .padding()
                        .cardStyle()

                        // Trial management
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Trial Extension")
                                .font(.headline).foregroundStyle(.white)

                            Stepper("Days: \(trialDays)", value: $trialDays, in: 1...90)
                                .foregroundStyle(.white)

                            Button("Extend Trial") {
                                Task {
                                    await vm.updateTrial(email: user.email, days: trialDays)
                                    dismiss()
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.statusWarning)
                        }
                        .padding()
                        .cardStyle()

                        // Trading toggle
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Trading Controls")
                                .font(.headline).foregroundStyle(.white)

                            Toggle("Live Trading", isOn: Binding(
                                get: { user.liveTradingEnabled ?? false },
                                set: { newVal in
                                    Task { await vm.updateTrading(email: user.email, enabled: newVal) }
                                }
                            ))
                            .tint(Color.profitGreen)
                            .foregroundStyle(.white)

                            Toggle("Account Enabled", isOn: Binding(
                                get: { user.accountEnabled ?? true },
                                set: { newVal in
                                    Task { await vm.updateAccount(email: user.email, enabled: newVal) }
                                }
                            ))
                            .tint(Color.accentCyan)
                            .foregroundStyle(.white)
                        }
                        .padding()
                        .cardStyle()

                        // Delete user
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete User", systemImage: "trash")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.statusDanger)
                    }
                    .padding()
                }
            }
            .navigationTitle("User Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
            .alert("Delete User?", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task {
                        await vm.deleteUser(email: user.email)
                        dismiss()
                    }
                }
            } message: {
                Text("This action cannot be undone. All data for \(user.email) will be permanently deleted.")
            }
        }
    }
}
