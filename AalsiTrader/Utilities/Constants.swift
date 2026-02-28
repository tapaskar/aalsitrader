import Foundation

enum Constants {
    static let apiBaseURL = "https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod"
    static let wsBaseURL = "wss://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod"

    static let keychainService = "com.aalsitrader.ios"
    static let keychainTokenKey = "jwt_token"

    // Polling intervals (seconds)
    static let dashboardPollInterval: TimeInterval = 30
    static let straddlePollInterval: TimeInterval = 10
    static let brokerPollInterval: TimeInterval = 60

    // WebSocket reconnect delay
    static let wsReconnectDelay: TimeInterval = 5
}
