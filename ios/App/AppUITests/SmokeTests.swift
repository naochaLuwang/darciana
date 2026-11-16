import XCTest

final class SmokeTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testStorefrontAndMoreNavigation() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30))
        let more = app.webViews.links["More"]
        XCTAssertTrue(more.waitForExistence(timeout: 30))
        more.tap()
        XCTAssertTrue(app.webViews.buttons["Share app"].waitForExistence(timeout: 20))
        let version = app.webViews.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Version")).firstMatch
        for _ in 0..<3 {
            if !version.exists { app.swipeUp() }
        }
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Daciana iPhone More"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        XCTAssertTrue(version.waitForExistence(timeout: 5), app.debugDescription)
    }

    func testProfileSignInAndBagNavigation() {
        let app = XCUIApplication()
        app.launch()
        let profile = app.webViews.links["Profile"]
        XCTAssertTrue(profile.waitForExistence(timeout: 30))
        profile.tap()
        XCTAssertTrue(app.webViews.buttons["Continue with Google"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.textFields.firstMatch.exists)
        let bag = app.webViews.links["Shopping bag, 0 items"]
        XCTAssertTrue(bag.exists)
        bag.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your bag is empty"].waitForExistence(timeout: 20))
    }
}
