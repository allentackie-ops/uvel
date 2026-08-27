# Uvel Founder Platform Roadmap

## Purpose

Uvel currently has a strong operating workspace for brands that already have a brand identity, products, staff, listings, orders, campaigns, finance, support, and analytics. That serves a later stage of the journey. It does not yet fully serve the person who has only an idea, a rough sketch, a reference image, or a desire to start a fashion label.

The proposed addition is a separate **Founder Studio**. Founder Studio should help someone move from an initial idea to a coherent first collection and a launch-ready brand foundation. It should not pretend that Uvel can register a company, certify a supplier, buy a domain, open a payment account, or create a live website on the founder’s behalf without the necessary external accounts and backend integrations. Instead, it should organize the work, provide useful creative tools, direct the founder to the right services, and show clearly what has and has not been completed.

> **Product distinction:** Founder Studio helps a person create and prepare a brand. Brand HQ helps an established or verified brand operate and grow it.

## Recommended product structure

A user should be able to enter Founder Studio from the existing “Start your brand” path without first passing through the full brand-verification workflow. They would create a private **brand project** rather than immediately creating a public verified brand page. When the project is mature enough, the user can convert or submit it into the existing brand application flow.

| Experience | Primary user | Main job | Public or private |
|---|---|---|---|
| Founder Studio | Person starting from an idea | Discover, define, design, source, and prepare | Private by default |
| Brand application | Founder ready to identify the legal/contact owner | Submit the brand for review | Private submission until approved |
| Public brand page | Approved brand | Present the brand and products to buyers | Public |
| Brand HQ | Owner and invited team | Operate catalog, orders, finance, marketing, support, and analytics | Team workspace |

This separation prevents two problems. A new founder is not forced to invent a registration history before they can begin building, and the marketplace is not filled with public “demo brands” that are not real businesses.

## Founder Studio modules

### 1. Founder home and journey map

The first screen should be a calm, actionable workspace showing the current project, its stage, unfinished tasks, saved designs, and the next recommended action. The stages should be **Idea**, **Identity**, **Design**, **Product plan**, **Source**, **Launch setup**, and **Ready to submit**. The screen should emphasize progress through completed work rather than unsupported scores or invented business readiness metrics.

The first version can use local persistence so a founder can close the app and resume. A project can remain private until the user explicitly chooses to submit it or publish selected material.

### 2. Brand idea brief

The idea brief turns an informal concept into a usable foundation. It should capture the customer, problem or desire, category, style direction, price intention, country or market, references, differentiator, and one-sentence brand statement. It should support revisions and preserve earlier versions instead of overwriting the founder’s thinking.

Optional AI assistance may help rewrite or organize a founder’s own notes, but the UI must label generated suggestions as suggestions. It must not present market demand, revenue potential, supplier quality, or legal availability as confirmed facts without verified data.

### 3. Canvas and sketch studio

This is the most important missing capability for the starting-from-scratch founder. The first version should be a practical, lightweight fashion canvas rather than an attempt to replace professional CAD software.

The canvas should support freehand drawing, basic shape tools, color swatches, image or photo references, text notes, layering, duplication, simple front/back boards, and named versions. A founder should be able to create a moodboard, sketch a garment, annotate construction ideas, make colorways, and export or share a board when working with a maker.

The design should make it clear whether an item is a rough concept, a sample request, or an approved production specification. Uvel should not imply that a sketch automatically becomes a manufacturing-ready technical pattern.

### 4. Product brief and tech-pack-lite

A founder should be able to turn a sketch into a structured product brief. Fields should include product name, garment category, intended fit, materials, trims, colorway, size range, measurements, construction notes, care notes, target unit cost, target retail price, sample quantity, and sample status.

The first release should focus on clarity and exportability. It can produce a clean PDF or shareable brief later, but the underlying data should remain structured so it can eventually connect to catalog creation in Brand HQ. Missing fields should be shown as incomplete rather than filled with assumptions.

### 5. Brand identity starter kit

This area should help a founder make early identity decisions: working name, handle ideas, tone, palette, typography direction, logo brief, photography direction, packaging notes, and a short brand story. Uvel can provide templates and guided prompts. It should not claim that a handle or trademark is legally available unless a real check is performed through an appropriate service.

The founder should be able to save a temporary working identity even if the final legal name is not decided. When they later enter the brand application, the completed fields should prefill the form for review.

### 6. Website and integration guide

The guide should be organized around outcomes rather than technical jargon. It should help the founder choose between using an existing storefront service, a hosted commerce platform, or a custom website. It should then provide a checklist for domain, business email, payments, shipping, tax settings, product catalog, social links, analytics, and customer support.

Each integration should have an honest state such as **Not started**, **Preparing**, **Connected**, **Needs attention**, or **Unavailable in this build**. Until secure server-side credentials and backend handlers are deployed, Uvel should use outbound links and setup instructions rather than pretending that a service is connected.

Potential integration categories include:

| Category | Founder outcome | Initial Uvel treatment |
|---|---|---|
| Domain and email | A recognizable web address and professional inbox | Guided checklist and outbound provider links |
| Storefront | A place where products can be sold | Provider comparison and setup checklist |
| Payments | Ability to accept money safely | Explain required account setup; connect only through secure backend |
| Shipping | Rates, labels, tracking, and returns | Country-aware checklist and provider links |
| Social profiles | Consistent public identity | Handle checklist and deep links |
| Analytics | Understand confirmed visits and purchases | Event checklist; show unavailable until real data arrives |
| Customer support | A reliable buyer contact path | Inbox/email/helpdesk setup checklist |

No provider key should be stored in the mobile client. Any eventual connection must be implemented server-side with explicit consent, token storage, webhook verification where supported, and truthful connection status.

