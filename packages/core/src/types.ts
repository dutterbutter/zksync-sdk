// TODO: refactor

// ---------------- Chains ----------------

export const Chains = {
  era: 'era',
  abstract: 'abstract',
} as const;

export type ChainKey = keyof typeof Chains | (string & {});
export type ChainRef = ChainKey | number;

export interface ChainInfo {
  key: ChainKey;
  name: string;
  chainId: number;
  rpcUrls: string[];
  explorer?: { baseUrl: string };
  addresses: {
    interopCenter: `0x${string}`;
    handler: `0x${string}`;
    bridgehub?: `0x${string}`;
    assetRouter?: `0x${string}`;
    nativeTokenVault?: `0x${string}`;
  };
  tokens?: Array<{ symbol: string; address: `0x${string}`; decimals: number; alias?: string[] }>;
  finalization?: { pollIntervalMs?: number; timeoutMs?: number };
  gas?: { minGasLimit?: bigint; gasBufferPct?: number };
  aliases?: string[];
  version?: string;
}

export interface ChainRegistryInit {
  builtins?: ChainInfo[];
  overrides?: ChainInfo[];
}

// ---------------- Attributes / Inputs ----------------

export type ERC7786Attribute = { selector: `0x${string}`; data: `0x${string}` };
// TODO: rethink
export interface MessageOptions {
  src?: ChainRef; // <— ChainRef (key or numeric)
  dest?: ChainRef; // <— ChainRef (key or numeric)
  attributes?: ERC7786Attribute[];
  gas?: Partial<{
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    gasBufferPct: number;
  }>;
  nonce?: bigint;
  note?: string;
  clientTag?: string;
  deadline?: number;
  signal?: AbortSignal; // cancellation
}

export interface RemoteCallInput extends MessageOptions {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
}

export interface NativeTransferInput extends MessageOptions {
  to: `0x${string}`;
  amount: bigint;
}

export interface ERC20TransferInput extends MessageOptions {
  token: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  approveIfNeeded?: boolean;
  indirect?: boolean;
  bridgeMsgValue?: bigint;
}

// ---------------- Bundles ----------------

export const ItemKind = {
  RemoteCall: 'remoteCall',
  NativeTransfer: 'nativeTransfer',
  ERC20Transfer: 'erc20Transfer',
} as const;

export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];

export type BundleItem =
  | { kind: typeof ItemKind.RemoteCall; to: `0x${string}`; data: `0x${string}`; value?: bigint }
  | { kind: typeof ItemKind.NativeTransfer; to: `0x${string}`; amount: bigint }
  | {
      kind: typeof ItemKind.ERC20Transfer;
      token: `0x${string}`;
      to: `0x${string}`;
      amount: bigint;
      approveIfNeeded?: boolean;
      _indirect?: true;
      _bridgeMsgValue?: bigint;
    };

export type BundleAtomicity = 'stopOnRevert' | 'continueOnError';

export interface BundleInput extends MessageOptions {
  items: BundleItem[];
  atomicity?: BundleAtomicity;
  maxItems?: number;
}

// ---------------- Estimation / Receipts ----------------
export type MessagePhase = 'sent' | 'proven' | 'finalizable' | 'finalized' | 'failed';

export interface MessageStatus {
  sendId: `0x${string}`;
  phase: MessagePhase;
  srcTxHash?: `0x${string}`;
  destTxHash?: `0x${string}`;
  lastUpdateTs: number;
}

export interface MessageReceipt extends MessageStatus {
  timeline: Array<{
    at: number;
    phase: MessagePhase;
    txHash?: `0x${string}`;
    blockNumber?: number;
    meta?: Record<string, unknown>;
  }>;
  raw?: { srcLogs?: unknown[]; destReceipt?: unknown };
}

export interface BundleReceipt extends MessageReceipt {
  perItem?: Array<{ index: number; success: boolean; gasUsed?: bigint; error?: string }>;
}

export interface SentMessage {
  sendId: `0x${string}`;
  srcTxHash: `0x${string}`;
}

export interface BuiltTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
}

// ---------------- Finalization ----------------

// TODO

// ---------------- Error Codes (centralized here) ----------------

export type InteropErrorCode =
  | 'CONFIG_MISSING'
  | 'CHAIN_UNSUPPORTED'
  | 'INVALID_CHAIN_KEY'
  | 'PROVIDER_UNAVAILABLE'
  | 'ENCODE_FAILED'
  | 'ESTIMATION_FAILED'
  | 'APPROVAL_REQUIRED'
  | 'PERMIT_INVALID'
  | 'PERMIT_EXPIRED'
  | 'SEND_FAILED'
  | 'TRACKING_FAILED'
  | 'FINALIZE_FAILED'
  | 'TIMEOUT'
  | 'RECEIPT_NOT_FOUND'
  | 'AMOUNT_TOO_LOW'
  | 'TOKEN_NOT_SUPPORTED'
  | 'BUNDLE_TOO_LARGE'
  | 'UNSUPPORTED_OPERATION'
  | 'FINALIZER_UNAVAILABLE'
  // on-chain custom errors mapped to SDK codes
  | 'ATTR_ALREADY_SET'
  | 'ATTR_VIOLATES_RESTRICTION'
  | 'BUNDLE_ALREADY_PROCESSED'
  | 'BUNDLE_ALREADY_VERIFIED'
  | 'CALL_ALREADY_EXECUTED'
  | 'CALL_NOT_EXECUTABLE'
  | 'CANNOT_UNBUNDLE'
  | 'EXECUTING_NOT_ALLOWED'
  | 'INDIRECT_CALL_VALUE_MISMATCH'
  | 'CHAIN_REFERENCE_NOT_EMPTY'
  | 'INTEROP_ADDRESS_NOT_EMPTY'
  | 'MESSAGE_NOT_INCLUDED'
  | 'UNAUTHORIZED_MESSAGE_SENDER'
  | 'UNBUNDLING_NOT_ALLOWED'
  | 'WRONG_CALL_STATUS_LENGTH'
  | 'WRONG_DESTINATION_CHAIN_ID'
  | 'EVM_ERROR'
  | 'EVM_PANIC';

// TODO: remove
export type JsonAbiParam = Readonly<{
  name?: string;
  type: string;
  internalType?: string;
  components?: readonly JsonAbiParam[];
  indexed?: boolean;
}>;

export type JsonAbiItem =
  | Readonly<{
      type: 'function';
      name: string;
      inputs?: readonly JsonAbiParam[];
      outputs?: readonly JsonAbiParam[];
      stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
    }>
  | Readonly<{
      type: 'event';
      name: string;
      inputs?: readonly JsonAbiParam[];
      anonymous?: boolean;
    }>
  | Readonly<{
      type: 'constructor';
      inputs?: readonly JsonAbiParam[];
      stateMutability?: 'nonpayable' | 'payable';
    }>
  | Readonly<{
      type: 'error';
      name: string;
      inputs?: readonly JsonAbiParam[];
    }>
  | Readonly<{ type: 'fallback' | 'receive' }>;

export type JsonAbi = readonly JsonAbiItem[];
