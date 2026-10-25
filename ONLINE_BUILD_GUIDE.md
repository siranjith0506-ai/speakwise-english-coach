# SpeakWise Android APK — online-only build

This project is prepared for a cloud build with GitHub Actions. You do not need Android Studio or local coding software.

## Before you start
- Create or use a GitHub account.
- This workflow produces a **debug/testing APK** for your own phone.
- The floating S button requires Android's **Display over other apps / Appear on top** permission.
- Tapping the floating button opens SpeakWise. Use the existing Speak & Correct feature inside the app to record and copy the polished result.
- This package does **not yet provide genuine AI grammar correction**; the current web app's text cleanup is basic. A real AI correction service needs a backend/API, and API usage may not be free.

## Upload through GitHub's website
1. Open https://github.com/new and create a repository named `speakwise-android`. For easiest setup, choose **Public**.
2. In the new repository choose **Add file → Upload files**.
3. Upload the contents of this ZIP (the files and folders inside it, not the ZIP itself). Make sure `.github/workflows/build-apk.yml` is included. If GitHub's upload page hides `.github`, create the workflow from the GitHub web editor as a separate file at `.github/workflows/build-apk.yml`.
4. Commit the files to the `main` branch.
5. Open the repository's **Actions** tab.
6. Choose **Build SpeakWise Android APK** → **Run workflow** → **Run workflow**.
7. Wait for the workflow to finish successfully.
8. Open the completed run and download the **SpeakWise-Android-APK** artifact. GitHub downloads it as a ZIP; extract `app-debug.apk`.
9. Send the APK to your Android phone and open it. If asked, allow installation from that source.
10. Open SpeakWise and allow **Display over other apps** when Android asks. If it doesn't appear automatically, open Android Settings → Apps → Special app access → Display over other apps → SpeakWise → Allow.
11. The floating **S** button should appear over other apps. Tap it to open SpeakWise.

## Important
- The workflow creates a native shell plus a basic floating overlay. Test on your own phone before relying on it.
- Android versions and manufacturers differ; battery/background restrictions may stop a floating service. You may need to allow background activity.
- Do not publish this debug APK to Google Play as a production release.
- Never place private AI API keys in `app.js` or any public GitHub repository.
