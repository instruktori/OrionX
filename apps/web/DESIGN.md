# OrionX frontend design

The interface uses the **Electric Ice & Aurora** palette: crisp **White & Cool Ice** surfaces (`#FFFFFF` / `#F8FAFC`), **Electric Blue** primary controls (`#2563EB`), **Cyan** blockchain/verification accents (`#06B6D4`), **Pink** skill/identity highlights (`#EC4899`), and **Reddish/Coral** (`#E11D48`) alert and stamp accents.

The layout uses a sticky glass **Top Navigation Bar** paired with a **12-Column Bento Grid** canvas. The Manrope variable font is self-hosted as WOFF2 through `next/font/local`; its license is in `src/app/fonts/`.

## Centralized Authentication & Role-Adaptive Navigation

OrionX provides a single unified **Sign in** experience (`/login` and topbar CTA):
- Users authenticate once with Google OAuth (PKCE).
- Server-side `resolveSession` determines whether the subject is bound as `admin` (including dual-role `admin` + `studentId` accounts), `UNIVERSITY_VERIFIED` `student`, or a `SELF_REGISTERED` private workspace.
- Navigation tabs adapt automatically to the verified role, and dual-role administrators receive a one-click **Admin ⇄ Passport** switcher in the top header.

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

## Administrator Console & Zero-Transcription Verification

- **Admin Operations Console (`/admin`)**: Four bento views covering searchable/paginated Passports & Version Dossier Inspector (with Admin PDF download and QR sharing), People/Accounts/Workspaces & Role Management, In-App Google Sheets Award Entry, and Durable Jobs/Conflicts/Audit inspection.
- **Public Verification (`/verify`)**: Supports automatic verification code discovery from uploaded PDFs (scanning embedded QR image streams and text streams), live camera QR scanning, uploaded screenshot QR decoding, and a 4-pillar proof scorecard that preserves full proof fields even on HTTP 422 tamper mismatches.
