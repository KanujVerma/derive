import XCTest
final class CombinedCheckUI: XCTestCase {
 let app=XCUIApplication(bundleIdentifier:"com.derive.skincare")
 override func setUpWithError() throws {
  continueAfterFailure=false
  let system=XCUIApplication(bundleIdentifier:"com.apple.springboard")
  if system.buttons["Open"].waitForExistence(timeout:2){system.buttons["Open"].tap()}
 }
 func testDevelopmentClientConnection() throws {
  app.activate()
  if app.buttons["Continue"].waitForExistence(timeout:5){app.buttons["Continue"].tap()}
  let loaded=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in self.contains("Derive could not connect").exists || self.contains("Check").exists || self.element("Load Part3 local fixture").exists},object:app)
  XCTAssertEqual(XCTWaiter.wait(for:[loaded],timeout:90),.completed,app.debugDescription)
  shot("combined-native-host-loaded")
 }
 func element(_ label:String)->XCUIElement {app.descendants(matching:.any).matching(NSPredicate(format:"label == %@",label)).firstMatch}
 func contains(_ label:String)->XCUIElement {app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@",label)).firstMatch}
 func scroll()->XCUIElement{let region=app.otherElements["result-sheet-scroll"].firstMatch;let sheet=region.scrollViews.firstMatch;if sheet.exists{return sheet};let views=app.scrollViews;return views.count>1 ? views.element(boundBy:views.count-1) : views.firstMatch}
 func tap(_ label:String){let target=element(label);if target.exists && target.isHittable{target.tap();return};if app.keyboards.firstMatch.exists && scroll().exists{scroll().swipeDown()};for _ in 0..<30{if target.exists && target.isHittable{target.tap();return};if scroll().exists{if target.exists && target.frame.midY < scroll().frame.minY+12{scroll().swipeDown()}else{scroll().swipeUp()}}};XCTFail("Unreachable: \(label)\n\(app.debugDescription)")}
 func expand(){let handle=element("Product result");let ready=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in let f=handle.frame;return !f.isEmpty && !f.isInfinite && f.intersects(self.app.frame)},object:handle);XCTAssertEqual(XCTWaiter.wait(for:[ready],timeout:15),.completed,"Sheet handle must have an on-screen frame: \(app.debugDescription)");print("SHEET_GEOMETRY \(handle.frame) \(handle.value ?? "none")");if (handle.value as? String) != "Expanded"{tap("Product result")};XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == %@","Expanded"),object:handle)],timeout:10),.completed)}
 func choose(_ label:String){tap(label);XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"value CONTAINS %@ AND NOT value CONTAINS %@","checked","unchecked"),object:element(label))],timeout:10),.completed,"Choice did not select: \(label)")}
 func shot(_ name:String){let a=XCTAttachment(screenshot:app.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
 func close(){let target=element("Close result");var prior=CGRect.null;let stable=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in let frame=target.frame;defer{prior=frame};return target.exists && target.isHittable && !frame.isEmpty && frame == prior},object:target);XCTAssertEqual(XCTWaiter.wait(for:[stable],timeout:10),.completed,"Close control must finish its sheet transition");tap("Close result");XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:element("Close result"))],timeout:10),.completed)}
 func testComparisonQuestionSaveReopenWithdrawalAndOwner() throws {
  continueAfterFailure=false;app.activate();if app.buttons["Open"].exists{app.buttons["Open"].tap()}
  if element("Close result").exists{close()}
  XCTAssertTrue(element("Load Part3 local fixture").waitForExistence(timeout:20),app.debugDescription);tap("Load Part3 local fixture")
  XCTAssertTrue(element("Product result").waitForExistence(timeout:30));XCTAssertTrue(contains("Not enough info").waitForExistence(timeout:30),app.debugDescription);XCTAssertTrue(contains("Purpose, application site or use form needs clarification.").exists,app.debugDescription);XCTAssertFalse(contains("Ingredient details").exists,"Collapsed result must earn an immediate judgment before detail disclosure");shot("part-three-collapsed-immediate-judgment");expand()
  XCTAssertTrue(contains("Not enough info").waitForExistence(timeout:35),app.debugDescription);shot("part-three-first-card-bounded-insufficiency")
  tap("Compare or describe this check");tap("Original synthetic current cream")
  XCTAssertTrue(element("Replace this item").waitForExistence(timeout:30),app.debugDescription);shot("part-three-one-material-intent-question")
  tap("Replace this item");XCTAssertFalse(element("Replace this item").exists);choose("Moisturizing");choose("Face");choose("Leave on")
  XCTAssertTrue(contains("Worth considering").waitForExistence(timeout:30),app.debugDescription)
  XCTAssertTrue(contains("Its label matches the step you want to replace.").exists);XCTAssertTrue(contains("Published list").exists)
  XCTAssertFalse(element("Replace this item").exists);shot("part-three-earned-replacement-card")
  tap("Close comparison choices");tap("Worth considering");tap("Its label matches the step you want to replace.");shot("part-three-earned-first-card-visible");tap("Save this assessment")
  XCTAssertTrue(element("Assessment saved").waitForExistence(timeout:20),app.debugDescription);shot("part-three-exact-assessment-save")
  // Retained recall tests may durably revoke the reference card. Exact identity
  // survives independently; this flow must not require recalled reference prose.
  tap("Ingredient details: Glycerin");tap("Listed as: Glycerin");XCTAssertTrue(contains("Listed as: Glycerin").exists,app.debugDescription);XCTAssertFalse(contains("reference humectant role").exists,"Durably recalled reference wording must not return");shot("part-three-unaffected-ingredient-detail");tap("Close ingredient detail")
  close();tap("Reopen Part3 saved assessment");XCTAssertTrue(element("Product result").waitForExistence(timeout:20));expand()
  XCTAssertTrue(contains("Assessment when saved").waitForExistence(timeout:20),app.debugDescription)
  XCTAssertTrue(contains("Current assessment").exists);XCTAssertTrue(contains("Worth considering").exists);XCTAssertFalse(element("Replace this item").exists);shot("part-three-reopened-history-versus-current")
  close();tap("Take synthetic client offline");tap("Reopen Part3 saved assessment")
  // The harness refuses offline transport. Its last mounted personal bodies were
  // removed by closing; no current green or saved prose may return offline.
  XCTAssertFalse(contains("Worth considering").exists);shot("part-three-native-offline-no-current-authority")
  tap("Withdraw Part3 purpose field");XCTAssertTrue(contains("Synthetic purpose field withdrawn").waitForExistence(timeout:15));tap("Reconnect synthetic client");tap("Reopen Part3 saved assessment")
  XCTAssertTrue(element("Product result").waitForExistence(timeout:20));expand()
  XCTAssertTrue(contains("The earlier personal assessment is no longer available.").waitForExistence(timeout:30),app.debugDescription)
  XCTAssertTrue(contains("Not enough info").waitForExistence(timeout:30),app.debugDescription);XCTAssertFalse(contains("Worth considering").exists);XCTAssertFalse(contains("Its label matches the step").exists)
  tap("Ingredient details: Glycerin");tap("Listed as: Glycerin");XCTAssertTrue(contains("Listed as: Glycerin").exists,app.debugDescription);XCTAssertFalse(contains("reference humectant role").exists,"Durably recalled reference wording must not return");shot("part-three-withdrawn-purpose-safe-ingredient-survival");tap("Close ingredient detail")
  close();tap("Switch Part3 fixture account");XCTAssertFalse(contains("Worth considering").exists);XCTAssertFalse(contains("Original synthetic authority fixture").exists);shot("part-three-owner-clear")
 }
 func testFiveStepAtomicSetupAndConfirmedPreference() throws {
  continueAfterFailure=false;app.activate();if app.buttons["Open"].exists{app.buttons["Open"].tap()}
  if element("Close result").exists{close()}
  XCTAssertTrue(element("Open five-step setup").waitForExistence(timeout:20),app.debugDescription);tap("Open five-step setup")
  XCTAssertTrue(contains("Step 1 of 5").waitForExistence(timeout:20));tap("Dryness");tap("Continue")
  XCTAssertTrue(contains("Step 2 of 5").waitForExistence(timeout:10));tap("Dry or tight");tap("Usually not");tap("Continue")
  XCTAssertTrue(contains("Step 3 of 5").waitForExistence(timeout:10))
  let search=app.textFields["Search catalog products"].firstMatch;XCTAssertTrue(search.exists);search.tap();search.typeText("Synthetic setup current lotion");tap("Add this name")
  tap("Moisturizing");tap("Face");tap("Leave on");tap("How’s it working for you?");tap("Works well");tap("Continue")
  XCTAssertTrue(contains("Step 4 of 5").waitForExistence(timeout:10));tap("None that I remember");tap("Continue")
  XCTAssertTrue(contains("Step 5 of 5").waitForExistence(timeout:10));tap("Add a confirmed preference");tap("An extra skincare step");tap("Firm constraint");tap("I confirm this choice and its strength");tap("Use confirmed preference")
  let note=app.textViews.matching(NSPredicate(format:"label BEGINSWITH %@","Anything else")).firstMatch;for _ in 0..<12{if note.isHittable{break};scroll().swipeUp()};XCTAssertTrue(note.exists);note.tap();note.typeText("Synthetic private setup note; no hidden ingredient inference.")
  tap("Done editing note");shot("part-three-five-step-explicit-save-disclosure");tap("Save skin setup")
  XCTAssertTrue(contains("Atomic five-step setup saved and reopened from SQL").waitForExistence(timeout:25),app.debugDescription)
  let completed=DispatchSemaphore(value:0);var responseJSON:[String:Any]?;var responseStatus:Int?
  URLSession.shared.dataTask(with:URL(string:"http://127.0.0.1:8373/setup-result")!){data,response,_ in responseStatus=(response as? HTTPURLResponse)?.statusCode;if let data=data{responseJSON=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any]};completed.signal()}.resume()
  XCTAssertEqual(completed.wait(timeout:.now()+20),.success);XCTAssertEqual(responseStatus,200)
  let read=try XCTUnwrap(responseJSON);XCTAssertEqual(read["revision"] as? Int,1);XCTAssertEqual((read["current"] as? [[String:Any]])?.first?["name"] as? String,"Synthetic setup current lotion");XCTAssertEqual((read["assessment"] as? [[String:Any]])?.first?["perceivedHelp"] as? String,"helps");XCTAssertEqual((read["assessment"] as? [[String:Any]])?.first?["satisfaction"] as? String,"unanswered");XCTAssertEqual((read["preferences"] as? [[String:Any]])?.first?["kind"] as? String,"no_extra_step");XCTAssertEqual(read["noteCount"] as? Int,1);shot("part-three-atomic-setup-acknowledged")
 }

 func controlRequest(_ path:String,method:String="GET") throws ->[String:Any] {
  let completed=DispatchSemaphore(value:0);var payload:[String:Any]=[:];var status:Int?
  var r=URLRequest(url:URL(string:"http://127.0.0.1:8373"+path)!);r.httpMethod=method
  URLSession.shared.dataTask(with:r){data,response,_ in status=(response as? HTTPURLResponse)?.statusCode;if let data=data{payload=((try? JSONSerialization.jsonObject(with:data)) as? [String:Any]) ?? [:]};completed.signal()}.resume()
  XCTAssertEqual(completed.wait(timeout:.now()+20),.success);XCTAssertEqual(status,200);return payload
 }
 func testNativeContextConflictRetainsDraft() throws {
  continueAfterFailure=false;app.activate();tap("Open confirmed preferences")
  XCTAssertTrue(contains("Your confirmed preferences").waitForExistence(timeout:20));tap("Add a confirmed preference");choose("Choose exact ingredient: Glycerin");choose("Firm constraint");choose("I confirm this choice and its strength");tap("Use confirmed preference")
  XCTAssertTrue(contains("Glycerin · Firm constraint").exists);_ = try controlRequest("/advance-setup-context",method:"POST")
  tap("Save confirmed preferences");XCTAssertTrue(contains("Your saved context changed. Your draft remains here.").waitForExistence(timeout:20),app.debugDescription);XCTAssertTrue(contains("Glycerin · Firm constraint").exists)
  let read=try controlRequest("/setup-result");XCTAssertEqual(read["revision"] as? Int,2);XCTAssertEqual((read["preferences"] as? [[String:Any]])?.count,1);XCTAssertEqual((read["preferences"] as? [[String:Any]])?.first?["kind"] as? String,"no_extra_step");XCTAssertEqual((read["current"] as? [[String:Any]])?.first?["name"] as? String,"Synthetic setup current lotion");XCTAssertEqual(read["noteCount"] as? Int,1);shot("part-three-native-stale-context-draft-retained");tap("Back")
 }
 func testUsabilityLargeTextAndLongName() throws {
  continueAfterFailure=false;app.activate();XCTAssertTrue(element("Product result").waitForExistence(timeout:25),app.debugDescription);expand()
  XCTAssertTrue(contains("Not enough info").waitForExistence(timeout:30),app.debugDescription)
  let labels=app.staticTexts.allElementsBoundByIndex.map{$0.label};let name=try XCTUnwrap(labels.firstIndex(where:{$0.contains("deliberately long multilingual product name")}));let judgment=try XCTUnwrap(labels.firstIndex(of:"Not enough info"));let reason=try XCTUnwrap(labels.firstIndex(where:{$0.contains("The available evidence cannot support a judgment for this purpose.")}));let scope=try XCTUnwrap(labels.firstIndex(of:"Published list · Package not confirmed"));XCTAssertLessThan(name,judgment);XCTAssertLessThan(judgment,reason);XCTAssertLessThan(reason,scope)
  shot("part-three-large-text-long-name-first-card");tap("Not enough info");shot("part-three-large-text-judgment-visible");tap("The available evidence cannot support a judgment for this purpose.");shot("part-three-large-text-reason-visible");tap("Published list · Package not confirmed");shot("part-three-large-text-scope-visible");tap("Compare or describe this check");choose("Moisturizing");choose("Face");choose("Leave on");XCTAssertFalse(contains("Worth considering").exists);shot("part-three-large-text-controls-reachable-without-color-authority");close()
 }


 func testNormalCheckNameSearchComparisonSkipSaveAndMyStuff() throws {
  continueAfterFailure=false;app.activate()
  _ = try controlRequest("/restore-purpose",method:"POST")
  if element("Close result").exists{close()}
  tap("Load Part3 local fixture");XCTAssertTrue(element("Product result").waitForExistence(timeout:25));close()
  let initial=try controlRequest("/integration-state")
  tap("Open normal Check with synthetic session")
  XCTAssertTrue(element("Search catalog products").waitForExistence(timeout:30),app.debugDescription)
  let input=element("Search catalog products");input.tap();input.typeText("Original synthetic\n")
  let item=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Check Synthetic Original synthetic authority fixture")).firstMatch
  XCTAssertTrue(item.waitForExistence(timeout:30),app.debugDescription);item.tap()
  XCTAssertTrue(element("Product result").waitForExistence(timeout:30),app.debugDescription)
  XCTAssertTrue(contains("Not enough info").waitForExistence(timeout:30),app.debugDescription)
  XCTAssertEqual(app.staticTexts.matching(NSPredicate(format:"label == %@","Personal Fit")).count,1,"One Personal Fit surface")
  XCTAssertEqual(app.staticTexts.matching(NSPredicate(format:"label == %@","Original synthetic authority fixture")).count,1,"One product identity")
  shot("combined-normal-check-collapsed")
  expand();tap("Compare or describe this check");tap("Original synthetic current cream")
  XCTAssertTrue(element("Skip this question for this check").waitForExistence(timeout:20),app.debugDescription)
  tap("Skip this question for this check");XCTAssertFalse(element("Skip this question for this check").exists)
  choose("Replace one item");choose("Moisturizing");choose("Face");choose("Leave on")
  XCTAssertTrue(contains("Worth considering").waitForExistence(timeout:30),app.debugDescription)
  tap("Close comparison choices");tap("Save product");XCTAssertTrue(element("Saved").waitForExistence(timeout:20),app.debugDescription)
  tap("Compare or describe this check");tap("Save this assessment");XCTAssertTrue(element("Assessment saved").waitForExistence(timeout:20),app.debugDescription)
  tap("Close comparison choices");shot("combined-normal-check-separate-saves")
  tap("Search by name");XCTAssertTrue(element("Back to result").waitForExistence(timeout:15));XCTAssertFalse(contains("Worth considering").exists)
  tap("Back to result");XCTAssertTrue(element("Product result").waitForExistence(timeout:15));expand();XCTAssertTrue(contains("Worth considering").waitForExistence(timeout:20));XCTAssertFalse(element("Skip this question for this check").exists)
  shot("combined-search-back-preserves-encounter")
  close();tap("My Stuff")
  XCTAssertTrue(contains("Saved product evidence").waitForExistence(timeout:25),app.debugDescription)
  let saved=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","Open assessment saved ")).firstMatch
  for _ in 0..<20{if saved.exists && saved.isHittable{break};app.scrollViews.firstMatch.swipeUp()}
  XCTAssertTrue(saved.exists,app.debugDescription);saved.tap();XCTAssertTrue(element("Product result").waitForExistence(timeout:25));expand()
  XCTAssertTrue(contains("Assessment when saved").waitForExistence(timeout:25),app.debugDescription);XCTAssertTrue(contains("Current assessment").exists);XCTAssertTrue(contains("Worth considering").exists);shot("combined-normal-my-stuff-reopen-history-current")
  let state=try controlRequest("/integration-state")
  XCTAssertEqual(state["saves"] as? Int,(initial["saves"] as? Int ?? 0)+1)
  XCTAssertEqual(state["assessments"] as? Int,(initial["assessments"] as? Int ?? 0)+1)
  let counts=try XCTUnwrap(state["counts"] as? [String:Int]);XCTAssertGreaterThanOrEqual(counts["search"] ?? 0,1);XCTAssertEqual(counts["scan"],1)
  close()
 }
}
