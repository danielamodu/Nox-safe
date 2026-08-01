export const CHAIN_ID = 11155111;

// Used as fromBlock for StreamShielded getLogs queries.
// Updated when NoxRecipientProxy was redeployed on 2026-08-01 (Sepolia block ~11,390,000).
export const PROXY_DEPLOYMENT_BLOCK = 11_390_000n;

export const ADDRESSES = {
  NoxGuardModule: "0xa517298b74c058c7AC8c7614C3c84CC5f1b2a311" as `0x${string}`,
  PolicyRegistry: "0xf3812133f47cDEa7cfc11E75e0DeAdE149fD7650" as `0x${string}`,
  NoxRecipientProxy: "0xc8E18A3F8386D00A7095A49eABa0F1265f7dc3F0" as `0x${string}`,
  SablierV2SepoliaLinear: "0x7a43F8a888fa15e68C103E18b0439Eb1e98E4301" as `0x${string}`,
} as const;

export const MODULE_ABI = [
  {
    type: "function",
    name: "submitIntent",
    inputs: [
      { name: "safe", type: "address" },
      { name: "targetHandle", type: "bytes32" },
      { name: "targetProof", type: "bytes" },
      { name: "valueHandle", type: "bytes32" },
      { name: "valueProof", type: "bytes" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "intentId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fulfillIntent",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "targetProof", type: "bytes" },
      { name: "valueProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getIntent",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "safe", type: "address" },
          { name: "status", type: "uint8" },
          { name: "submittedAt", type: "uint256" },
          { name: "targetHandle", type: "bytes32" },
          { name: "valueHandle", type: "bytes32" },
          { name: "dataHash", type: "bytes32" },
          { name: "submitter", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancelIntent",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getIntentStatus",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "noxOracle",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "dailySpend",
    inputs: [
      { name: "safe", type: "address" },
      { name: "utcDay", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "IntentSubmitted",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "safe", type: "address", indexed: true },
      { name: "targetHandle", type: "bytes32", indexed: false },
      { name: "valueHandle", type: "bytes32", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentExecuted",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "safe", type: "address", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentRejected",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "IntentCancelled",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
    ],
  },
] as const;

export const PROXY_ABI = [
  {
    type: "function",
    name: "registerShieldedStream",
    inputs: [
      { name: "sablier", type: "address" },
      { name: "streamId", type: "uint256" },
      { name: "recipientHandle", type: "bytes32" },
      { name: "recipientProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestShieldedWithdraw",
    inputs: [
      { name: "sablier", type: "address" },
      { name: "streamId", type: "uint256" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getShieldedStream",
    inputs: [
      { name: "sablier", type: "address" },
      { name: "streamId", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sablier", type: "address" },
          { name: "streamId", type: "uint256" },
          { name: "recipientHandle", type: "bytes32" },
          { name: "sender", type: "address" },
          { name: "active", type: "bool" },
          { name: "pendingRequest", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getWithdrawRequest",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sablier", type: "address" },
          { name: "streamId", type: "uint256" },
          { name: "recipientHandle", type: "bytes32" },
          { name: "status", type: "uint8" },
          { name: "submittedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "StreamShielded",
    inputs: [
      { name: "sablier", type: "address", indexed: true },
      { name: "streamId", type: "uint256", indexed: true },
      { name: "recipientHandle", type: "bytes32", indexed: true },
      { name: "sender", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ShieldedWithdrawRequested",
    inputs: [
      { name: "requestId", type: "bytes32", indexed: true },
      { name: "sablier", type: "address", indexed: true },
      { name: "streamId", type: "uint256", indexed: true },
      { name: "recipientHandle", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ShieldedWithdrawExecuted",
    inputs: [
      { name: "requestId", type: "bytes32", indexed: true },
      { name: "sablier", type: "address", indexed: true },
      { name: "streamId", type: "uint256", indexed: false },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
    ],
  },
] as const;

export const SAFE_ABI = [
  {
    type: "function",
    name: "isModuleEnabled",
    inputs: [{ name: "module", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getThreshold",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOwners",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
] as const;

export const REGISTRY_ABI = [
  {
    type: "function",
    name: "setPolicy",
    inputs: [
      {
        name: "policy",
        type: "tuple",
        components: [
          { name: "whitelistedTargets", type: "address[]" },
          { name: "maxValuePerTx", type: "uint256" },
          { name: "maxValuePerDay", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPolicy",
    inputs: [{ name: "safe", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "whitelistedTargets", type: "address[]" },
          { name: "maxValuePerTx", type: "uint256" },
          { name: "maxValuePerDay", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isTargetWhitelisted",
    inputs: [
      { name: "safe", type: "address" },
      { name: "target", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "PolicyUpdated",
    inputs: [{ name: "safe", type: "address", indexed: true }],
  },
] as const;

// Sablier V2.2 LockupLinear — 0x7a43F8a888fa15e68C103E18b0439Eb1e98E4301 on Sepolia
export const SABLIER_ABI = [
  {
    type: "function",
    name: "getStream",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{
      name: "stream",
      type: "tuple",
      components: [
        { name: "sender", type: "address" },
        { name: "startTime", type: "uint40" },
        { name: "cliffTime", type: "uint40" },
        { name: "isCancelable", type: "bool" },
        { name: "wasCanceled", type: "bool" },
        { name: "asset", type: "address" },
        { name: "endTime", type: "uint40" },
        { name: "isDepleted", type: "bool" },
        { name: "isStream", type: "bool" },
        { name: "isTransferable", type: "bool" },
        { name: "amounts", type: "tuple", components: [
          { name: "deposited", type: "uint128" },
          { name: "withdrawn", type: "uint128" },
          { name: "refunded", type: "uint128" },
        ]},
      ],
    }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextStreamId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawableAmountOf",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createWithDurations",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "totalAmount", type: "uint128" },
          { name: "asset", type: "address" },
          { name: "cancelable", type: "bool" },
          { name: "transferable", type: "bool" },
          {
            name: "durations",
            type: "tuple",
            components: [
              { name: "cliff", type: "uint40" },
              { name: "total", type: "uint40" },
            ],
          },
          {
            name: "broker",
            type: "tuple",
            components: [
              { name: "account", type: "address" },
              { name: "fee", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;
