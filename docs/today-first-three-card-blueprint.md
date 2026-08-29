# Uvel Today: First Three Card Experiences

## Product thesis

Today should help a user move from **relevant fashion inspiration** to a useful action. The first three experiences should establish a clear sequence: discover a look, understand what can be bought or recreated, and then find people or sellers who make the style locally meaningful.

The existing catalog already has the right starting primitives: social source, title, summary, image, garment IDs, and a shop query. The redesign should preserve those primitives while adding explicit match confidence, availability, personalization reasons, and creator or brand identity.

## Recommended top-of-page sequence

| Order | Experience | Primary user question | Main action |
|---:|---|---|---|
| 1 | Hero Look | “Why am I seeing this?” | Explore the look |
| 2 | Shop the Look | “Can I recreate it?” | View exact and similar pieces |
| 3 | Local / Creator Discovery | “Who is making this relevant near me?” | Open profile or follow |

The three cards should not all look identical. The hero should be image-led, the Shop the Look card should be decision-led, and the Local / Creator card should be identity-led.

## Experience 1: Hero Look

### Purpose

The Hero Look is the first high-confidence piece of inspiration in the session. It should be selected from the user’s recent behavior, followed accounts, location context, and current catalog availability where possible. It can originate from TikTok, Instagram, Snapchat, X, or Uvel, but the source should be visible.

### Layout

The card should use a large portrait or tall image with a dark gradient at the bottom. The image should occupy most of the card. Metadata should remain readable without covering the central garment details.

The bottom overlay should contain the source label, a concise title, the creator or brand identity when available, and one primary lime action. Secondary actions should be icon-only with accessible labels.

### Content hierarchy

1. Source and trust labels.
2. Look title.
3. Creator or brand name with verification state.
4. One-sentence style interpretation.
5. `Explore the look` or `Shop the look` as the primary action.
6. Save and not-for-me controls.

### Interaction behavior

Tapping the image opens the look detail. Tapping the primary action opens the Shop the Look experience. Tapping the creator or brand opens its profile. Tapping Save stores the complete look. Tapping Not for me records a negative preference and immediately replaces the card with a small confirmation such as `We’ll show you less like this`.

### Personalization explanation

At most one short reason should appear, for example `Because you keep saving relaxed tailoring` or `New from a creator you follow`. If there is no reliable reason, omit the explanation rather than inventing one.

### Trust labels

The Hero Look should support these labels:

- `Uvel-reviewed brand` when the brand has passed Uvel’s authenticity review.
- `AI-assisted analysis` when the interpretation was generated or assisted by AI.
- `AI-generated content reported by source` only when the source metadata actually supports it.
- `Inspiration only` when no Uvel product match has been confirmed.
- `Sponsored` when placement is paid.

## Experience 2: Shop the Look

### Purpose

Shop the Look is Uvel’s most important differentiating interaction. It should convert a visual reference into useful, honest product choices without claiming that a similar item is the exact item from the post.

### Layout

The card should place the reference look at the top, followed by a compact horizontal or two-column piece breakdown. Each piece should have an image, name, price, country or shipping context, stock state, and match label.

The card should group pieces into three possible buckets:

| Bucket | Meaning |
|---|---|
| Exact item found | Uvel has a strong evidence-based match to the referenced item |
| Similar item | The product recreates the role, color, silhouette, or material but is not confirmed as the same item |
| Inspiration only | No reliable product match exists yet |

### Main actions

The primary action should be `View pieces`. Secondary actions should be `Save this look`, `See lower-cost options`, and `Use my closet`. The user should be able to open the full look and then choose one piece without being forced into a single checkout path.

### Product ranking

Products should rank by a combination of match quality, availability to the user’s country, size availability, price preference, shipping practicality, seller or brand trust, and stock freshness. A locally available similar item should often outrank a distant exact match that cannot be shipped.

### Honest product language

