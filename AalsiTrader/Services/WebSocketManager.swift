import Foundation

@Observable
final class WebSocketManager {
    static let shared = WebSocketManager()

    var isConnected = false

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession
    private var reconnectTask: Task<Void, Never>?

    // Callbacks
    var onAgentActivity: ((Activity) -> Void)?
    var onAgentStatusChange: ((String, AgentStatus, String?) -> Void)?
    var onCommMessage: ((CommMessage) -> Void)?
    var onPaperTradeOpen: ((PaperTrade) -> Void)?
    var onPaperTradeClose: ((PaperTrade) -> Void)?
    var onPaperPortfolioUpdate: ((PaperPortfolio) -> Void)?
    var onPaperSignalGenerated: (() -> Void)?

    private init() {
        self.session = URLSession(configuration: .default)
    }

    func connect() {
        guard webSocketTask == nil else { return }

        var urlString = Constants.wsBaseURL
        if let token = KeychainService.token {
            urlString += "?token=\(token)"
        }
        guard let url = URL(string: urlString) else { return }

        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        isConnected = true
        receiveMessage()
    }

    func disconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
    }

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self.receiveMessage()

            case .failure:
                self.handleDisconnect()
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }

        let decoder = JSONDecoder()

        Task { @MainActor in
            switch type {
            case "agentActivity":
                if let activityData = try? JSONSerialization.data(withJSONObject: json["activity"] ?? [:]),
                   let activity = try? decoder.decode(Activity.self, from: activityData) {
                    onAgentActivity?(activity)
                }

            case "agentStatusChange":
                if let agentId = json["agentId"] as? String,
                   let statusStr = json["status"] as? String,
                   let status = AgentStatus(rawValue: statusStr) {
                    onAgentStatusChange?(agentId, status, json["currentTask"] as? String)
                }

            case "commMessage":
                if let commData = try? JSONSerialization.data(withJSONObject: json["comm"] ?? [:]),
                   let comm = try? decoder.decode(CommMessage.self, from: commData) {
                    onCommMessage?(comm)
                }

            case "paperTradeOpen":
                if let tradeData = try? JSONSerialization.data(withJSONObject: json["trade"] ?? [:]),
                   let trade = try? decoder.decode(PaperTrade.self, from: tradeData) {
                    onPaperTradeOpen?(trade)
                }

            case "paperTradeClose":
                if let tradeData = try? JSONSerialization.data(withJSONObject: json["trade"] ?? [:]),
                   let trade = try? decoder.decode(PaperTrade.self, from: tradeData) {
                    onPaperTradeClose?(trade)
                }

            case "paperPortfolioUpdate":
                if let portfolioData = try? JSONSerialization.data(withJSONObject: json["portfolio"] ?? [:]),
                   let portfolio = try? decoder.decode(PaperPortfolio.self, from: portfolioData) {
                    onPaperPortfolioUpdate?(portfolio)
                }

            case "paperSignalGenerated":
                onPaperSignalGenerated?()

            default:
                break
            }
        }
    }

    private func handleDisconnect() {
        Task { @MainActor in
            isConnected = false
            webSocketTask = nil
            scheduleReconnect()
        }
    }

    private func scheduleReconnect() {
        reconnectTask?.cancel()
        reconnectTask = Task {
            try? await Task.sleep(for: .seconds(Constants.wsReconnectDelay))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self.connect()
            }
        }
    }
}
