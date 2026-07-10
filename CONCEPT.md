# Skylite — product concept & branding

**What Skylite is (one line):** a read-only, non-algorithmic window into
Bluesky/ATProto built for kids — "Skylite" = **Blue*sky* + *lite*." The pitch:
strip out posting, replying, and DMs and you remove the large majority of open-social
child-safety risk while still offering a curated window into global curiosity.

> **Provenance:** distilled from a Gemini design dialogue pasted on 2026-07-10 —
> raw at [`seeds/transcripts/raw/2026-07-10-gemini-skylite-concept-and-logos.md`](seeds/transcripts/raw/2026-07-10-gemini-skylite-concept-and-logos.md).
> This doc holds the **product/experience + branding** thinking; the
> **identity/ATProto/PWA-hardening** engineering lives in [`IDEAS.md`](IDEAS.md)
> (a separate same-day session). Nothing here is verified engineering — it is a
> captured concept. Claims sourced only from the model's framing are flagged
> _model-claim_ and should not be treated as measured.

---

## 1. Positioning

- **Read-only by construction.** No posting, no replying, no quote-posts, no DMs —
  purely passive consumption. The safety argument is that removing the interaction
  surface removes most of the abuse surface (harassment, grooming via DMs,
  algorithmic rabbit-holes). The "~95% of risk eliminated" figure is _model-claim_,
  not a measured number — treat it as directional framing, not data.
- **A lens, not a new network.** Skylite is a specialized *client* over the existing
  ATProto universe, not a from-scratch social network. This mirrors the
  `IDEAS.md` architecture (client-side merge of an inclusion list) rather than
  contradicting it — see the axis note in §2.
- **Not built to be addictive.** No follower counts, no engagement metrics, no
  "rage-bait" loops. Bright, high-contrast, large-text, highly visual "Lite" UI.

## 2. The reading experience — two framings on the same axis

The Gemini dialogue framed discovery as curated **"Sky-Channels"** (Science, Art,
Storytime) built from custom ATProto feeds curated by educators/creators (e.g.
#SpaceStuff, #CuteAnimals, #KidArt, #DIYCrafts). `IDEAS.md` §2 lands on a lighter,
serverless framing: an **inclusion list** merged client-side with `getAuthorFeed`,
newest-first, no server.

- These are **the same design axis at two power levels**, already named in `IDEAS.md`:
  a server-side custom feed generator (more power, a service to operate) vs. a
  client-side merge (lighter, nothing running). "Sky-Channels" = the curated,
  server-side end; the inclusion list = the serverless end. Not a contradiction —
  a cost/capability trade to decide, not re-litigate.
- **Shared ceiling either way:** the child only ever sees what a guardian included /
  which channels are on. That is the point and the limit.

## 3. Feature set (concept)

| Area | Concept |
|---|---|
| Interaction | **"Save to Scrapbook"** — private, local bookmarking in place of like/repost. Kid can clip a post and add private local notes ("want to draw this later"). |
| Discovery | Curated **Sky-Channels** (Science / Art / Storytime), toggled per-child. |
| Moderation | **"Sky-Shield"** — an automated layer *on top of* ATProto labels: image-recognition filtering + text filters that blur profanity/politics/sensitive-news even from an approved creator. |
| Co-viewing | Cast the feed to a TV/tablet — "scrolling" becomes a shared family activity, like reading a digital magazine together. |
| Guardian oversight | Dashboard to toggle channels on/off and view watch history. |

**Cross-check with `IDEAS.md`:** the Scrapbook, Sky-Channels, Sky-Shield,
co-viewing, and the toggle/watch-history dashboard are **new** here — `IDEAS.md`
does not cover them. Where they meet the technical doc: the dashboard's per-child
toggle is the product surface of the `IDEAS.md` **pause screen / kill switch**
(client flag), so those should be designed as one control, not two. The Scrapbook
is local-only, which fits the serverless stance in `IDEAS.md` §2.

> **Tension to hold (not resolve here):** "Sky-Shield" AI image/text filtering
> implies **running a service on incoming content** — directly in tension with the
> "no server, client-side, nothing running" spine of `IDEAS.md`. Any real
> image-recognition moderation likely reintroduces the confidential-backend
> question that `IDEAS.md` §5 already flags for session length. Flag, don't decide.

## 4. Branding & naming decision (see NAMING note in this doc's §6)

- **Name:** **Skylite** — a play on **Bluesky** integration + **lite**.
- **Winning visual (converged over ~4 logo rounds):** a **rectangular skylight set
  into a ceiling, viewed from below (lying/standing under it), looking up through the
  glass into a deep-indigo night sky** — crescent moon, stars, one soft cloud. The
  "Cosmic Window" cosmic elements carried through every round.
- **Tagline:** **"A Window to the Stars."**
- **Palette:** bright + dark blue, yellow, white — safe, friendly, kid-appealing.
- **Secondary theme explored:** day/night (sun-half / moon-half) — parked in favor of
  the night-sky skylight.
- **Perspective the user actually wanted (worth recording so it isn't re-derived):**
  looking *up* at a skylight on the ceiling, with a **short end of the rectangle
  nearest the viewer** (parallel to your feet / a board laid across your toes), the
  long sides receding to a vanishing point — a long, narrow rectangle stretching away
  overhead. The final dialogue turn was the user disambiguating this geometry, not a
  new concept.

## 5. Open product questions (carried forward)

1. **Target age band — unresolved, the model asked and it was not answered:**
   6–9 (heavy curation) vs. 10–12 (stepping-stone to real social). This shifts
   curation depth, UI, and the graduation timeline in `IDEAS.md` §1.
2. **The Boredom Factor.** Without the slot-machine of interaction, does a read-only
   app hold a kid, or get abandoned for YouTube? The core product risk.
3. **Monetization.** Model floated **~$2/month parental subscription, not ads**
   (ads on a kids' app is a non-starter; AI safety filtering costs money).
   _model-claim_ on cost; a real number needs the moderation architecture pinned
   (see §3 tension).
4. **Does "Sky-Shield" survive the serverless spine?** (§3) — the make-or-break
   collision between the moderation promise and the no-server identity/PWA design.

## 6. Naming decision (durable)

**Decided in-dialogue (2026-07-10):**
- Product name **Skylite** (Bluesky + lite).
- Identity/visual: **skylight → night sky**, tagline **"A Window to the Stars."**

These are branding decisions, not verified engineering. Recorded here so a later
session treats the name/visual/tagline as settled and doesn't re-explore the logo
space. The geometry the user wanted is in §4.
