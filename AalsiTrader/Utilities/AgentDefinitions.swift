import SwiftUI

struct AgentDefinition {
    let id: String
    let name: String
    let greek: String
    let role: String
    let color: Color
    let defaultStatus: String
}

enum AgentDefinitions {
    static let all: [AgentDefinition] = [
        AgentDefinition(id: "alpha", name: "Professor", greek: "α", role: "Research Agent", color: .alphaRed, defaultStatus: "active"),
        AgentDefinition(id: "beta", name: "Techno-Kid", greek: "β", role: "Technical Analyst", color: .betaTeal, defaultStatus: "active"),
        AgentDefinition(id: "gamma", name: "Risko-Frisco", greek: "γ", role: "Risk Manager", color: .gammaPurple, defaultStatus: "active"),
        AgentDefinition(id: "sigma", name: "Prime", greek: "Σ", role: "Trade Hunter", color: .sigmaGreen, defaultStatus: "active"),
        AgentDefinition(id: "theta", name: "Macro", greek: "θ", role: "Macro Watcher", color: .thetaOrange, defaultStatus: "sleeping"),
        AgentDefinition(id: "delta", name: "Booky", greek: "δ", role: "Trade Journal", color: .deltaBlue, defaultStatus: "sleeping"),
    ]

    static func definition(for id: String) -> AgentDefinition? {
        all.first { $0.id == id }
    }

    static func color(for agentId: String) -> Color {
        definition(for: agentId)?.color ?? .gray
    }

    static func greek(for agentId: String) -> String {
        definition(for: agentId)?.greek ?? "?"
    }

    static func name(for agentId: String) -> String {
        definition(for: agentId)?.name ?? agentId
    }
}
