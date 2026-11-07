import appConfig from "../app.json";

// Frame uses the same application identifier for its iOS and Android clients.
export const GOOGLE_NATIVE_CALLBACK = `${appConfig.expo.android.package}:/oauthredirect`;
