# Frame onboarding: value, activation, and conversion

Status: revised after the October 1, 2026 critique. Conversion performance is unmeasured. Native usability testing is still required. This document records the rationale and validation plan, not a claim of conversion lift.

## Intended outcome

A new viewer should understand why Frame is useful, make a meaningful choice, see that choice reflected in real content, and keep a first video. The Premium offer then connects to a library they have begun. The commercial conversion is currently a labelled simulation: real billing remains disabled.

## The argument each stage makes

| Stage | User question | Implemented answer and action |
| --- | --- | --- |
| Welcome | Why use Frame? | “Worth watching. At your pace.” Familiar creators, a daily selection capped by the real product limit, and sessions with a stopping point. “Build my Frame” starts customization. |
| Interests | Will this be relevant to me? | Optional grouped interests lead to provisional previews from the shared weekly publication, without locking the regular edition. No additional questionnaire or account is required. |
| Sources | How much work will setup take? | Show relevant source suggestions before manual link entry. One real hero video preview and supporting thumbnails, titles, runtimes, and interest labels help with the decision; review and follow remain separate, explicit actions. |
| Personal reveal | What did my choices create? | The real finite Today selection, with a prominent Save action. A successful save confirms that their library has begun. |
| Premium | Why would I keep using this? | Real followed-source and newly saved-video counts connect the offer to the user's progress. Benefits describe collecting, returning, planning, and discovering. |
| Continue | Where do I go next? | After a first save, continue into Saved to see the result. Otherwise open Today when sources exist, or Sources when setup was skipped. Settings replay returns to Settings. |

Open Saved is the primary action after a successful first save. Premium remains an optional inline invitation throughout the reveal. The offer never opens automatically over the user's work. On the plan screen, the selected sample plan and full billing period appear in the primary checkout label; there is no competing primary app-entry action. A visible secondary action continues into Frame. After simulated checkout, the main action leads to the saved result.

## Boundaries that make the pitch credible

- Display real source/video data and actual progress. Empty, offline, and unavailable states offer recovery rather than invented personalized results.
- Preserve global Skip, Back, and a non-purchase continuation. Customization is not lost by declining the demo offer.
- Keep sample USD prices and “Demo · no charge” visible. No free-trial claim, paid entitlement, store charge, invented discount, rating, testimonial, or urgency.
- Do not imply ad removal, downloaded video, cloud sync, guaranteed time saved, or improved wellbeing.
- No additional tracking SDK or remote event collection has been introduced. The existing privacy model remains unchanged.

## Validation plan

Run observed sessions with people unfamiliar with Frame before optimizing conversion. Start without explaining the product. Check whether they can describe its value, find a relevant source, save a real video, understand both sample plans, and leave the offer without losing their choices. Include a small phone, larger text, slow/offline data, and keyboard/screen-reader use.

Use the following measures in a consented study or a future explicitly designed analytics implementation. These events are a specification; they are **not instrumented** by this change.

| Measure | Definition | Decision it informs |
| --- | --- | --- |
| Value comprehension | Participant explains sources, limited selection, and deliberate playback in their own words | Whether the promise is understood |
| Time to first value | Elapsed time from welcome to the first successfully displayed personalized selection | Whether setup and data loading create friction |
| Activation | First successful save / onboarding starts | Whether the reveal encourages a useful action |
| Offer reach | Premium views / activated viewers | Whether the invitation is visible and relevant |
| Demo checkout completion | Simulated completions / demo offer views | Comprehension and interaction only; **not willingness to pay** |
| Continuation | App entry / onboarding starts, split by skip and completed setup | Whether users reach something useful |
| Return use | A later visit that resumes, saves, or plays a session | Whether initial activation leads to durable value |

Once a real offer is separately authorized, measure actual purchase conversion, refunds, and retention. Do not infer commercial demand from free simulated checkout. Compare against a baseline with one deliberate variation at a time; report sample size and uncertainty. No uplift or target percentage has been invented.

## Sources and interpretation

- RevenueCat, [Start at the finish line: why you should design your activation journey backwards](https://www.revenuecat.com/blog/growth/hard-paywall-activation-journey), September 8, 2026. Supports defining the desired value experience and connecting the promise to activation and retention. Its cross-app paywall comparisons do not establish what will work for Frame.
- RevenueCat, [Personalised Paywalls](https://www.revenuecat.com/feature/paywalls/personalization), accessed September 29, 2026. Supports using existing context to make offers specific. This is vendor guidance, not independent causal evidence or a guaranteed result.

The first-save continuation and secondary offer placement are a Frame-specific design hypothesis based on the current product, demo constraints, and the user's request for a visible eureka moment before selling Premium.
