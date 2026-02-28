import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL: String
    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        self.baseURL = Constants.apiBaseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
        self.decoder = JSONDecoder()
    }

    // MARK: - Core request

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: [String: Any]? = nil,
        queryItems: [URLQueryItem]? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        var components = URLComponents(string: "\(baseURL)\(path)")!
        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth, let token = KeychainService.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.serverError(httpResponse.statusCode, message ?? "Unknown error")
        }

        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Convenience methods

    func get<T: Decodable>(_ path: String, queryItems: [URLQueryItem]? = nil, requiresAuth: Bool = true) async throws -> T {
        try await request("GET", path: path, queryItems: queryItems, requiresAuth: requiresAuth)
    }

    func post<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
        try await request("POST", path: path, body: body)
    }

    func put<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
        try await request("PUT", path: path, body: body)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await request("DELETE", path: path)
    }

    // POST/PUT/DELETE with no return
    func postVoid(_ path: String, body: [String: Any]? = nil) async throws {
        let _: EmptyResponse = try await request("POST", path: path, body: body)
    }

    func putVoid(_ path: String, body: [String: Any]? = nil) async throws {
        let _: EmptyResponse = try await request("PUT", path: path, body: body)
    }

    func deleteVoid(_ path: String) async throws {
        let _: EmptyResponse = try await request("DELETE", path: path)
    }
}

// MARK: - Supporting types

enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case serverError(Int, String)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid response from server"
        case .unauthorized: return "Session expired. Please login again."
        case .serverError(_, let msg): return msg
        case .decodingError(let err): return "Data error: \(err.localizedDescription)"
        }
    }
}

struct EmptyResponse: Decodable {}
