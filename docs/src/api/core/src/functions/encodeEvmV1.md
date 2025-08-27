[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / encodeEvmV1

# Function: encodeEvmV1()

> **encodeEvmV1**(`chainRef?`, `addr?`): `` `0x${string}` ``

Defined in: [packages/core/src/encoding/7930.ts:35](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/encoding/7930.ts#L35)

Encode an ERC-7930 EVM v1 interoperable address.

Layout: `[version(2) | chainType(2) | chainRefLen(1) | chainRef | addrLen(1) | addr]`

- `version` – currently `0x0001` (big-endian) to indicate EVM v1.
- `chainType` – reserved for future use; fixed `0x0000` for EVM.
- `chainRef` – big-endian, length ≤ 255 bytes (typically an EIP-155 chain id).
- `addr` – raw 20-byte EVM address; length ≤ 255 bytes (20 in practice).

## Parameters

### chainRef?

`bigint`

Optional chain reference (EIP-155 chain id). Omit for **address-only**.

### addr?

`` `0x${string}` ``

Optional EVM address (`0x…`). Omit for **chain-only**.

## Returns

`` `0x${string}` ``

Hex‐encoded interoperable address (`0x…`).

## Throws

If `chainRef` or `addr` exceed 255 bytes when serialized.

## Remarks

- **Chain-only** (destination in `sendBundle`): pass `chainRef`, leave `addr` undefined.
- **Address-only** (per-call `to` in bundle items): pass `addr`, leave `chainRef` undefined.
- Empty/omitted halves are **required** by the contracts for the intended context.

## Example

```ts
// Chain-only for destination (EIP-155)
const dst = encodeEvmV1(BigInt(324), undefined);

// Address-only for a call starter
const to = encodeEvmV1(undefined, '0xabc…def');
```
