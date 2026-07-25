# Feedback on iExec Nox — from building Nox-Safe

This is honest, detailed feedback from building two real integrations
(Safe multisig + Sablier streaming) on Nox for the WTF!! hackathon. We hit
several real friction points along the way — documenting them here in case
they're useful, since a couple cost us significant time and would be easy
to fix on the docs/DX side.

## What we built

Nox-Safe adds a confidentiality layer to two existing, unmodified
protocols — Safe (multisig treasury) and Sablier (token streaming) —
rather than building a new standalone app. A Safe Module hides the
target/value of a treasury transaction until execution; a Sablier
recipient proxy hides who's actually receiving a stream. Both use real
Nox encryption (`Nox.fromExternal`) and a real oracle that decrypts via
the live Nox TEE gateway before executing.

## The biggest issue: a caller-side bug that looked exactly like a protocol limitation

We spent multiple days convinced that `uint16`/`uint256` encryption
wasn't supported on the Sepolia testnet. The actual bug: `validateInputProof`
requires a `teeType` parameter matching the handle's encoded type
(`bool = 0`, `uint16 = 5`, `uint256 = 35`), and we were passing `0` for
every call regardless of the actual handle type. The revert —
`InvalidProof: "Handle type mismatch"` — is technically accurate, but
gives no signal that the problem is a caller-supplied parameter versus a
protocol/testnet restriction. We built a full alternate architecture
(oracle-attested boolean verdicts) around the assumption that only `bool`
worked, before an iExec support engineer on Discord pointed us toward the
real fix in about ten minutes.

**Suggestion:** a more specific revert reason (e.g. naming the expected
vs. received type code) would have saved us from chasing a phantom
protocol limitation for days. This is probably the single highest-value
DX fix available.

## `validateInputProof` vs. `Nox.fromExternal()` — easy to reach for the wrong one

Related to the above: we were calling `validateInputProof` directly
instead of `Nox.fromExternal(externalEuintN, proof)`, which is the
documented contract-side entry point and (per support) handles the
type/ACL flow correctly. Nothing in the error output or the function
naming makes it obvious that `validateInputProof` is a lower-level
primitive you're not meant to call directly from application code.

**Suggestion:** either restrict `validateInputProof` to internal/library
visibility, or add a NatSpec warning pointing implementers to
`fromExternal()` instead.

## `encryptInput`'s supported type list is easy to over-trust

The SDK exposes a `NOX_SUPPORTED_TYPES` set that reads as "these types
work." We only discovered the practical restrictions (and a warning about
`encryptInput` not yet supporting the full `SolidityType` union) by
reading a `[!WARNING]` block in the npm README — not from inline
SDK errors or TSDoc on the function itself.

**Suggestion:** surface the same warning as a runtime warning (or a
TypeScript-level type restriction) directly on `encryptInput`, not just in
the README prose.

## Gateway response shape changed mid-build

Partway through development, the gateway's response moved
`decryptionProof` under a `payload` wrapper, breaking code that had been
working against the previous flat shape. No changelog or version bump
that we found flagged this.

**Suggestion:** version the gateway API response shape, or at minimum
changelog breaking response-format changes somewhere discoverable.

## What worked well

- The Nox Hardhat starter was a genuinely good scaffold to build from.
- iExec's Discord support was fast and precise — once we posted the exact
  error and revert trace, a human engineer diagnosed the real root cause
  (the `teeType` mismatch) within minutes, confirming what we'd only just
  independently discovered ourselves. That responsiveness mattered a lot
  given hackathon time pressure.
- Once the type-code issue was fixed, `Nox.fromExternal` +
  `allowPublicDecryption` + oracle `publicDecrypt` worked exactly as
  documented, cleanly, on the first real attempt.

## Net take

We shipped two real, working Nox integrations against real Sepolia
infrastructure — but a meaningful share of our build time went into
debugging a single mismatched constant that better error messaging or
clearer entry-point guidance would have caught immediately. If we had to
point at one improvement with the highest leverage for future hackathon
builders, it's making `validateInputProof`'s type-mismatch error
self-diagnosing.
