import Foundation

/// File names for a `.cook` file. The requested name comes from the web extension
/// and is treated as untrusted.
enum CookFileName {
    static let suffix = ".cook"
    /// Leaves room under the file system's 255-byte limit for " (999)".
    static let maxBytes = 240

    /// The file name to use for a requested one, or nil when it is refused.
    /// Only the last path component is kept. Refused: an empty name, a name that
    /// starts with a dot, one that does not end in `.cook`, one with a path
    /// separator or control character left in it, and one that is too long.
    static func sanitize(_ requested: String) -> String? {
        let name = (requested as NSString).lastPathComponent
        guard !name.isEmpty, !name.hasPrefix("."), name.hasSuffix(suffix), name.count > suffix.count else { return nil }
        guard name.utf8.count <= maxBytes else { return nil }
        let forbidden = name.unicodeScalars.contains { scalar in
            scalar == "/" || scalar == ":" || scalar.properties.generalCategory == .control
        }
        return forbidden ? nil : name
    }

    /// The name to try on the given attempt: the name itself first, then
    /// `stem (1).cook`, `stem (2).cook`, …
    static func candidate(_ name: String, attempt: Int) -> String {
        guard attempt > 0 else { return name }
        return "\(name.dropLast(suffix.count)) (\(attempt))\(suffix)"
    }
}

enum CookFileError: Error, Equatable {
    case badName
    case tooLarge
    /// Every candidate name is taken.
    case noFreeName
    case io(Int32)

    /// What the web extension is told.
    var code: String {
        switch self {
        case .badName: return "bad_name"
        case .tooLarge: return "too_large"
        case .noFreeName: return "no_free_name"
        case .io: return "io"
        }
    }
}

/// Writes `.cook` files into one directory, never over an existing file.
struct CookFileSaver {
    static let maxBytes = 2 * 1024 * 1024
    static let maxAttempts = 1000

    let directory: URL

    /// Write `text` as UTF-8 and return the name the file got.
    ///
    /// The text goes into a hidden temporary file in the same directory first, and
    /// that is renamed with RENAME_EXCL: the file appears under its name complete
    /// or not at all, and the rename fails instead of replacing a file that is
    /// already there (then the next name is tried).
    func save(text: String, requestedName: String) throws -> String {
        guard let name = CookFileName.sanitize(requestedName) else { throw CookFileError.badName }
        let data = Data(text.utf8)
        guard data.count <= Self.maxBytes else { throw CookFileError.tooLarge }

        let temporary = directory.appendingPathComponent(".\(UUID().uuidString).cook-part")
        do {
            try data.write(to: temporary, options: .withoutOverwriting)
        } catch {
            throw CookFileError.io((error as NSError).domain == NSPOSIXErrorDomain ? Int32((error as NSError).code) : EIO)
        }
        defer { try? FileManager.default.removeItem(at: temporary) } // a no-op after a successful rename

        for attempt in 0..<Self.maxAttempts {
            let candidate = CookFileName.candidate(name, attempt: attempt)
            if renamex_np(temporary.path, directory.appendingPathComponent(candidate).path, UInt32(RENAME_EXCL)) == 0 {
                return candidate
            }
            guard errno == EEXIST else { throw CookFileError.io(errno) }
        }
        throw CookFileError.noFreeName
    }
}

/// The native side of the extension's `save-cook` message:
/// `{ type: "save-cook", filename, text }` → `{ ok: true, filename }` or `{ ok: false, error }`.
enum CookSaveMessage {
    static func reply(to message: Any?, saver: CookFileSaver?) -> [String: Any] {
        guard let message = message as? [String: Any],
              message["type"] as? String == "save-cook",
              let filename = message["filename"] as? String,
              let text = message["text"] as? String
        else { return failure("bad_message") }
        guard let saver = saver else { return failure("no_downloads_folder") }

        do {
            return ["ok": true, "filename": try saver.save(text: text, requestedName: filename)]
        } catch let error as CookFileError {
            return failure(error.code)
        } catch {
            return failure("io")
        }
    }

    private static func failure(_ code: String) -> [String: Any] {
        ["ok": false, "error": code]
    }
}
