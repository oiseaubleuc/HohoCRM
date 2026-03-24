// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HohohSolutionsCRMNative",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "HohohSolutionsCRMNative", targets: ["HohohSolutionsCRMNative"])
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0")
    ],
    targets: [
        .executableTarget(
            name: "HohohSolutionsCRMNative",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle")
            ],
            path: "Sources/HohohSolutionsCRMNative"
        )
    ]
)
