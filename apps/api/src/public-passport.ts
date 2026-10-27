import {prisma} from "@orionx/db";
import {artifactStore, decodeCode, encodeCode, verifyDevnet} from "@orionx/core";
import {DomainError} from "@orionx/core/src/errors";

/** Public possession-of-code access to one finalized original, never a storage URL. */
export async function publicPassport(input: string) {
  let code: string;
  try { code = encodeCode(decodeCode(input)); }
  catch { throw new DomainError("INVALID_CODE", "Malformed verification code", 400); }

  const version = await prisma.version.findUnique({
    where: {code},
    select: {storageKey: true, finalizedSlot: true},
  });
  let bytes: Uint8Array | undefined;
  let originalError: string | undefined;
  let originalErrorCode: string | undefined;
  if (version?.finalizedSlot && version.storageKey) {
    try { bytes = await artifactStore().get(version.storageKey); }
    catch {
      originalError = "The original passport could not be retrieved. Please try again.";
      originalErrorCode = "ORIGINAL_UNAVAILABLE";
    }
  } else {
    originalError = "No finalized original passport is available for this code.";
    originalErrorCode = "ORIGINAL_NOT_FOUND";
  }

  // The live chain hash, rather than database metadata, is the source of truth.
  const proof = await verifyDevnet(code, bytes);
  const available = !!bytes && proof.registration === "REGISTERED" && proof.integrity === "MATCH";
  const documentPath = `/api/v1/verify/${encodeURIComponent(code)}/document`;
  return {
    bytes: available ? bytes : undefined,
    result: {
      ...proof,
      verifiedCode: code,
      documentSource: "stored-original" as const,
      message: available ? "Original passport retrieved. Its exact bytes match the finalized Solana Devnet record."
        : originalError && proof.registration === "REGISTERED" ? `Blockchain registration found. ${originalError}` : proof.message,
      original: {
        available,
        errorCode: available ? undefined : originalErrorCode,
        ...(available ? {viewUrl: documentPath, downloadUrl: `${documentPath}?download=1`} : {
          error: originalError || (proof.integrity === "MISMATCH"
            ? "The stored passport does not match its blockchain fingerprint and cannot be displayed."
            : "The original cannot be displayed until blockchain verification succeeds."),
        }),
      },
    },
  };
}
