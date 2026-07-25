export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/chain.*does not match|wrong.*chain|chain.*mismatch/i.test(msg))
    return "Wrong network — please switch your wallet to Sepolia testnet.";
  if (/user rejected|user denied|rejected the request/i.test(msg))
    return "Transaction cancelled.";
  if (/insufficient funds/i.test(msg))
    return "Insufficient funds in your wallet.";
  if (/nonce/i.test(msg))
    return "Transaction nonce error — try again.";
  return "Something went wrong. Please try again.";
}
