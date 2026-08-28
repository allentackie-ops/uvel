# Brand Review Research Notes

## Official sources reviewed

### Stripe account verification
Source: https://support.stripe.com/questions/what-do-i-need-to-do-to-verify-my-stripe-account

Stripe states that requirements differ by country but generally include the individual creating the account, the associated business, and people who ultimately own or control that business. It may request government-issued photo ID, proof of address, legal-entity documents such as articles of association or a certificate of incorporation, business-address evidence, website ownership information, and beneficial-owner or director information.

### Stripe Connect identity verification
Source: https://docs.stripe.com/connect/identity-verification

Stripe Connect describes marketplace onboarding as collecting and verifying information about the person or company receiving funds. It may verify keyed-in data automatically or request government ID, proof of address, company information, and beneficial-owner information. Requirements depend on country, capability, business type, structure, service agreement, and risk. Stripe recommends hosted onboarding for the basic KYC flow, and states that a platform must still monitor and prevent fraud even after Stripe verification.

### Etsy identity verification
Source: https://help.etsy.com/hc/en-us/articles/22481159004567-How-to-Verify-Your-Identity-on-Etsy

Etsy says it partners with Persona to verify new sellers’ identities. Persona compares an ID photo to a selfie. Depending on location, Etsy may offer express review with biometric information or manual review without biometric information. Accepted identity documents vary by country.

### Etsy seller information and business verification
Source: https://help.etsy.com/hc/en-us/articles/360001980067-How-to-Verify-Your-Seller-Information-for-Etsy-Payments

Etsy distinguishes individuals or sole proprietors from incorporated businesses. A seller does not necessarily need to be a separate legal entity to sell. Incorporated businesses provide entity name, legal address, business identification number, registration jurisdiction, and ultimate beneficial-owner details, in addition to individual and financial information. Etsy may request government-issued business documentation when information cannot be verified.

### USPTO trademark search
Sources:
- https://www.uspto.gov/trademarks/search
- https://tmsearch.uspto.gov/
- https://tsdr.uspto.gov/

The USPTO provides official trademark search and status/document retrieval services. A search result should be treated as an evidence source for a potential conflict, not as a legal conclusion that a name is available or infringes.

### WIPO Global Brand Database
Sources:
- https://www.wipo.int/en/web/global-brand-database
- https://www.wipo.int/en/web/global-brand-database/faqs_branddb

WIPO provides a Global Brand Database covering Madrid System marks and national or regional collections. It is useful for international screening, but its coverage does not replace jurisdiction-specific legal analysis.

### EUIPO trademark availability
Sources:
- https://www.euipo.europa.eu/en/trade-marks/before-applying/availability
- https://dev.euipo.europa.eu/product

EUIPO directs users to official IP databases, including TMview and eSearch plus, for searching registered marks and applications. EUIPO also lists API products for searches and trademark information. This supports a future server-side, source-linked screening layer rather than client-side scraping.

## Architecture implications

1. Uvel should not call its current AI-only internal review legal business verification.
2. AI and automated matching can assist with triage, public-source retrieval, contradiction detection, and impersonation-risk scoring.
3. A final adverse decision should have reason codes, evidence, an appeal path, and human review.
4. Government IDs, selfies, addresses, tax identifiers, and ownership documents should not be sent through the Expo client to a general-purpose model. They require secure server-side handling and an appropriate verification provider.
5. A blue check should mean a defined Uvel review state, not government registration, trademark ownership, product quality, or payout eligibility.
6. Payout eligibility should be separated and delegated to a payment/KYC provider when payments are enabled.
7. Public-source trademark checks should return source URLs, jurisdiction, search date, match type, and confidence, and should explicitly say that they are screening signals rather than legal clearance.
8. Firebase custom claims are the appropriate basis for an internal admin role, enforced by backend code and security rules; a client-side email allowlist is not sufficient for production authorization.
