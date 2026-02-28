import Foundation
import SwiftUI

struct Agent: Codable, Identifiable {
    let id: String
    var name: String
    var greek: String
    var role: String
    var color: String
    var status: AgentStatus
    var currentTask: String?
    var lastActivity: String?
    var stats: AgentStats?

    var displayColor: Color {
        AgentDefinitions.color(for: id)
    }
}

enum AgentStatus: String, Codable {
    case active
    case sleeping
    case error
}

struct AgentStats: Codable {
    var tasksCompleted: Int?
    var alertsSent: Int?
    var accuracy: Double?
}
