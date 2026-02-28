import SwiftUI

struct AdminView: View {
    @State private var vm = AdminViewModel()
    @State private var selectedTab = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    Picker("Tab", selection: $selectedTab) {
                        Text("Overview").tag(0)
                        Text("Users").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .padding()

                    ScrollView {
                        switch selectedTab {
                        case 0:
                            if let stats = vm.stats {
                                AdminOverviewView(stats: stats)
                                    .padding(.horizontal)
                            }
                        case 1:
                            UserListView(
                                users: vm.filteredUsers,
                                searchText: $vm.searchText,
                                vm: vm
                            )
                            .padding(.horizontal)
                        default:
                            EmptyView()
                        }
                    }
                    .refreshable {
                        await vm.loadAll()
                    }
                }

                if vm.isLoading && vm.stats == nil {
                    LoadingView(label: "Loading admin...")
                }
            }
            .navigationTitle("Admin")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.loadAll()
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
