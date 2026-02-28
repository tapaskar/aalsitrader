import SwiftUI

struct ContentView: View {
    @State private var auth = AuthViewModel.shared

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                AuthContainerView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: auth.isAuthenticated)
    }
}
