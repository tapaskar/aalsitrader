import Foundation

struct BrokerPortfolio: Codable {
    let positions: [BrokerPosition]?
    let holdings: [BrokerHolding]?
    let funds: BrokerFunds?
    let broker: String?
    let needsBrokerSetup: Bool?
    let error: String?
}

struct BrokerPosition: Codable, Identifiable {
    var id: String { tradingsymbol ?? tradingSymbol ?? UUID().uuidString }
    let tradingsymbol: String?
    let tradingSymbol: String?
    let exchange: String?
    let exchangeSegment: String?
    let quantity: Int?
    let netQty: Int?
    let average_price: Double?
    let buyAvg: Double?
    let last_price: Double?
    let lastPrice: Double?
    let pnl: Double?
    let dayPnl: Double?
    let product: String?
    let productType: String?

    var symbol: String? { tradingsymbol ?? tradingSymbol }
    var qty: Int { quantity ?? netQty ?? 0 }
    var avgPrice: Double { average_price ?? buyAvg ?? 0 }
    var currentPrice: Double { last_price ?? lastPrice ?? 0 }
    var profit: Double { pnl ?? dayPnl ?? 0 }
}

struct BrokerHolding: Codable, Identifiable {
    var id: String { tradingsymbol ?? tradingSymbol ?? UUID().uuidString }
    let tradingsymbol: String?
    let tradingSymbol: String?
    let quantity: Int?
    let average_price: Double?
    let last_price: Double?
    let pnl: Double?

    var symbol: String? { tradingsymbol ?? tradingSymbol }
    var avgPrice: Double { average_price ?? 0 }
    var currentPrice: Double { last_price ?? 0 }
    var profit: Double { pnl ?? 0 }
    var qty: Int { quantity ?? 0 }
}

struct BrokerFunds: Codable {
    let availableBalance: Double?
    let usedMargin: Double?
    let totalBalance: Double?
    let dayPnl: Double?
}
