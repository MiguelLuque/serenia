/**
 * Explicit non-configurable HOLD. Neither environment variables nor a marker in
 * audit_log are evidence that the hosted migration/readback was completed.
 * Replace only after independently reviewing the real receipt and the procedure
 * for validating snapshots after the marker changes audit_log from zero to one.
 */
export async function verifiedHostedReadback(): Promise<boolean> {
  return false
}
