import Foundation

struct Activity: Codable, Identifiable {
    let id: String
    let agentId: String
    let agentName: String
    let agentGreek: String
    let agentColor: String
    let type: ActivityType
    let content: String
    let timestamp: ActivityTimestamp
    var tags: [String]?
    var metadata: [String: AnyCodable]?

    var date: Date {
        timestamp.asDate
    }
}

enum ActivityType: String, Codable {
    case info
    case alert
    case success
    case warning
    case error
}

enum ActivityTimestamp: Codable {
    case epoch(Double)
    case isoString(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let epoch = try? container.decode(Double.self) {
            self = .epoch(epoch)
        } else if let str = try? container.decode(String.self) {
            self = .isoString(str)
        } else {
            throw DecodingError.typeMismatch(ActivityTimestamp.self, .init(codingPath: decoder.codingPath, debugDescription: "Expected Double or String"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .epoch(let val): try container.encode(val)
        case .isoString(let val): try container.encode(val)
        }
    }

    var asDate: Date {
        switch self {
        case .epoch(let val): return Date.fromEpoch(val)
        case .isoString(let val): return Date.fromISO(val) ?? Date()
        }
    }
}

// Generic Codable wrapper for arbitrary JSON
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intVal = try? container.decode(Int.self) { value = intVal }
        else if let doubleVal = try? container.decode(Double.self) { value = doubleVal }
        else if let boolVal = try? container.decode(Bool.self) { value = boolVal }
        else if let stringVal = try? container.decode(String.self) { value = stringVal }
        else if let arrayVal = try? container.decode([AnyCodable].self) { value = arrayVal.map(\.value) }
        else if let dictVal = try? container.decode([String: AnyCodable].self) { value = dictVal.mapValues(\.value) }
        else { value = NSNull() }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let v as Int: try container.encode(v)
        case let v as Double: try container.encode(v)
        case let v as Bool: try container.encode(v)
        case let v as String: try container.encode(v)
        default: try container.encodeNil()
        }
    }
}
