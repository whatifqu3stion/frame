# Render web preview

The root `render.yaml` describes a Render static site for the `codex/full-app-byok` branch. It pins Node and Bun to the versions used by CI, installs the frozen lockfile, exports the Expo web bundle, and serves `expo/dist`.

## Deployment

Render must have GitHub access to the private `whatifqu3stion/frame` repository. Connect the repository in the intended Render workspace before creating the site. The Blueprint must be committed and pushed before Render can import it.

For a site created directly through the dashboard or connector, use these equivalent settings:

| Setting | Value |
| --- | --- |
| Branch | `codex/full-app-byok` |
| Root directory | Repository root (leave blank) |
| Build command | `cd expo && bun install --frozen-lockfile && node node_modules/expo/bin/cli export --platform web` |
| Publish directory | `expo/dist` |
| `NODE_VERSION` | `24.22.1` |
| `BUN_VERSION` | `1.4.4` |
| `EXPO_NO_DOTENV` | `1` |
| `EXPO_PUBLIC_APP_ENV` | `production` |

Add a **Rewrite** from `/*` to `/index.html` in Redirects/Rewrites. This supports opening and refreshing Expo Router paths directly. Files that exist, including JavaScript and images, are served normally.

YouTube and Gemini keys must not be build variables. Optional Google import requires its separate production OAuth configuration; see [BYOK](BYOK.md).

## Verification and limitations

Build locally from `expo/`:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=production bunx expo export --platform web
```

After deployment, open the public URL, finish onboarding, navigate between tabs, and refresh a nested route. Check that JavaScript, fonts, and images load successfully.

This deploys the existing browser preview. API-key entry and secure storage are native-only, and the web database uses in-memory preview storage that does not survive a reload. Publishing on Render does not enable native functionality or persistent browser data. The web preview does not open SQLite, so it does not require cross-origin isolation headers.

References: [Render static sites](https://render.com/docs/static-sites), [routing rules](https://render.com/docs/redirects-rewrites), [Bun versions](https://render.com/docs/bun-version), and [Expo web exports](https://docs.expo.dev/guides/publishing-websites/).
