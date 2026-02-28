import Foundation

extension Double {
    /// Formats as Indian currency: ₹1,00,000.00
    var inrFormatted: String {
        let isNegative = self < 0
        let absValue = abs(self)
        let parts = String(format: "%.2f", absValue).split(separator: ".")
        let intPart = String(parts[0])
        let decPart = String(parts[1])

        let formatted: String
        if intPart.count <= 3 {
            formatted = intPart
        } else {
            let lastThree = String(intPart.suffix(3))
            var remaining = String(intPart.dropLast(3))
            var result: [String] = [lastThree]
            while remaining.count > 2 {
                result.insert(String(remaining.suffix(2)), at: 0)
                remaining = String(remaining.dropLast(2))
            }
            if !remaining.isEmpty {
                result.insert(remaining, at: 0)
            }
            formatted = result.joined(separator: ",")
        }

        return "\(isNegative ? "-" : "")₹\(formatted).\(decPart)"
    }

    /// Short format: ₹1.2L, ₹50K
    var inrShort: String {
        let absValue = abs(self)
        let sign = self < 0 ? "-" : ""
        if absValue >= 10_000_000 {
            return "\(sign)₹\(String(format: "%.1f", absValue / 10_000_000))Cr"
        } else if absValue >= 100_000 {
            return "\(sign)₹\(String(format: "%.1f", absValue / 100_000))L"
        } else if absValue >= 1_000 {
            return "\(sign)₹\(String(format: "%.1f", absValue / 1_000))K"
        }
        return "\(sign)₹\(String(format: "%.0f", absValue))"
    }

    /// Format as percentage
    var pctFormatted: String {
        String(format: "%.2f%%", self)
    }
}
