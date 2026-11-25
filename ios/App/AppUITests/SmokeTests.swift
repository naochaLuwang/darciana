import XCTest

final class SmokeTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppleSignInReachesNativeAuthorization() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.links["Profile"].waitForExistence(timeout: 30))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.915)).tap()
        let apple = app.webViews.buttons["Continue with Apple"]
        XCTAssertTrue(apple.waitForExistence(timeout: 20))
        apple.tap()
        // The unsigned simulator may reject Apple authorization or ask for an
        // Apple Account. Either outcome must come from native authorization,
        // rather than Capacitor rejecting an unregistered plugin.
        Thread.sleep(forTimeInterval: 5)
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "Apple native authorization"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        XCTAssertFalse(app.webViews.staticTexts.matching(NSPredicate(
            format: "label CONTAINS[c] %@", "not implemented"
        )).firstMatch.exists)
        let failedNatively = app.webViews.staticTexts[
            "Apple sign-in could not finish. Please try again."
        ].exists
        let appleAccountSheet = app.buttons["Cancel"].exists || app.buttons["Continue"].exists
        XCTAssertTrue(failedNatively || appleAccountSheet, "Native Apple authorization did not respond")
    }

    // Opt-in capture workflow. It browses the public catalog and changes only
    // this guest simulator's local bag/saved items; it never submits an order.
    func testCaptureAppStoreScreenshots() throws {
        guard ProcessInfo.processInfo.environment["DACIANA_SCREENSHOTS"] == "1" else {
            throw XCTSkip("App Store capture is opt-in.")
        }
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.links["Home"].waitForExistence(timeout: 35))

        func capture(_ name: String) {
            // Native accessibility readiness does not imply image decoding is
            // finished. Let the real Storage images settle before capture.
            Thread.sleep(forTimeInterval: 4)
            let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        func home() {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.915)).tap()
            XCTAssertTrue(app.webViews.links["Shop all"].firstMatch.waitForExistence(timeout: 20))
        }
        func product(_ search: String, name: String) {
            home()
            app.webViews.links["Shop all"].firstMatch.tap()
            let field = app.webViews.searchFields.firstMatch
            XCTAssertTrue(field.waitForExistence(timeout: 20))
            field.tap()
            field.typeText(search)
            let photo = app.webViews.links["View \(name)"]
            XCTAssertTrue(photo.waitForExistence(timeout: 20))
            photo.tap()
            XCTAssertTrue(app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Save product")).firstMatch.waitForExistence(timeout: 20))
        }

        // Abort rather than exposing any pre-existing signed-in profile.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.915)).tap()
        XCTAssertTrue(app.webViews.buttons["Continue with Apple"].waitForExistence(timeout: 20))
        home()
        capture("01-home")

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.915)).tap()
        XCTAssertTrue(app.webViews.staticTexts["Shop by category"].waitForExistence(timeout: 20))
        capture("02-categories")

        home()
        app.webViews.links["Shop all"].firstMatch.tap()
        XCTAssertTrue(app.webViews.searchFields.firstMatch.waitForExistence(timeout: 20))
        capture("03-shop")

        product("Inshine", name: "Inshine HD Full Coverage Foundation")
        capture("04-product")
        app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Save product")).firstMatch.tap()
        app.webViews.buttons["Add to bag"].tap()
        Thread.sleep(forTimeInterval: 4)

        product("Nivea", name: "Nivea Underarm Roll On")
        app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Save product")).firstMatch.tap()
        app.webViews.buttons["Add to bag"].tap()
        Thread.sleep(forTimeInterval: 4)

        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.915)).tap()
        XCTAssertTrue(app.webViews.staticTexts["Saved items"].waitForExistence(timeout: 20))
        capture("05-saved")

        let bag = app.webViews.links.matching(NSPredicate(format: "label BEGINSWITH %@", "Shopping bag,")).firstMatch
        XCTAssertTrue(bag.exists)
        bag.tap()
        XCTAssertTrue(app.webViews.links["Continue to checkout"].waitForExistence(timeout: 20))
        capture("06-bag")
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
        XCTAssertTrue(app.webViews.buttons["Continue with Apple"].exists)
        XCTAssertTrue(app.webViews.textFields.firstMatch.exists)
        let bag = app.webViews.links["Shopping bag, 0 items"]
        XCTAssertTrue(bag.exists)
        bag.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your bag is empty"].waitForExistence(timeout: 20))
    }
}
