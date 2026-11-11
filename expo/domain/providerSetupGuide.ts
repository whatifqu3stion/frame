import type { KeyProvider } from "../storage/providerKeys";

export function setupGuidance(provider: KeyProvider) {
  return provider === "youtube"
    ? [
      "Open Google Cloud and sign in. Choose a project you control, or create one for Frame.",
      "In the API Library, find YouTube Data API v3 and enable it for that project.",
      "Open APIs & Services → Credentials → Create credentials → API key. Give this separate key a name such as Frame. Under API restrictions, restrict it to YouTube Data API v3 and save.",
      "Copy the key, return to Frame, open key entry, and paste it. Tap Verify & save. Keep the key private.",
    ]
    : [
      "Open Google AI Studio and sign in. Go to API keys and choose Create API key, using a project you control.",
      "Use a separate key for Frame, restricted to the Gemini API (Generative Language API). Review the project’s quota and billing before generating suggestions; budget alerts do not stop charges.",
      "Copy the key, return to Frame, open key entry, and paste it. Tap Verify & save. This verifies the key, not generation access or available quota.",
    ];
}
