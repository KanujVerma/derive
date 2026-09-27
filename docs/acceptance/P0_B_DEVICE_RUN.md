# P0-B physical and native operator run

Status: **PHYSICAL INTERACTIONS NOT RUN**. The physical iPhone is available and connected. This packet is ready for an operator; no completed checklist is implied.

## Identify the run

Record current source revision, iPhone/OS, Expo Go version or actual Derive binary build, environment and run date. The installed historical Derive 1.0.0 build 10 is not current P0-B source. All-app inventory confirms physical Expo Go 57.0.9 build 1017880. Xcode CLI physical launch is available; its UI automation tools expose Simulator controls only. Do not use iPhone Mirroring.

For a Mock source run, use a task-local Metro server with dotenv disabled, development flavor and Remote service false. In the current session its own port is 8131, and the intended URL is `exp://172.20.10.4:8131/--/personalize/fixture?mode=profile`. This temporary IP/URL must be checked again for a later session. Physical launch initially returned **Locked**, so no source load was observed. Unlocking the phone and reaching the current DEVELOPMENT FIXTURE screen is a prerequisite, not a completed interaction gate.

The DEVELOPMENT FIXTURE banner must remain visible in a fixture run. Its synthetic actions are local and unsaved; they cannot establish service acceptance.

The actual local Remote app is separately prepared from merged source `be853d237d6b7bc1e5f3252ebeb88cf7f3f46c0f`, on `exp://172.20.10.4:8135`, with development flavor, Remote service true, dotenv disabled, and both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_DEV_SUPABASE_LAN_URL` set to `http://172.20.10.4:54321`. Its public local key is captured privately, never copied into the record. The local LAN API health check returned 200. This is an intended normal app URL, not a fixture route. It must still be loaded and observed on the unlocked phone. Do not use a client Auth bypass, fabricate an entitlement, or point a development test at hosted production.

## Execute and record

For each row record Pass/Fail/Blocked/Not run, exact screen, input/action and result. Verify the result on screen; a tool reporting a successful tap or text injection is insufficient.

| Physical check | Procedure | Current evidence |
| --- | --- | --- |
| Navigation | Open the current source; enter/leave Personalization and return to originating Check; Back preserves useful facts | Not run |
| Primary/secondary goals and cap | Choose one primary and two secondary goals. Attempt a third secondary; it must not select. Remove one, choose another, and change primary to an already selected secondary; each goal appears once | Not run |
| Exact keyboard text | Add a manual routine product named `Synthetic QA Cedar 123, café`. Read back every character; edit to `Synthetic QA Cedar 124, café`; confirm no reordering/truncation | Not run |
| Routine editing | Change timing/frequency/use state, remove the added product, apply and return. For service runs reload and verify the saved revision | Not run |
| Experience correction | Correct a no-reaction report to a reaction report, apply and return. For service runs reload; the effective report replaces the earlier one without claiming cause or tolerance | Not run |
| Disclosure | Expand rationale/evidence, inspect supported reason and uncertainty, return without losing the decision | Not run |
| Skip | Skip optional personalization; factual result remains useful and no skipped answer becomes "no" | Not run |
| Sessions | In actual local service mode use distinct disposable A and B identities plus sign-out. No A context/decision may appear for B; A's return loads only A's own current data | Not run |
| Error/retry | In an actual service run disconnect before load/save/evaluate, observe recoverable unconfirmed/unavailable state, reconnect and retry. No invented result or duplicate committed change | Not run |

Exercise supported positive, redundancy, active/caution overlap, missing formula, reformulation/history, prior reaction, partial routine and materially relevant unknown context. Record factual evidence, conditional action, routine impact, uncertainty and next step for each. A fixture or script case is not a physical service observation.

## Close the run

Keep only anonymous, nonsensitive evidence. Restore task-owned MCP defaults and server/runtime state. Record any unobserved item explicitly. A physical development run does not establish hosted, TestFlight, release-candidate or unassisted human acceptance.
