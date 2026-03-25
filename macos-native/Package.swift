// swift-tools-version: 5.9
import Foundation
import PackageDescription

/// Zet vóór `swift build`: `HOHOH_NO_SPARKLE=1` — dan wordt Sparkle níet eens opgehaald
/// (omzeilt kapotte Sparkle.xcframework caches / verkeerde oude paden).
private let noSparkle = ProcessInfo.processInfo.environment["HOHOH_NO_SPARKLE"] == "1"

private let sparklePackages: [Package.Dependency] =
    noSparkle
    ? []
    : [.package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0")]

private let sparkleProducts: [Target.Dependency] =
    noSparkle
    ? []
    : [.product(name: "Sparkle", package: "Sparkle")]

let package = Package(
    name: "HohohSolutionsCRMNative",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "HohohSolutionsCRMNative", targets: ["HohohSolutionsCRMNative"]),
    ],
    dependencies: sparklePackages,
    targets: [
        .executableTarget(
            name: "HohohSolutionsCRMNative",
            dependencies: sparkleProducts,
            path: "Sources/HohohSolutionsCRMNative",
        ),
    ],
)
