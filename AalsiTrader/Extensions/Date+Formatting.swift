import Foundation

extension Date {
    private static let istTimeZone = TimeZone(identifier: "Asia/Kolkata")!

    static func fromEpoch(_ epoch: Double) -> Date {
        Date(timeIntervalSince1970: epoch / 1000)
    }

    static func fromISO(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: string) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }

    var timeAgo: String {
        let seconds = Int(-timeIntervalSinceNow)
        if seconds < 60 { return "just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        if days < 7 { return "\(days)d ago" }
        return istFormatted("dd MMM")
    }

    func istFormatted(_ format: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.timeZone = Date.istTimeZone
        return formatter.string(from: self)
    }

    var istTime: String {
        istFormatted("HH:mm")
    }

    var istDateTime: String {
        istFormatted("dd MMM yyyy, HH:mm")
    }

    var istDateShort: String {
        istFormatted("dd MMM")
    }
}
