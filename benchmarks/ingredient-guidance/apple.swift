// Standalone synthetic-only benchmark; not an app/native-module integration.
// Build with an SDK containing FoundationModels and run on macOS 26+:
// swiftc -parse-as-library apple.swift -o /private/tmp/derive-apple-benchmark
// Input JSON: {instructions, corpusVersion, corpusSha256, cases:[{id,input}]}.
// Generate cases with corpus.ts projectCase; never feed actual profiles or photos.
// Usage: derive-apple-benchmark <input.json|-> <output.json>
import Foundation
import FoundationModels

@Generable
struct Explanation {
    @Guide(description: "One to four short cosmetic ingredient considerations, or empty when evidence is insufficient.", .count(0...4))
    var sentences: [String]
}

struct CosmeticContext: Codable {
    let goals: [String]
    let skinBehavior: String
    let reactivity: String
}
struct CosmeticInput: Codable {
    let productName: String
    let ingredientsText: String
    let category: String
    let context: CosmeticContext
}
struct Fixture: Decodable { let id: String; let input: CosmeticInput; let inputSha256: String? }
struct Corpus: Decodable {
    let instructions: String
    let instructionSha256: String?
    let corpusVersion: String
    let corpusSha256: String
    let cases: [Fixture]
}

func emit(_ value: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
    fflush(stdout)
}

@main
struct AppleSyntheticBenchmark {
    static func main() async throws {
        guard CommandLine.arguments.count == 3 else {
            throw NSError(domain: "AppleBenchmarkUsage", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Use <synthetic-input.json|-> <output.json>"])
        }
        let data = CommandLine.arguments[1] == "-"
            ? FileHandle.standardInput.readDataToEndOfFile()
            : try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        guard data.count <= 128_000 else { throw NSError(domain: "CorpusTooLarge", code: 1) }
        let corpus = try JSONDecoder().decode(Corpus.self, from: data)
        // Deliberately reject general-purpose runs. This corpus is invented cosmetic
        // text and enum-only context, not a clinical or real-user evaluation.
        guard corpus.corpusVersion == "synthetic-ingredient-guidance/2",
              corpus.cases.count == 12,
              corpus.cases.allSatisfy({ $0.input.productName == "Synthetic cosmetic test product" }) else {
            throw NSError(domain: "ExpectedSyntheticCorpus", code: 1)
        }
        guard #available(macOS 26.0, *) else {
            try emit(["status": "unavailable", "reason": "macOS 26 or later required"])
            return
        }
        let model = SystemLanguageModel.default
        var report: [String: Any] = [
            "provider": "apple_foundation_models",
            "modelIdentifier": "SystemLanguageModel.default (exact weights identifier not exposed by installed SDK)",
            "modelAvailability": String(describing: model.availability),
            "currentLocaleSupported": model.supportsLocale(),
            "macOSVersion": ProcessInfo.processInfo.operatingSystemVersionString,
            "corpusVersion": corpus.corpusVersion, "corpusSha256": corpus.corpusSha256,
            "sampling": "greedy", "maximumResponseTokens": 600,
            "defaultGuardrails": true, "tools": [], "newSessionPerCase": true,
            "source": "synthetic-only; no real products, photos, or customer data"
        ]
        var attempts: [[String: Any]] = []
        if let instructionHash = corpus.instructionSha256 { report["instructionSha256"] = instructionHash }
        if model.isAvailable && model.supportsLocale() {
            let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
            for fixture in corpus.cases {
                // IDs and expectations are never placed into the model prompt.
                let session = LanguageModelSession(model: model, instructions: corpus.instructions)
                let prompt = String(decoding: try encoder.encode(fixture.input), as: UTF8.self)
                let started = ContinuousClock.now
                var attempt: [String: Any] = ["caseId": fixture.id]
                if let inputHash = fixture.inputSha256 { attempt["inputSha256"] = inputHash }
                do {
                    let response = try await session.respond(to: prompt, generating: Explanation.self,
                        options: GenerationOptions(sampling: .greedy, maximumResponseTokens: 600))
                    attempt["status"] = response.content.sentences.isEmpty ? "no_answer" : "answer"
                    attempt["sentences"] = response.content.sentences
                } catch {
                    attempt["status"] = "error"
                    attempt["error"] = String(describing: error)
                }
                let elapsed = started.duration(to: .now).components
                attempt["milliseconds"] = Double(elapsed.seconds) * 1000 + Double(elapsed.attoseconds) / 1e15
                attempts.append(attempt)
                try emit(attempt)
            }
        } else {
            report["status"] = "unavailable"
        }
        report["cases"] = attempts
        let output = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        try output.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
        try emit(["status": attempts.count == 12 ? "complete" : "unavailable",
                  "cases": attempts.count, "output": CommandLine.arguments[2]])
    }
}