Do not use `This is what they’re wearing` unless the exact identity is verified. Prefer `Likely match`, `Similar silhouette`, `Same color family`, or `Inspired alternative` when appropriate.

### Fallback states

If no item is found, the card should say `No exact match found yet` and offer `Save the look` and `See similar styles`. If product inventory is unavailable, show `Marketplace availability is unavailable right now` rather than an empty broken card. If the user has no usable closet data, `Use my closet` should invite them to save or add their first piece instead of doing nothing.

## Experience 3: Local / Creator Discovery

### Purpose

The third experience gives Today cultural depth and marketplace identity. It should connect the user to a local creator, brand, or seller related to the style they just viewed. It must not imply local popularity without sufficient evidence.

### Layout

Use a shorter identity-led card after the Shop the Look experience. Show a creator or brand avatar, name, verification state, country or city when available, a representative image or product, and one sentence explaining the connection to the user’s current interest.

Examples include:

- `A Ghanaian label working with the relaxed tailoring you save.`
- `A creator near you styling wide-leg trousers three ways.`
- `New from a seller you may want to follow.`

### Main actions

Use one primary action: `Open profile` for creators or brands, or `View shop` for sellers. A secondary `Follow` control should be available but should not compete visually with the main action.

### Ranking rules

The card should prioritize followed accounts, then relevant local accounts, then emerging accounts with a strong style connection. Availability, recent activity, accurate inventory, and trust status should influence ranking. If there is no reliable local signal, use `Discovering from creators and sellers near you` rather than claiming that the item is trending locally.

### Trust labels

Show `Uvel-reviewed brand`, `Seller`, `Creator`, `Team member`, or `Unverified source` based on the actual account type. Never show a person’s name as the owner of a brand listing when the listing belongs to the brand.

## Shared controls

The three experiences should share a small action row with accessible labels:

| Control | Behavior |
|---|---|
| Save | Save the look, product, or profile depending on card context |
| Not for me | Reduce similar recommendations and record the reason if supplied |
| More | Report, hide source, mute creator, or view why it appeared |
| AI label | Explain what was AI-assisted and what remains uncertain |
| Source | Open the original source when permitted and available |

## Initial data contract additions

The current post model can be extended with optional fields instead of replacing the existing catalog:

```ts
type TodayMatch = {
  garmentId: string;
  match: "exact" | "similar" | "inspiration";
  confidence?: number;
  reason?: string;
};

type TodayPersonalization = {
  reason?: string;
  country?: string;
  city?: string;
  followed?: boolean;
};

type TodayTrust = {
  sourceType: "social" | "uvel" | "seller" | "brand" | "creator";
  aiAssisted?: boolean;
  aiGeneratedReported?: boolean;
  sponsored?: boolean;
  availabilityConfirmed?: boolean;
};
```

Confidence values should not be exposed as precise percentages unless the product team has validated what they mean. The UI should use qualitative labels such as `Strong match`, `Similar`, and `Inspiration only`.

## Empty, loading, and unavailable states

Today needs deliberate states from the first implementation:

| Situation | Display |
|---|---|
| Feed loading | Orbit loader with no fabricated content metrics |
| Not enough personalization | Ask the user to choose a few styles or categories |
| No exact match | `No exact match found yet` plus similar options |
| Social source unavailable | Preserve the card shell with a clear unavailable message |
| No local signal | `Discovering near you` without claiming local popularity |
| Analytics unavailable | Omit numbers or say `No activity data yet` |
| User hides a card | Replace it and confirm the preference briefly |

## Success criteria for the first build

The first implementation should be considered successful if a user can identify why a Hero Look appeared, open an honest Shop the Look breakdown, distinguish exact items from alternatives, reach a real Uvel product or creator profile, save or reject the recommendation, and see a different set of content on refresh without repeated recent posts.

The first three experiences should be implemented before adding more card types. Once these work, Uvel can add closet-aware styling, learning cards, global influence, and marketplace campaigns without making Today feel like an overloaded dashboard.
