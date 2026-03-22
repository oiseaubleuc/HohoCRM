// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HohohSolutionsCRMNative",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "HohohSolutionsCRMNative", targets: ["HohohSolutionsCRMNative"])
    ],
    targets: [
        .executableTarget(
            name: "HohohSolutionsCRMNative",
            path: "Sources/HohohSolutionsCRMNative"
        )
    ]
)
