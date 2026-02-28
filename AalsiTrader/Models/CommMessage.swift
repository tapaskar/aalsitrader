import Foundation

struct CommMessage: Codable, Identifiable {
    let id: String
    let from: String
    let fromGreek: String
    let fromColor: String
    let to: String
    let toGreek: String
    let toColor: String
    let content: String
    let timestamp: ActivityTimestamp

    var date: Date {
        timestamp.asDate
    }
}
