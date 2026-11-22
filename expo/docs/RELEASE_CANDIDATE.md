# Frame Android build 7

[Download the signed APK and verification files](https://github.com/whatifqu3stion/frame/releases/tag/v1.0.0-android.7).

Build 7 brings Frame to Android TV and Google TV. The same signed APK installs on Android phones and compatible TVs. TV mode adds a launcher banner, left navigation rail, visible remote focus, and viewing-room controls for the directional pad.

On your TV, select a YouTube or Gemini key field and paste from the paired Google TV phone remote. The TV-only tip appears in onboarding and when editing a key in Settings. You can skip keys to explore the app.

Install the APK over an earlier signed version to preserve local data. With an authorized TV connected, run `adb -s TV_SERIAL install -r Frame-1.0.0-7.apk`.

Verified the signed APK on an Android TV 12 emulator and checked its phone and TV launcher entries. TypeScript and 507 automated tests passed. Lint reported zero errors and one existing warning. Physical Hisense remote pairing, phone clipboard transfer and live playback remain hardware checks.

## Build identity

- Application source `e6232ecbf92c417b8befbea750871b6e636e4ac0`.
- APK SHA-256 `5f3a7fbebcbdbf3b4e99753abb9c8b8ddee64970698031dd52238fd8300a6f03`.
- Signing certificate SHA-256 `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc`, matching build 6.
- Android API 24 minimum, target API 36. All 46 packaged 64-bit native libraries passed the 16 KB alignment check.

[Machine-readable verification](../../research/release-pass/build-7/verification.json) · [Device acceptance plan](SMOKE_TEST.md)
