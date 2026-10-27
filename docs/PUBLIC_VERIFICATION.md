# Public original passport verification (MVP)

Anyone holding a finalized version’s QR/link/code can retrieve that version’s original PDF. No account or student sharing setting is required. Scanning a QR, selecting a QR image, or opening `/verify?code=…` automatically retrieves and verifies the original. The page offers PDF preview, open, and download actions only after its exact SHA-256 fingerprint matches the live finalized Solana Devnet record.

Originals remain in the existing private storage bucket. The API reads a single finalized version by its opaque verification code; it never exposes storage credentials, object keys, student email, or a public bucket listing. Both preview and download recheck the retrieved bytes against the live chain. Superseded codes return their historical original, with the existing version-currency and issuer-authority checks. A matching demo passport does not imply official BTU authorization.

## Endpoints

- `GET /api/v1/verify/:code/original`: original verification proof, source label, availability, and relative preview/download links. Registration can still be shown when the original cannot be retrieved; document integrity remains unchecked in that case.
- `GET /api/v1/verify/:code/document`: verified original PDF inline; add `?download=1` for an attachment. Missing/unfinalized originals are withheld, a hash mismatch returns 422, and a failed chain/storage check never serves PDF bytes.
- Existing `GET /api/v1/verify/:code` and `POST /api/v1/verify/file` retain their original behavior. The page exposes these through **Other verification methods**, with selectable method buttons, descriptions, and an explicit selected state, alongside manual retrieval by code. Manual code entry, ambiguous embedded-code selection, and PDF/code discrepancy handling remain available.
- Existing authenticated student/admin download endpoints retain their ownership and role checks.

## Scanner feedback

The camera shows a framing guide and processing indicator, a counter of frames actually analyzed, and a polygon around a decoded QR’s detected corners. A valid passport QR turns the tracker green, stops the camera tracks, and starts original retrieval. Prompts distinguish connecting, live processing, low light, unrelated QR content, prolonged searching, permission denial, missing hardware, stopped streams, and scanner errors. Pending camera requests can be cancelled; late streams are released. Reduced-motion preferences disable the animated sweep.

This flow verifies the original retrieved from storage. A separate PDF someone supplies is verified with the retained PDF comparison method.

## Validation

Run `npm run typecheck`, `npm run test -w @orionx/api`, `npm run test -w @orionx/web`, and `npm run build`. HTTP regression tests cover anonymous retrieval/download, missing/unfinalized originals, corruption, unavailable RPC/storage, historical versions, malformed/unknown codes, and unchanged legacy lookup. UI tests cover automatic QR links/images, method selection, legacy PDF upload, live processing/tracking prompts, camera denial/cancellation, and withholding failed document previews.
