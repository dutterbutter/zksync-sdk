export type VerifyMessageResult =
  | { ok: true; includedInBlock: bigint }
  | { ok: false; reason: 'MESSAGE_NOT_INCLUDED' | 'WRONG_DESTINATION_CHAIN_ID' | 'UNKNOWN' };

export type VerifyAssetTransferResult = VerifyMessageResult;
