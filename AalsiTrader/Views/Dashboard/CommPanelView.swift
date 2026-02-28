import SwiftUI

struct CommPanelView: View {
    let comms: [CommMessage]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Squad Comms")
                .sectionHeader()
                .padding(.horizontal)

            LazyVStack(spacing: 8) {
                ForEach(comms.prefix(20)) { comm in
                    CommBubbleView(comm: comm)
                }
            }
            .padding(.horizontal)
        }
    }
}
