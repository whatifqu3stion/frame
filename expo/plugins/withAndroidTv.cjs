const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainActivity } = require("expo/config-plugins");
const { copyFile, mkdir } = require("node:fs/promises");
const path = require("node:path");

module.exports = function withAndroidTv(config) {
  config = withAndroidManifest(config, (mod) => {
    const xml = mod.modResults;
    const features = xml.manifest["uses-feature"] ??= [];
    for (const name of ["android.software.leanback", "android.hardware.touchscreen"]) {
      let feature = features.find((entry) => entry.$["android:name"] === name);
      if (!feature) features.push(feature = { $: { "android:name": name } });
      feature.$["android:required"] = "false";
    }
    AndroidConfig.Manifest.getMainApplicationOrThrow(xml).$["android:banner"] = "@drawable/frame_tv_banner";
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(xml);
    const launcher = activity["intent-filter"].find((filter) =>
      filter.action?.some((action) => action.$["android:name"] === "android.intent.action.MAIN") &&
      filter.category?.some((category) => category.$["android:name"] === "android.intent.category.LAUNCHER"));
    if (!launcher) throw new Error("Frame needs its main launcher activity for Android TV.");
    const tvCategory = "android.intent.category.LEANBACK_LAUNCHER";
    if (!launcher.category.some((category) => category.$["android:name"] === tvCategory)) {
      launcher.category.push({ $: { "android:name": tvCategory } });
    }
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    const call = "studio.frame.tv.RemoteFocus.install(this)";
    const source = mod.modResults.contents;
    if (!source.includes(call)) {
      const superCall = /super\.onCreate\((?:null|savedInstanceState)\)/;
      if (!superCall.test(source)) throw new Error("Unable to attach Frame's TV focus indicator.");
      mod.modResults.contents = source.replace(superCall, (line) => line + "\n    " + call);
    }
    return mod;
  });
  return withDangerousMod(config, ["android", async (mod) => {
    const main = path.join(mod.modRequest.platformProjectRoot, "app/src/main");
    for (const [filename, folder] of [
      ["frame_tv_banner.png", "res/drawable-xhdpi"],
      ["RemoteFocus.kt", "java/studio/frame/tv"],
    ]) {
      await mkdir(path.join(main, folder), { recursive: true });
      await copyFile(path.join(__dirname, "android-tv", filename), path.join(main, folder, filename));
    }
    return mod;
  }]);
};