### 7. Supplier and production preparation

Founder Studio should guide a founder through the questions that need answering before contacting a maker: garment type, expected quantity, target materials, size range, sample requirements, timeline, target cost, location, shipping needs, and quality expectations. It can provide a supplier brief and a comparison worksheet.

The first release should link the founder to supplier discovery options and help them track conversations, quotes, samples, and decisions. Uvel should not label a supplier as vetted, reliable, ethical, or affordable unless that status comes from a verifiable source or an explicit founder-entered record.

### 8. Launch planner

Once a founder has a coherent identity and product plan, the launch planner should turn the remaining work into a checklist: final product images, prices, stock, size information, shipping policy, returns policy, website, social content, launch date, campaign assets, and customer support route.

The planner should connect naturally to Brand HQ later. For example, a completed product brief can become a draft catalog item, while a launch checklist can become a campaign preparation task. This handoff should be explicit and reviewable rather than automatic and irreversible.

## Build sequence

### Phase 0: Access and foundation

Keep the existing brand application and verification rules intact for public brand creation. Add a private Founder Studio entry beneath the existing “Start your brand” path. Preserve the direct owner Brand HQ access that has just been restored for testing. The first technical foundation should be a local `FounderProject` model with AsyncStorage persistence and a clear conversion path into the existing application flow.

### Phase 1: Founder workspace shell

Build the project home, stage navigation, task cards, project settings, and resume behavior. Create, rename, archive, and reopen a private project. Add no public brand record yet. This phase establishes the product boundary between a founder project and a verified brand.

**Acceptance criteria:** a new user can create a project, close the app, reopen it, see the same project, and understand the next action without seeing fake analytics or an empty Brand HQ.

### Phase 2: Canvas and sketch studio

Build the first usable canvas with drawing, color, text, reference images, undo/redo, layers or ordered objects, version naming, and local save. Add a board export or share action only after the saved state is reliable.

**Acceptance criteria:** a founder can produce and reopen a moodboard or garment sketch, create at least two versions, and attach the chosen version to a product brief.

### Phase 3: Product brief and identity starter kit

Add structured product planning and identity guidance. Allow the founder to convert a chosen sketch into a product brief and to reuse the working name, story, palette, and category when opening the brand application.

**Acceptance criteria:** no required product field is silently invented; incomplete work is visibly marked; application fields can be prefilled from the project and reviewed before submission.

### Phase 4: Website, services, and integrations guide

Add the provider-neutral setup guide, service links, connection states, and country-aware task ordering. Start with outbound guidance and local completion tracking. Only add live integrations after the backend, credentials, consent, and failure handling are ready.

**Acceptance criteria:** a founder can see exactly what each service is for, what they need to create, what Uvel can currently verify, and what remains outside Uvel.

### Phase 5: Supplier and production workspace

Add supplier briefs, quote tracking, sample tracking, notes, attachments, and comparison views. Keep supplier claims founder-entered or source-backed. This phase should not require a marketplace of suppliers on day one.

### Phase 6: Launch handoff into Brand HQ

Add the conversion and handoff layer: selected identity fields, approved product briefs, assets, and launch tasks can become reviewable drafts in the brand system. Once the brand is approved and the founder is ready to operate, Brand HQ becomes the home for listings, orders, finance, marketing, support, and analytics.

### Phase 7: Backend and secure integrations

After Firebase billing/backend prerequisites are resolved, move private projects, assets, team collaboration, notifications, and integration tokens to secure server-side storage as appropriate. Add real payment, shipping, commerce, analytics, and webhook integrations only with provider documentation, verified credentials, audit logs, and clear unavailable states when a connection fails.

## Technical foundation

The first local data model should be deliberately small and extensible:

| Entity | Purpose | Initial persistence |
|---|---|---|
| `FounderProject` | Project identity, stage, country, working brand details | AsyncStorage |
| `FounderTask` | Ordered action, status, source, and notes | AsyncStorage |
| `CanvasBoard` | Board dimensions, objects, references, and version name | AsyncStorage plus local files |
| `ProductBrief` | Structured product concept linked to a board | AsyncStorage |
| `IdentityKit` | Working name, palette, tone, story, and logo brief | AsyncStorage |
| `IntegrationChecklistItem` | Provider-neutral setup state and outbound link | AsyncStorage |
| `SupplierLead` | Contact, quote, sample, status, and founder notes | AsyncStorage |
| `LaunchPlan` | Launch date, checklist, assets, and handoff status | AsyncStorage |

When cross-device access is needed, these models can move behind authenticated backend endpoints. Uploaded images and exports should use secure storage rather than embedding large files in a database record. Third-party secrets should never be placed in the Expo client.

## What to build first

The best first feature is **Founder Studio: project home plus Canvas/Sketch Studio v1**. It addresses the clearest gap in the current product, gives a starting founder an immediate reason to use Uvel, and creates the design assets and structured context that later modules can reuse. Building supplier directories, payment connections, or a website builder before this foundation would create a wide surface area without solving the founder’s first problem: turning an idea into something concrete.

The first implementation should therefore be limited to three deliverables: a private founder project, a reliable saved canvas, and a handoff from a selected canvas board into a product brief. After that is working and tested on device, the identity kit and integration guide should be added around the same project model.

## Definition of success

Founder Studio is successful when a person who has never operated a fashion brand can open Uvel, create a private project, capture their idea, sketch or assemble a reference board, describe the first product, understand the next practical step, and return later without losing work. It should then help them prepare a real brand application and eventually hand clean, reviewable information into Brand HQ.

The product should be judged by completed founder work and successful handoffs, not by invented market scores, unsupported supplier claims, or simulated revenue. That distinction keeps the starting experience useful while preserving the trust standards already being applied to verification, analytics, payments, and social data.
