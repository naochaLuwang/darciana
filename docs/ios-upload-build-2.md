# Upload Daciana 1.0.4 (2)

Prepared 19 November 2026. Bundle ID: `com.luwangtech.daciana`. Team: `VJ6CZ336M8`. Device family: iPhone. Minimum OS: iOS 16.4.

Build 2 corrects scene startup so the native Apple sign-in and messaging plugins register. The native simulator test reaches Apple's authorization handler; an unsigned simulator returns an authorization error. A successful customer login still needs a signed TestFlight test.

Local files:

- Archive: `artifacts/ios/Daciana-1.0.4-2.xcarchive`
- IPA: `artifacts/ios/Daciana-1.0.4-2.ipa`
- Verification: `artifacts/ios/technical-readiness.json`
- IPA checksum: `artifacts/ios/Daciana-1.0.4-2.ipa.sha256`

## 1. Remove build 1 from review

The owner reported Waiting for Review or In Review. In [App Store Connect](https://appstoreconnect.apple.com/apps/6835797825/distribution), open Daciana's iOS version 1.0.4. Click **remove this version from review** in the banner and confirm **Remove**. Alternatively, open **App Review**, select the submission, then **Cancel Submission** and confirm. The resulting **Developer Rejected** status is expected for a withdrawal. Resubmission restarts review.

[Apple: remove a submission](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/remove-a-submission-from-review/)

## 2. Upload the prepared archive through Xcode

1. Double-click `artifacts/ios/Daciana-1.0.4-2.xcarchive` to open it in Xcode. If needed, choose **Window > Organizer > Archives**.
2. Select Daciana and confirm **Version 1.0.4 (2)** and bundle ID `com.luwangtech.daciana`.
3. Click **Distribute App**. To keep the existing manual signing and build number, choose **Custom > App Store Connect > Upload**.
4. Keep symbol upload enabled. Turn off **Manage version and build numbers** to preserve build 2. Leave **TestFlight internal testing only** off so the build can also be submitted to the App Store.
5. If prompted for signing, choose **Manually manage signing**, team **SOMOJIT ARAMBAM (VJ6CZ336M8)**, the existing **Apple Distribution** certificate, and the App Store profile for `com.luwangtech.daciana`.
6. Review the summary, then click **Upload**. Complete Apple sign-in or Keychain prompts locally if requested. Keep passwords and verification codes out of chat.
7. Wait for **Upload Successful** and Apple's processing email. Check **Daciana > TestFlight** for **1.0.4 (2)**. Investigate processing errors rather than repeatedly uploading the same build number.

Xcode may also offer **TestFlight & App Store** as a preset. The custom path above makes manual signing and build-number choices explicit. The already exported IPA can instead be delivered through Apple's Transporter app, if installed.

[Apple: distributing an archive](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases), [Apple: upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

## 3. Test and replace the selected build

1. Complete export compliance if App Store Connect requests it; the app's encryption behavior is unchanged from build 1.
2. Add build 2 to the appropriate TestFlight group and verify Apple sign-in and sign-out on a signed installation. A physical-iPhone tester is needed for final acceptance; simulator success does not establish real Apple login or APNs delivery.
3. Open **Distribution > iOS App 1.0.4 > Build**. Hover over build 1 and click the minus button to remove its association. This leaves the old binary in the account.
4. Click **+**, select **1.0.4 (2)**, click **Done**, then **Save**.
5. Confirm the review account works and the review notes, screenshots, privacy answers, category and pricing are still complete.
6. Click **Add for Review**, open the submission and click **Submit for Review** when ready.

The app record, bundle ID, marketing version and existing screenshots are reused. Build 2 has been prepared locally; no upload, withdrawal or submission was performed by the agent.

[Apple: choose a build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/)
