// swift-tools-version:5.9
// The file-saving logic of the Safari extension handler, as a package so that it
// can be tested with `swift test`. The Xcode project compiles the same source file
// into the extension target; it does not depend on this package.
import PackageDescription

let package = Package(
    name: "CookFileSaver",
    platforms: [.macOS(.v13)],
    targets: [
        .target(name: "CookFileSaver"),
        .testTarget(name: "CookFileSaverTests", dependencies: ["CookFileSaver"]),
    ]
)
