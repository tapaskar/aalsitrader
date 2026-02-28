import SwiftUI

struct AgentListView: View {
    let agents: [Agent]
    var activities: [Activity] = []
    @State private var selectedAgent: Agent?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Squad")
                .sectionHeader()
                .padding(.horizontal)

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10)
            ], spacing: 10) {
                ForEach(agents) { agent in
                    AgentCardView(agent: agent)
                        .onTapGesture {
                            HapticService.selection()
                            selectedAgent = agent
                        }
                }
            }
            .padding(.horizontal)
        }
        .sheet(item: $selectedAgent) { agent in
            AgentDetailSheet(
                agent: agent,
                activities: activities.filter { $0.agentId == agent.id }
            )
        }
    }
}
