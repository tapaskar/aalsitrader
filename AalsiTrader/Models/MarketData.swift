import Foundation

struct MarketIndex: Codable, Identifiable {
    var id: String { name }
    let name: String
    let value: Double
    let change: Double
    let changePercent: Double
}

struct MarketDataResponse: Codable {
    let indices: [MarketIndex]?
    let marketOpen: Bool?
}
