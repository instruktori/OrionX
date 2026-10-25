# OrionX frontend design

The interface follows the supplied BTU passport: orange, charcoal, paper surfaces, bold sans-serif headings, and the original colorful stamps. The UI/UX Pro Max skill informs accessibility, forms, navigation, and responsive behavior. The Taste skill informs the overview composition and presentation of the document artwork.

Design variance is 6, motion intensity is 3, and visual density is 4. The visual foundation is custom print-inspired CSS, rather than an imitation of an official design system. Existing Lucide icons are retained. The Manrope variable font is self-hosted as WOFF2 through `next/font/local`; its license is in `src/app/fonts/`.

## Reference coverage

All supplied reference images are represented in `public/images/btu/` as WebP assets. Page crops retain the supplied document design. The complete reference sheet is available from the passport preview.

| Supplied reference                                           | Frontend asset or use                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Passport.png`                                               | `passport-reference.webp`; Cover, About & stamps, Skill collection, and Skill details page previews                                                                             |
| `First Page Stamps/1_1@3x.png`                               | `latest-skillset.webp` in the cover artwork gallery                                                                                                                             |
| `First Page Stamps/2_1@3x.png`                               | `blockchain-verified.webp` in the cover artwork gallery                                                                                                                         |
| `First Page Stamps/3_1@3x.png`                               | `digital-passport.webp` in the cover artwork gallery                                                                                                                            |
| `First Page Stamps/4_1@3x.png`                               | `international-skills.webp` in the cover artwork gallery                                                                                                                        |
| `First Page Stamps/5_1@3x.png`                               | `issued-by-btu.webp` in the cover artwork gallery                                                                                                                               |
| `Skills Stamps/Artboard 3 (2).png`                           | `ai-skill.webp` in the skill collection, details, and stamp guide                                                                                                               |
| `Skills Stamps/Artboard 4 (1).png`                           | `ai-applied.webp` in the skill collection, details, and stamp guide                                                                                                             |
| `Skills Stamps/Artboard 5 (1).png`                           | `ai-advanced.webp` in the skill collection, details, and stamp guide                                                                                                            |
| `BTU_AI_Skills_Digital_Passport_Hackathon_Challenge_EN.docx` | Permanent passport identity, cumulative achievements, version history, private student access, and public document/issuer/version verification inform the information hierarchy |

The reference explains that the three stamp types are independent learning formats, not a required sequence. The stamp guide preserves this distinction. Reference artwork is explicitly labeled as artwork; issuer and blockchain stamps never serve as live status indicators.

## Design tokens and behavior

`src/app/globals.css` defines semantic colors, a consistent corner-radius scale, and navigation layering. Interactive controls use the orange accent; the original multicolor artwork is preserved. Dark mode follows the system preference. Reduced-motion preferences disable transforms and transitions.

The overview offers category filters, skill search, empty-state recovery, and achievement details. The passport page offers four page previews, native modal enlargement, the five original cover stamps, and the full reference sheet. Dialogs support Escape and restore focus. Mobile navigation traps focus, dismisses with Escape or navigation, and locks background scrolling. A skip link leads to the main content.

Verification preserves the existing public API contract. Client-side feedback covers malformed codes, non-PDF filenames, empty files, files exceeding 10 MB, pending requests, and unavailable services. Student and administrator access continues to use the existing authorization flow. No backend, database, deployment, or blockchain implementation was added or changed.

## Validation

- Production Next.js build and TypeScript checks.
- Browser interaction checks for filtering, search, empty states, dialogs, all four preview pages, the cover artwork gallery, mobile navigation, and verification feedback.
- Responsive checks at widths of 320, 375, 390, 768, 1024, and 1440 pixels.
- Light and dark visual review of the five main pages.
- Automated WCAG A/AA checks on the main pages in both themes; additional mobile checks with mocked student, administrator, and unbound-account responses.
- Authorized-state and verification browser checks use test responses. They do not establish live authentication, issuance, or blockchain proof.

The local production Lighthouse mobile run scored 98 for performance and 100 for accessibility, with LCP at 2.3 seconds, zero layout shift, and zero blocking time. These are local lab measurements, not field performance data.
