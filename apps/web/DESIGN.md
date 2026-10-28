# OrionX — Ink / Signal

OrionX uses a restrained neutral foundation, a blue interaction accent, and separate semantic colors for recorded progress, warnings, and errors. The self-hosted Manrope variable font is retained. There are no external font requests or new production dependencies.

## Foundations

`src/app/globals.css` owns paired light/dark tokens for backgrounds, surfaces, text, borders, actions, statuses, radius, spacing, and navigation. Light is the initial theme; the theme control persists the user's choice locally and the root bootstrap applies it before paint. Interactive controls share visible focus, hover, press, busy, and disabled states. Motion uses CSS, respects reduced motion, and does not delay interaction.

`components/ui.tsx` provides page headings, status badges, buttons, skeletons, error/empty states, and a native modal dialog. Existing tables, upload tools, QR sharing, and artwork dialogs use the same tokens. Native radio/checkbox inputs retain their keyboard behavior. Technical identifiers use monospace and numeric metrics use tabular figures.

## Information architecture

- `/`: public product explanation and illustrative passport anatomy. No fictional student records or simulated progress metrics.
- `/login`: existing Google PKCE sign-in, with a concise explanation of student and authorized staff access.
- `/dashboard`: private student overview sourced from passport APIs; explicit onboarding and empty states.
- `/passport`: actual identity, finalized skills, cumulative versions, private PDF downloads, QR/link sharing, and independent verification. Original BTU artwork is preserved in an optional, explicitly labeled reference section.
- `/verify`: existing PDF/QR/camera/code tools, with registration, document integrity, currency, and issuer authority kept distinct.
- `/admin`: existing student/account/source/issuance/audit operations, using the shared application shell and visual system.

The workspace uses a desktop sidebar and a mobile drawer with focus containment, Escape handling, and focus restoration. Forms and data tables stay within the viewport; wide operational tables scroll within their labeled region.

## Trust and data

A private workspace is not an issued credential. A chain registration is not university issuer attestation. Code lookup alone does not prove PDF integrity. Historical versions are distinguished from the latest finalized version.

The shared session provider avoids duplicate authentication requests. The OAuth callback refreshes that provider after the server sets HttpOnly cookies. Authorization, credential issuance, and file integrity checks remain server-owned.

The product scope is the university-issued AI Skills Digital Passport: source synchronization, cumulative skills and badges, private PDF downloads, version history, and independent verification. See `docs/MODULE_RETIREMENT.md` for database compatibility and removal validation.

## Luminous landing

The homepage uses navy, indigo, and cool-white tokens with paired light and dark themes. The earlier public navbar retains its pill controls. `PassportShowcase` presents an open skill field without a passport card. `SkillField` draws 150 deterministic points with perspective, curved connections, spring-based pointer repulsion, and smooth transitions among focused, applied, and academic patterns. A continuous 5.4-second breathing cycle runs without pointer input. World-space rotation around multiple axes, perspective projection, depth sorting, and distance-based opacity create continuous 3D motion. A circular field of violet connections sits over lavender, pink, and peach lighting. A feathered radial alpha mask fades the entire scene into the page in both themes. Dawn, Daylight, and Dusk controls change the palette. Canvas 2D keeps the renderer dependency-free; an SVG fallback supports unavailable canvas and initial rendering. Rendering pauses outside the viewport, in hidden tabs, and on user request. Reduced motion produces a static scene while preserving selection. Keyboard tabs support arrows, Home, and End. Original BTU artwork appears beside the selected format description. The preview remains explicitly illustrative. Account, issuance, and verification flows retain their behavior.
