import SwiftUI

/// Cartoon persona avatar for each AI agent
struct AgentAvatarView: View {
    let agentId: String
    var size: CGFloat = 44

    private var persona: AgentPersona {
        AgentPersona.persona(for: agentId)
    }

    var body: some View {
        ZStack {
            // Face circle
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            persona.color.opacity(0.3),
                            persona.color.opacity(0.1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)

            // Border ring
            Circle()
                .stroke(persona.color.opacity(0.5), lineWidth: size * 0.04)
                .frame(width: size, height: size)

            // Main icon
            Image(systemName: persona.icon)
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(persona.color)

            // Accessory badge (top-right)
            if let accessory = persona.accessory {
                Image(systemName: accessory)
                    .font(.system(size: size * 0.22, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(size * 0.04)
                    .background(
                        Circle()
                            .fill(persona.color)
                            .shadow(color: persona.color.opacity(0.5), radius: 2)
                    )
                    .offset(x: size * 0.32, y: -size * 0.32)
            }
        }
    }
}

// MARK: - Agent Persona Definitions

struct AgentPersona {
    let icon: String
    let accessory: String?
    let color: Color

    static func persona(for agentId: String) -> AgentPersona {
        switch agentId {
        case "alpha":
            // Professor - Research Agent: scholarly look
            return AgentPersona(
                icon: "graduationcap.fill",
                accessory: "magnifyingglass",
                color: Color.alphaRed
            )

        case "beta":
            // Techno-Kid - Technical Analyst: chart expert
            return AgentPersona(
                icon: "chart.xyaxis.line",
                accessory: "waveform.path.ecg",
                color: Color.betaTeal
            )

        case "gamma":
            // Risko-Frisco - Risk Manager: shield protector
            return AgentPersona(
                icon: "shield.checkered",
                accessory: "exclamationmark.triangle.fill",
                color: Color.gammaPurple
            )

        case "sigma":
            // Prime - Trade Hunter: targeting trades
            return AgentPersona(
                icon: "scope",
                accessory: "bolt.fill",
                color: Color.sigmaGreen
            )

        case "theta":
            // Macro - Macro Watcher: globe/news watcher
            return AgentPersona(
                icon: "globe.americas.fill",
                accessory: "eye.fill",
                color: Color.thetaOrange
            )

        case "delta":
            // Booky - Trade Journal: notebook recorder
            return AgentPersona(
                icon: "book.closed.fill",
                accessory: "pencil",
                color: Color.deltaBlue
            )

        default:
            return AgentPersona(
                icon: "person.crop.circle.fill",
                accessory: nil,
                color: .gray
            )
        }
    }
}

// MARK: - Previews

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()

        VStack(spacing: 20) {
            HStack(spacing: 16) {
                AgentAvatarView(agentId: "alpha", size: 56)
                AgentAvatarView(agentId: "beta", size: 56)
                AgentAvatarView(agentId: "gamma", size: 56)
            }
            HStack(spacing: 16) {
                AgentAvatarView(agentId: "sigma", size: 56)
                AgentAvatarView(agentId: "theta", size: 56)
                AgentAvatarView(agentId: "delta", size: 56)
            }

            // Large version
            AgentAvatarView(agentId: "sigma", size: 80)
        }
    }
}
