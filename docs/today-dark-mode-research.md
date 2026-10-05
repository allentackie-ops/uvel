# Today dark mode research and palette

## Direction

Uvel’s current dark palette is warm and brown-black: `#000000` canvas, `#1C1A16` cards, ivory text, beige secondary text, and a very dark olive primary accent. The requested direction is closer to Instagram’s dark appearance: cooler, near-black, neutral charcoal surfaces, bright primary text, and restrained saturated accents.

This is an **Instagram-inspired neutral system**, not a copy of Instagram’s brand colors. Uvel keeps its own coral, lime, blue, sage, and lavender editorial accents.

## Evidence

Instagram’s official help center confirms that Dark Mode changes the screen to a darker color palette and follows the device appearance on iPhone and iPad. [1]

A current color reference for Instagram’s dark interface documents a near-black main background, dark gray surfaces, lighter elevated surfaces, white primary text, and gray secondary text. Those values are useful as a directional reference, but are not an official Meta design-token publication. [2]

Material Design recommends dark gray rather than black for surfaces that need visible elevation and recommends expressing higher elevation with lighter surface colors. It also recommends limiting large color fields and maintaining strong text contrast. [3]

Apple’s Dark Mode guidance recommends adaptive semantic colors, testing both appearances, and at least 4.5:1 contrast, with 7:1 preferred for custom small text. [4]

## Proposed Uvel dark tokens

| Token | Current | Proposed | Role |
|---|---:|---:|---|
| `ink` | `#000000` | `#0B0D12` | Cool near-black Today canvas |
| `surface` | `#1C1A16` | `#1B1E24` | Product cards, panels, rails |
| `bone` | `#F4F0E6` | `#F5F6FA` | Primary text and icons |
| `muted` | `#C4BBB1` | `#A7ACB8` | Secondary copy and metadata |
| `subtle` | `#8A8278` | `#737B88` | Hints and low-priority labels |
| `pulse` | `#2A320E` | `#C6D86A` | Uvel primary lime action/text accent |
| `pulseInk` | `#FFFFFF` | `#11130E` | Text on lime actions |
| `success` | `#D6E27A` | `#D6E27A` | Availability, save, and positive state |
| `successInk` | `#16140F` | `#11130E` | Text on success surfaces |
| `warning` | `#C5A85E` | `#E3B65B` | Warning state |
| `danger` | `#C45C5C` | `#F06A72` | Error and destructive state |
| `info` | `#2A2924` | `#20242D` | Informational surface |
| `neutral` | `#24221C` | `#252932` | Neutral elevated surface |

The key change is not “make everything black.” The canvas becomes a cool near-black, cards become neutral charcoal, and elevated components become visibly lighter. This should make Today’s product images and editorial color fields stand out more clearly while reducing the brown cast.

## References

[1]: https://help.instagram.com/897760233943762/ "Instagram Help Center: Turn on Dark mode for Instagram"
[2]: https://themeandcolor.com/blog/instagram-dark-mode-colors "Instagram Dark Mode Colors: #000000"
[3]: https://m2.material.io/design/color/dark-theme.html "Material Design: Dark theme"
[4]: https://developer.apple.com/design/human-interface-guidelines/dark-mode "Apple Human Interface Guidelines: Dark Mode"
