# Frame day-one feature contract

The owner confirmed September 25, 2026: ship the agreed MVP feature set with Premium, tested through RevenueCat before public billing. This supersedes the September 6 free-beta and deferred-Premium statements in earlier execution plans. Development and staging use test purchase credentials; public release requires separate store products, platform keys, and approval.

The app accepts monthly, yearly, or lifetime packages in the configured offering; the final store product and price are a commercial choice for the store setup. RevenueCat is the source of truth for the local Premium entitlement.

| Capability | Free | Premium test entitlement |
| --- | --- | --- |
| Pasted-link watching, Today, Saved, Sessions, selective Google import, Weekly Picks | Yes | Yes |
| Sources followed per profile | Up to 5 | Up to 25 |
| Profiles per installation | 1 | Up to 3 |
| New Managed profiles and protected controls | No | Yes |

Existing local follows and profiles are not deleted or hidden when an entitlement expires. A free user who is over the free ceiling cannot add more sources or profiles. Managed playback restrictions already set on a local profile continue to apply after expiry; the owner can still view or tighten them.

Rork owns native builds, signing, store console wiring, and device tests. Codex owns capability rules, regression tests, and environment review. Deep Find is deferred as of September 27, 2026; the original larger plan's cloud sync, remote approvals, automatic unreviewed publication, and broad provider search also remain outside this agreed day-one set.

The current app supports named Sessions. Do not silently replace them with the older plan's one-current-Session model during Premium work.
