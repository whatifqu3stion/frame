# Temporary visual preview

Available only in development on web. Choose **Load sample library** in the top bar. The opt-in flag is held in this tab's session storage; fixture records live in the existing in-memory web database. Reloading restores the sample set. **Exit preview** removes the flag and reloads the empty web library. Native SQLite and API keys are untouched.

The library contains 10 fictional channels, 30 illustrative videos, a finite 12-video Today selection, eight saves, one resume, and one timed session. Unsplash photography illustrates subjects; it is not actual YouTube thumbnail metadata. Sample watch routes explain that the video is fictional instead of mounting YouTube. Preview channel browsing and Today refresh read local fixtures without provider calls. Existing preferences and real discovery settings are not replaced.

Release and native builds cannot activate this preview. Keep its small adapters in `database.ts`, `sourceFeedClientInstance.ts`, the channel/watch routes, and the root layout together if removing the preview feature later.

The Today viewing-time chart also shows seven explicitly labelled sample totals in this mode. These totals are generated in memory by `viewingHistory.ts`; they never overwrite a profile’s recorded playback history.

The sample watch screen includes **Preview ending** to review the production artwork-ending treatment. This is explicitly a design preview: it does not play media or record viewing time.
