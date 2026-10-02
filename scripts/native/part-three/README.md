# Local Part 3 simulator proof

Use only an explicitly isolated synthetic Supabase stack and the gated development build. No real accounts, credentials, external model calls, source imports or hosted operations are required or allowed by this harness. `scripts/part-three-local-smoke.mjs --ui` creates two synthetic anonymous owners and holds loopback controls on port 8353 until SIGTERM; its finally block erases its fixtures.

Generate an XCTest project with `ruby generate-project.rb /absolute/writable/output`. The Ruby environment needs the existing CocoaPods `xcodeproj` gem. The project points to this immutable Swift source. Build/install the Derive development client with Expo Network included. Run Metro with the three Part 1/2/3 public gates and the development-only `EXPO_PUBLIC_PART_THREE_FIXTURE_UI=true`, using a task-owned port. Open `derive://part-three-preview` after connecting that client to the local Metro server.

Run the three ordinary-size workflows serially, skipping `testUsabilityLargeTextAndLongName`. They share mutable fixture owners; parallel XCTest execution is invalid. The setup test precedes the context-conflict test, whose real SQL advance refuses the old preference CAS and proves draft retention plus unchanged routine/note/preference data. The comparison test withdraws the synthetic source’s purpose permission, which is the declared precondition for the subsequent nonpositive usability case.

For usability, set the simulator to `accessibility-extra-extra-extra-large` and increased contrast, start a fresh candidate and open `derive://part-three-preview?fixture=long`, then run only `testUsabilityLargeTextAndLongName`. Restore the original settings afterward. This asserts native accessibility traversal and control reachability for literal judgment/reason/scope, including a long admitted name. It does not establish a person’s screen-reader comprehension or physical-phone accessibility.

Export XCTest summaries and unchanged PNG attachments with `xcresulttool`; retain failed logs and recoveries separately. The final bundle records exact device, code, commands, hashes and exit outcomes.
