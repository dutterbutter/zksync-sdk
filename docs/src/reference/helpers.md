# Common Helpers

Convenience APIs for **addresses, contracts, and token mapping**.
Available under `sdk.helpers` (`ethers` and `viem` adapter).

## Addresses

```ts
const addresses = await sdk.helpers.addresses();
console.log(addresses.bridgehub);
```

Resolves and caches core contract addresses (Bridgehub, routers, vaults, core contracts).
Call `client.refresh()` to clear the cache if networks/overrides change.

## Contracts

```ts
const contracts = await sdk.helpers.contracts();
console.log(await contracts.l1AssetRouter.paused());
```

Returns connected `ethers.Contract` instances (`viem` equivalents) for all core contracts.
You can also call individual shortcuts:

```ts
const router = await sdk.helpers.l1AssetRouter();
const vault = await sdk.helpers.l1NativeTokenVault();
const nullifier = await sdk.helpers.l1Nullifier();
```

## Base Token

```ts
const base = await sdk.helpers.baseToken();
const baseOther = await sdk.helpers.baseToken(BigInt(300));
```

Reads the **base token** for the current L2 network, or a specific chain id.

## Token Mapping

**L1 → L2**

```ts
import { ETH_ADDRESS } from '@zksync-sdk/core';

const l2Eth = await sdk.helpers.l2TokenAddress(ETH_ADDRESS);
const l2Usdc = await sdk.helpers.l2TokenAddress('0x...');
```

- ETH maps to the special ETH placeholder on L2.
- If the L1 token is the base token, you get the L2 base-token system address.

**L2 → L1**

```ts
const l1Token = await sdk.helpers.l1TokenAddress('0x...L2Token');
```

Maps an L2 token back to its L1 token.

## Asset ID

```ts
import { ETH_ADDRESS } from '@zksync-sdk/core';

const ethId = await sdk.helpers.assetId(ETH_ADDRESS);
const tokenId = await sdk.helpers.assetId('0x...');
```

Fetches the **assetId (bytes32)** for a token.
ETH is handled automatically.

## Behavior & Notes

- **Caching:** `addresses()` and `contracts()` results are cached; use `client.refresh()` to reset.
