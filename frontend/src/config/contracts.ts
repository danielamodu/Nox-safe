export const CHAIN_ID = 11155111;

export const ADDRESSES = {
  NoxGuardModule: "0x1Ba951E0883e5F4AFEdCdF88B76B8EeF34165a51" as `0x${string}`,
  PolicyRegistry: "0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1" as `0x${string}`,
  NoxRecipientProxy: "0x1D9f855d88e526745fDb8b04Fe3180a274604172" as `0x${string}`,
  MockSablierLockup: "0x518B1b36bcfA237c909380D56B6254052b350bb1" as `0x${string}`,
  SablierV2SepoliaLinear: "0x7a43F8a888fa15e68C103E18b0439Eb1e98E4301" as `0x${string}`,
  DemoStreamId: "3487",
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
        ],
      },
    ],
    stateMutability: "view",
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
