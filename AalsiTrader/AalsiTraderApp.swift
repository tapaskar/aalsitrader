import SwiftUI

@main
struct AalsiTraderApp: App {
    init() {
        // Force dark mode
        let scenes = UIApplication.shared.connectedScenes
        for scene in scenes {
            if let windowScene = scene as? UIWindowScene {
                for window in windowScene.windows {
                    window.overrideUserInterfaceStyle = .dark
                }
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
