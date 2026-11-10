import XCTest
@testable import CookFileSaver

final class CookFileNameTests: XCTestCase {
    func testKeepsAPlainName() {
        XCTAssertEqual(CookFileName.sanitize("lemon-chicken.cook"), "lemon-chicken.cook")
        XCTAssertEqual(CookFileName.sanitize("пирог с капустой.cook"), "пирог с капустой.cook")
    }

    func testTakesOnlyTheLastPathComponent() {
        XCTAssertEqual(CookFileName.sanitize("../../Library/LaunchAgents/evil.cook"), "evil.cook")
        XCTAssertEqual(CookFileName.sanitize("/etc/passwd/x.cook"), "x.cook")
        XCTAssertEqual(CookFileName.sanitize("sub/dir/soup.cook/"), "soup.cook")
    }

    func testRefusesEmptyAndDotNames() {
        for name in ["", "/", "..", ".", ".cook", ".hidden.cook", "a/.cook", "dir/..", "x/../.zshrc.cook"] {
            XCTAssertNil(CookFileName.sanitize(name), name)
        }
    }

    func testRefusesOtherExtensions() {
        for name in ["soup", "soup.txt", "soup.cook.sh", "soup.cook ", "soup.COOK", "soup.cook.app", "soup.command", "cook"] {
            XCTAssertNil(CookFileName.sanitize(name), name)
        }
    }

    func testRefusesSeparatorsAndControlCharacters() {
        for name in ["a:b.cook", "a\u{0}b.cook", "a\nb.cook", "a\u{7F}b.cook", "a\u{85}b.cook"] {
            XCTAssertNil(CookFileName.sanitize(name), name.debugDescription)
        }
    }

    func testRefusesOverlongNames() {
        XCTAssertNotNil(CookFileName.sanitize(String(repeating: "a", count: 235) + ".cook"))
        XCTAssertNil(CookFileName.sanitize(String(repeating: "a", count: 236) + ".cook"))
        XCTAssertNil(CookFileName.sanitize(String(repeating: "я", count: 120) + ".cook")) // 240 bytes + 5
    }

    func testCandidates() {
        XCTAssertEqual(CookFileName.candidate("soup.cook", attempt: 0), "soup.cook")
        XCTAssertEqual(CookFileName.candidate("soup.cook", attempt: 1), "soup (1).cook")
        XCTAssertEqual(CookFileName.candidate("soup.cook", attempt: 12), "soup (12).cook")
        XCTAssertEqual(CookFileName.candidate("a.cook.cook", attempt: 2), "a.cook (2).cook")
    }
}

final class CookFileSaverTests: XCTestCase {
    private var directory: URL!
    private var saver: CookFileSaver!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("CookFileSaverTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        saver = CookFileSaver(directory: directory)
    }

    override func tearDownWithError() throws {
        try FileManager.default.removeItem(at: directory)
    }

    private func contents(_ name: String) throws -> String {
        try String(contentsOf: directory.appendingPathComponent(name), encoding: .utf8)
    }

