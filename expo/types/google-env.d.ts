declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    readonly EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID?: string;
    readonly EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    readonly EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
  }
}
