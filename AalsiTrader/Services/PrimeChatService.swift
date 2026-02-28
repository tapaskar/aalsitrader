import Foundation

// MARK: - Models

struct ChatMessage: Codable, Identifiable, Equatable {
    let id: String
    let role: ChatRole
    let content: String
    let timestamp: ActivityTimestamp
    let intent: String?

    var date: Date {
        timestamp.asDate
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
}

enum ChatRole: String, Codable {
    case user
    case assistant
}

struct ChatAgentActivity: Codable {
    let agentName: String
    let action: String
    let status: String?
}

// MARK: - Response Types

struct ChatHistoryResponse: Decodable {
    let messages: [ChatMessage]
}

struct ChatSendResponse: Decodable {
    let response: ChatResponseData
}

struct ChatResponseData: Decodable {
    let message: String
    let intent: String?
    let agentActivities: [ChatAgentActivity]?
}

// MARK: - Service

enum PrimeChatService {
    static func fetchHistory(limit: Int = 50) async throws -> [ChatMessage] {
        let response: ChatHistoryResponse = try await APIClient.shared.get(
            "/prime/chat/history",
            queryItems: [URLQueryItem(name: "limit", value: String(limit))]
        )
        return response.messages
    }

    static func sendMessage(_ message: String) async throws -> ChatSendResponse {
        try await APIClient.shared.post(
            "/prime/chat",
            body: ["message": message]
        )
    }
}
