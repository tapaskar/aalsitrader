import SwiftUI

struct UserListView: View {
    let users: [User]
    @Binding var searchText: String
    @Bindable var vm: AdminViewModel
    @State private var selectedUser: User?

    var body: some View {
        VStack(spacing: 12) {
            SearchBarView(text: $searchText, placeholder: "Search users...")

            Text("\(users.count) users")
                .font(.caption)
                .foregroundStyle(Color.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)

            if users.isEmpty {
                EmptyStateView(icon: "person.slash", title: "No users found")
            } else {
                LazyVStack(spacing: 6) {
                    ForEach(users, id: \.email) { user in
                        UserRowView(user: user)
                            .onTapGesture {
                                selectedUser = user
                            }
                    }
                }
            }
        }
        .sheet(item: $selectedUser) { user in
            UserDetailSheet(user: user, vm: vm)
        }
    }
}

extension User: Identifiable {
    var id: String { email }
}
