# Frame day-one feature contract

The owner confirmed September 25, 2026: ship the agreed MVP feature set with Premium, tested through RevenueCat before public billing. This supersedes the September 6 free-beta and deferred-Premium statements in earlier execution plans. Development and staging use test purchase credentials; public release requires separate store products, platform keys, and approval.

The app accepts monthly, yearly, or lifetime packages in the configured offering; the final store product and price are a commercial choice for the store setup. The server checks the matching active or unrefunded RevenueCat entitlement before each billable Deep Find request.

| Capability | Free | Premium test entitlement |
| --- | --- | --- |
| Pasted-link watching, Today, Saved, Sessions, selective Google import, Weekly Picks | Yes | Yes |
| Sources followed per profile | Up to 5 | Up to 25 |
| Profiles per installation | 1 | Up to 3 |
| New Managed profiles and protected controls | No | Yes |
| Paid Deep Find | No | 3 requests per UTC calendar month, server enforced |

Existing local follows and profiles are not deleted or hidden when an entitlement expires. A free user who is over the free ceiling cannot add more sources or profiles. Managed playback restrictions already set on a local profile continue to apply after expiry; the owner can still view or tighten them. Purchase status never authorizes costly backend work without a server-side RevenueCat check.

Rork owns native builds, signing, store console wiring, and device tests. Codex owns capability rules, server authorization and bounded paid discovery, regression tests, and environment review. The original larger plan's cloud sync, remote approvals, automatic unreviewed publication, and broad provider search remain outside this agreed day-one set.

The current app supports named Sessions. Do not silently replace them with the older plan's one-current-Session model during Premium work.
