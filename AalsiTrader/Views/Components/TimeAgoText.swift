import SwiftUI

struct TimeAgoText: View {
    let date: Date
    var font: Font = .caption
    var color: Color = .textMuted

    var body: some View {
        Text(date.timeAgo)
            .font(font)
            .foregroundStyle(color)
    }
}
