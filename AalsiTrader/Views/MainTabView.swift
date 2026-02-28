import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    private let auth = AuthViewModel.shared

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            TabView(selection: $selectedTab) {
                DashboardView()
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }
                    .tag(0)

                PaperTradingView()
                    .tabItem {
                        Label("Trading", systemImage: "chart.line.uptrend.xyaxis")
                    }
                    .tag(1)

                ScreenerView()
                    .tabItem {
                        Label("Screener", systemImage: "magnifyingglass.circle.fill")
                    }
                    .tag(2)

                StraddleView()
                    .tabItem {
                        Label("Scalper", systemImage: "bolt.fill")
                    }
                    .tag(3)

                MoreView()
                    .tabItem {
                        Label("More", systemImage: "ellipsis.circle.fill")
                    }
                    .tag(4)
            }
            .tint(Color.accentCyan)

            // Floating chat button above tab bar
            FloatingChatButton()
                .padding(.trailing, 16)
                .padding(.bottom, 60)
        }
    }
}
