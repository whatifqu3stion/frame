# Everything that feeds you

Frame discovery should leave a viewer with knowledge, a skill, a worthwhile question, a richer perspective, or genuine creative inspiration. The default is substance over stimulation. A quiet shelf is a valid outcome.

The personal BYOK edition applies this policy in `domain/discoveryQuality.ts`, currently **nourishing-v2**. Change the rubric and thresholds there, and increment the version when admission changes. Both generated pools and profile editions use that version together with the personal-interest contract version, so legacy unreviewed suggestions cannot masquerade as reviewed picks. Existing followed sources and Saved links are untouched. Already-reviewed v1 editions remain valid for their current week; their page position and dismissals are preserved.

## Admission

1. On explicit request, Gemini proposes at most 24 real handles across up to 12 selected interests. Up to three chosen priority interests stay in focus; the remainder rotate weekly. Interest selection has no count cap and can include custom topics. Labels are untrusted data, never instructions. No general video search is added.
2. YouTube resolves each handle and inspects up to three pages of 12 recent uploads, stopping early after finding six eligible videos. Hydration verifies channel ownership. Short, unknown, missing/private, live and upcoming entries never qualify.
3. At least three distinct completed videos of four minutes or longer must be available. A channel that also publishes Shorts can qualify through its long-form work; a short-upload ratio no longer rejects it.
4. Gemini reviews bounded public metadata. Recommendation still requires high confidence, no unresolved concerns, and at least three cited eligible videos representing at least 60% of the eligible sample. Citations must identify real verified examples. Weak or uncertain reviews are omitted.
5. Stop after 12 accepted sources. Display up to three on each deliberate page; Previous revisits earlier pages. Concrete reasons and one verified long-form example accompany each pick. Fewer than 12, including zero, is valid. A successful edition remains stable for the week. An empty edition has one explicit recovery attempt after the 60-second cooldown; reserve it before provider calls so failed/cancelled recovery cannot become a refresh loop.

The rubric values explanations, useful demonstrations, careful inquiry, original craft, thoughtful analysis, cultural understanding and meaningful artistic experience. Music, film, humour, gaming, sports and leisure can qualify. Production budget, academic status, subscriber counts, views, trends and ideological agreement are not quality signals. AI use by itself is neither a quality signal nor a rejection reason.

It rejects empty spectacle, repetitive low-effort reactions/compilations, outrage or humiliation bait, gossip/drama, sensational promises, deceptive clickbait, unsupported health/financial claims, get-rich-quick schemes, disguised sales funnels and mass-produced filler. A sensational title alone is not a deterministic blacklist; context and evidence matter.

## Honest limits and controls

This is an AI-assisted editorial filter over titles/descriptions, **not a full-video or transcript review, truth check, or safety certification**. It may miss junk and may omit excellent sources with sparse metadata or mostly short uploads. Three solid examples are a conservative starting point, not a scientific quality score. Prompt-injection instructions embedded in source descriptions are explicitly treated as untrusted data; strict ID/duration/shape checks remain outside the model.

The policy applies to new agentic discovery suggestions. It does not certify every past or future upload of a recommended channel, and it does not silently unfollow manually chosen sources. The app-wide duration gate independently applies to playback, Today, search and sessions.

Only selected interests and bounded public channel/video metadata go to Gemini. Profile identity, viewing history, saved library and keys are never included in its content request. Each generation uses at most one proposal call plus 24 review calls; at most eight YouTube requests per unique candidate (resolve, uploads ID, up to three upload/detail page pairs). Candidate processing stops once 12 pass review. Reads remain local. Cancellation/backgrounding/key changes prevent publishing partial results. No automatic retry, refill, follow, playback, or engagement ranking is added.

## Refinement

Use concrete examples of good picks and misses to refine the shared rubric and admission tests. Distinguish factual failures (wrong channel, short duration, invented evidence) from subjective judgments (valuable to whom and why). Keep examples across creative, practical, educational and leisure interests so stricter screening does not collapse into a narrow lecture-only catalog. Existing dismissals stay local to the weekly edition; there is no hidden preference learning or history upload.

Automated coverage includes short-heavy sources, unknown duration, duplicate/foreign video IDs, unavailable evidence, uncertain/conflicted reviews, invented review citations, single empty-edition recovery, cancellation during review and policy-version invalidation. Live Gemini judgments and native BYOK flows still need device testing and real-world evaluation.
