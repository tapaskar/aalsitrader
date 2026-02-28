import SwiftUI

struct PnLTextView: View {
    let value: Double
    var showSign: Bool = true
    var font: Font = .body

    var body: some View {
        Text("\(showSign && value > 0 ? "+" : "")\(value.inrFormatted)")
            .font(font)
            .foregroundStyle(value >= 0 ? Color.profitGreen : Color.lossRed)
    }
}
