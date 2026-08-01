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
  if (/ProxyNotRecipient/i.test(msg))
    return "This stream's recipient is not NoxRecipientProxy. Create the stream with the proxy address as recipient first.";
  if (/NotStreamSender/i.test(msg))
    return "Only the original stream sender can register an encrypted recipient.";
  if (/AlreadyRegistered/i.test(msg))
    return "This stream is already registered with a shielded recipient.";
  if (/StreamNotRegistered/i.test(msg))
    return "This stream has no shielded recipient registered. Shield it first.";
  if (/NoWithdrawableAmount/i.test(msg))
    return "Nothing has vested yet — wait for the stream to accumulate balance.";
  if (/RequestNotPending/i.test(msg))
    return "This withdrawal request has already been processed.";
  // Fall back to the raw message so the user sees what actually failed
  const short = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
  return short || "Something went wrong. Please try again.";
}