    private func listing() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path).sorted()
    }

    func testWritesUTF8() throws {
        let text = "Жарить @курицу{8%шт} ~{25%minutes}. 🍗\n"
        XCTAssertEqual(try saver.save(text: text, requestedName: "курица.cook"), "курица.cook")
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent("курица.cook")), Data(text.utf8))
        XCTAssertEqual(try listing(), ["курица.cook"]) // no temporary file left behind
    }

    func testNeverOverwrites() throws {
        XCTAssertEqual(try saver.save(text: "first", requestedName: "soup.cook"), "soup.cook")
        XCTAssertEqual(try saver.save(text: "second", requestedName: "soup.cook"), "soup (1).cook")
        XCTAssertEqual(try saver.save(text: "third", requestedName: "soup.cook"), "soup (2).cook")
        XCTAssertEqual(try contents("soup.cook"), "first")
        XCTAssertEqual(try contents("soup (1).cook"), "second")
        XCTAssertEqual(try contents("soup (2).cook"), "third")
        XCTAssertEqual(try listing(), ["soup (1).cook", "soup (2).cook", "soup.cook"])
    }

    func testDoesNotReplaceADirectoryOrSymlinkOfThatName() throws {
        try FileManager.default.createDirectory(at: directory.appendingPathComponent("soup.cook"), withIntermediateDirectories: false)
        let outside = directory.appendingPathComponent("target.txt")
        try "keep".write(to: outside, atomically: true, encoding: .utf8)
        try FileManager.default.createSymbolicLink(at: directory.appendingPathComponent("soup (1).cook"), withDestinationURL: outside)

        XCTAssertEqual(try saver.save(text: "new", requestedName: "soup.cook"), "soup (2).cook")
        XCTAssertEqual(try String(contentsOf: outside, encoding: .utf8), "keep")
    }

    func testStaysInsideItsDirectory() throws {
        XCTAssertEqual(try saver.save(text: "x", requestedName: "../escape.cook"), "escape.cook")
        XCTAssertEqual(try listing(), ["escape.cook"])
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.deletingLastPathComponent().appendingPathComponent("escape.cook").path))
    }

    func testRefusesBadNamesWithoutWriting() throws {
        XCTAssertThrowsError(try saver.save(text: "x", requestedName: ".zshrc")) { XCTAssertEqual($0 as? CookFileError, .badName) }
        XCTAssertThrowsError(try saver.save(text: "x", requestedName: "run.command")) { XCTAssertEqual($0 as? CookFileError, .badName) }
        XCTAssertEqual(try listing(), [])
    }

    func testCapsTheSize() throws {
        let limit = String(repeating: "a", count: CookFileSaver.maxBytes)
        XCTAssertEqual(try saver.save(text: limit, requestedName: "big.cook"), "big.cook")
        XCTAssertThrowsError(try saver.save(text: limit + "a", requestedName: "bigger.cook")) { XCTAssertEqual($0 as? CookFileError, .tooLarge) }
        // The cap is on bytes, not characters.
        XCTAssertThrowsError(try saver.save(text: String(repeating: "я", count: CookFileSaver.maxBytes / 2 + 1), requestedName: "wide.cook")) {
            XCTAssertEqual($0 as? CookFileError, .tooLarge)
        }
        XCTAssertEqual(try listing(), ["big.cook"])
    }

    func testReportsAMissingDirectory() {
        let missing = CookFileSaver(directory: directory.appendingPathComponent("nope"))
        XCTAssertThrowsError(try missing.save(text: "x", requestedName: "soup.cook")) { error in
            guard case .io = error as? CookFileError else { return XCTFail("\(error)") }
        }
    }
}

final class CookSaveMessageTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("CookSaveMessageTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try FileManager.default.removeItem(at: directory)
    }

    private func reply(_ message: Any?) -> NSDictionary {
        CookSaveMessage.reply(to: message, saver: CookFileSaver(directory: directory)) as NSDictionary
    }

    func testSavesAndAnswersWithTheName() throws {
        let message: [String: Any] = ["type": "save-cook", "filename": "soup.cook", "text": "Boil."]
        XCTAssertEqual(reply(message), ["ok": true, "filename": "soup.cook"])
        XCTAssertEqual(reply(message), ["ok": true, "filename": "soup (1).cook"])
        XCTAssertEqual(try String(contentsOf: directory.appendingPathComponent("soup.cook"), encoding: .utf8), "Boil.")
    }

    func testRefusesOtherMessages() {
        let bad: [Any?] = [
            nil,
            "save-cook",
            ["type": "other", "filename": "soup.cook", "text": "x"],
            ["type": "save-cook", "filename": "soup.cook"],
            ["type": "save-cook", "filename": 7, "text": "x"],
            ["type": "save-cook", "filename": "soup.cook", "text": ["x"]],
        ]
        for message in bad {
            XCTAssertEqual(reply(message), ["ok": false, "error": "bad_message"])
        }
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: directory.path), [])
    }

    func testAnswersWithTheReason() {
        XCTAssertEqual(reply(["type": "save-cook", "filename": "soup.sh", "text": "x"]), ["ok": false, "error": "bad_name"])
        let big = String(repeating: "a", count: CookFileSaver.maxBytes + 1)
        XCTAssertEqual(reply(["type": "save-cook", "filename": "soup.cook", "text": big]), ["ok": false, "error": "too_large"])
        XCTAssertEqual(
            CookSaveMessage.reply(to: ["type": "save-cook", "filename": "soup.cook", "text": "x"], saver: nil) as NSDictionary,
            ["ok": false, "error": "no_downloads_folder"]
        )
    }
}
