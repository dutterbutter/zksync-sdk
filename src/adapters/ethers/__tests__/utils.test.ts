import { describe, it, expect } from 'bun:test';
import { AbiCoder, ethers } from 'ethers';
import {
  encodeNativeTokenVaultAssetId,
  encodeNativeTokenVaultTransferData,
  encodeSecondBridgeDataV1,
  encodeNTVAssetId,
  encodeNTVTransferData,
  scaleGasLimit,
  checkBaseCost,
  getFeeOverrides,
  getGasPriceWei,
  buildDirectRequestStruct,
  encodeSecondBridgeErc20Args,
} from '../resources/utils';
import {
  L2_NATIVE_TOKEN_VAULT_ADDRESS,
  L1_FEE_ESTIMATION_COEF_DENOMINATOR,
  L1_FEE_ESTIMATION_COEF_NUMERATOR,
} from '../../../core/constants';

const coder = new AbiCoder();

const ADDR = {
  a1: '0x1111111111111111111111111111111111111111' as const,
  a2: '0x2222222222222222222222222222222222222222' as const,
  a3: '0x3333333333333333333333333333333333333333' as const,
};

describe('adapters/ethers/utils — NTV asset & transfer encoding', () => {
  it('encodeNativeTokenVaultAssetId matches keccak256(encode(uint256,address,address))', () => {
    const chainId = 324n;
    const assetAddr = ADDR.a1;

    const expectedHex = coder.encode(
      ['uint256', 'address', 'address'],
      [chainId, L2_NATIVE_TOKEN_VAULT_ADDRESS, assetAddr],
    );
    const expectedHash = ethers.keccak256(expectedHex);

    const out = encodeNativeTokenVaultAssetId(chainId, assetAddr);
    expect(out.toLowerCase()).toBe(expectedHash.toLowerCase());

    // alias function stays equivalent
    const outAlias = encodeNTVAssetId(chainId, assetAddr);
    expect(outAlias.toLowerCase()).toBe(expectedHash.toLowerCase());
  });

  it('encodeNativeTokenVaultTransferData encodes [amount, receiver, token] as expected', () => {
    const amt = 123n;
    const receiver = ADDR.a2;
    const token = ADDR.a3;

    const hex = encodeNativeTokenVaultTransferData(amt, receiver, token);
    const [decAmt, decReceiver, decToken] = coder.decode(['uint256', 'address', 'address'], hex);

    expect(BigInt(decAmt.toString())).toBe(amt);
    expect(String(decReceiver).toLowerCase()).toBe(receiver.toLowerCase());
    expect(String(decToken).toLowerCase()).toBe(token.toLowerCase());

    // alias function equivalent
    const hex2 = encodeNTVTransferData(amt, receiver, token);
    expect(hex2.toLowerCase()).toBe(hex.toLowerCase());
  });

  it('encodeSecondBridgeDataV1 prefixes 0x01 and ABI-encodes [bytes32, bytes]', () => {
    const assetId = ethers.keccak256('0x1234');
    const transferData = '0xdeadbeef';

    const out = encodeSecondBridgeDataV1(assetId, transferData);

    // first byte is version 0x01
    expect(out.startsWith('0x01')).toBe(true);

    // strip first byte and decode
    const payload = ('0x' + out.slice(4)) as `0x${string}`;
    const [decAssetId, decTransferData] = coder.decode(['bytes32', 'bytes'], payload);

    expect(String(decAssetId).toLowerCase()).toBe(assetId.toLowerCase());
    expect(String(decTransferData).toLowerCase()).toBe(transferData.toLowerCase());
  });
});

describe('adapters/ethers/utils — fee helpers', () => {
  it('scaleGasLimit uses the L1 fee estimation coefficient with truncation', () => {
    const gl = 1_000_001n;
    const expected =
      (gl * BigInt(L1_FEE_ESTIMATION_COEF_NUMERATOR)) / BigInt(L1_FEE_ESTIMATION_COEF_DENOMINATOR);

    expect(scaleGasLimit(gl)).toBe(expected);
  });

  it('checkBaseCost: resolves promised value and throws only when baseCost > value', async () => {
    await expect(checkBaseCost(100n, Promise.resolve(150n))).resolves.toBeUndefined();
    await expect(checkBaseCost(100n, 100n)).resolves.toBeUndefined();
    await expect(checkBaseCost(200n, Promise.resolve(150n))).rejects.toThrow(
      /base cost.*higher than the provided value/i,
    );
  });

  it('getFeeOverrides: 1559 (no gasPrice) returns maxFee+maxPriority and baseCost=maxFee', async () => {
    const client: any = {
      l1: {
        async getFeeData() {
          return { maxFeePerGas: 100n, maxPriorityFeePerGas: 2n, gasPrice: null };
        },
      },
    };
    const out = await getFeeOverrides(client);
    expect(out.maxFeePerGas).toBe(100n);
    expect(out.maxPriorityFeePerGas).toBe(2n);
    expect(out.gasPriceForBaseCost).toBe(100n);
    expect('gasPrice' in out).toBe(false);
  });

  it('getFeeOverrides: 1559 (with gasPrice) still returns 1559 fields; baseCost uses gasPrice', async () => {
    const client: any = {
      l1: {
        async getFeeData() {
          return { maxFeePerGas: 120n, maxPriorityFeePerGas: 3n, gasPrice: 90n };
        },
      },
    };
    const out = await getFeeOverrides(client);
    expect(out.maxFeePerGas).toBe(120n);
    expect(out.maxPriorityFeePerGas).toBe(3n);
    expect(out.gasPriceForBaseCost).toBe(90n); // prefers gasPrice when present
  });

  it('getFeeOverrides: legacy-only returns gasPrice and uses it for base cost', async () => {
    const client: any = {
      l1: {
        async getFeeData() {
          return { gasPrice: 55n, maxFeePerGas: null, maxPriorityFeePerGas: null };
        },
      },
    };
    const out = await getFeeOverrides(client);
    expect(out.gasPrice).toBe(55n);
    expect(out.gasPriceForBaseCost).toBe(55n);
    expect('maxFeePerGas' in out).toBe(false);
  });

  it('getFeeOverrides: throws when no price data provided', async () => {
    const client: any = {
      l1: {
        async getFeeData() {
          return { gasPrice: null, maxFeePerGas: null, maxPriorityFeePerGas: null };
        },
      },
    };
    await expect(getFeeOverrides(client)).rejects.toThrow(/no gas price data/i);
  });

  it('getGasPriceWei prefers gasPrice; falls back to maxFeePerGas; else throws', async () => {
    const c1: any = {
      l1: {
        async getFeeData() {
          return { gasPrice: 77n, maxFeePerGas: 100n };
        },
      },
    };
    expect(await getGasPriceWei(c1)).toBe(77n);

    const c2: any = {
      l1: {
        async getFeeData() {
          return { gasPrice: null, maxFeePerGas: 88n };
        },
      },
    };
    expect(await getGasPriceWei(c2)).toBe(88n);

    const c3: any = {
      l1: {
        async getFeeData() {
          return { gasPrice: null, maxFeePerGas: null };
        },
      },
    };
    await expect(getGasPriceWei(c3)).rejects.toThrow(/no gas price data/i);
  });
});

describe('adapters/ethers/utils — request builders', () => {
  it('buildDirectRequestStruct fills defaults and preserves inputs', () => {
    const args = {
      chainId: 324n,
      mintValue: 1000n,
      l2GasLimit: 500000n,
      gasPerPubdata: 800n,
      refundRecipient: ADDR.a1,
      l2Contract: ADDR.a2,
      l2Value: 123n,
    };
    const out = buildDirectRequestStruct(args);

    expect(out.chainId).toBe(args.chainId);
    expect(out.mintValue).toBe(args.mintValue);
    expect(out.l2Value).toBe(args.l2Value);
    expect(out.l2Contract.toLowerCase()).toBe(args.l2Contract.toLowerCase());
    expect(out.l2Calldata).toBe('0x');
    expect(out.l2GasLimit).toBe(args.l2GasLimit);
    expect(out.l2GasPerPubdataByteLimit).toBe(args.gasPerPubdata);
    expect(Array.isArray(out.factoryDeps)).toBe(true);
    expect(out.factoryDeps.length).toBe(0);
    expect(out.refundRecipient.toLowerCase()).toBe(args.refundRecipient.toLowerCase());
  });

  it('encodeSecondBridgeErc20Args ABI-encodes [address,uint256,address]', () => {
    const token = ADDR.a1;
    const amount = 999n;
    const receiver = ADDR.a3;

    const hex = encodeSecondBridgeErc20Args(token, amount, receiver);
    const [decToken, decAmount, decReceiver] = AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint256', 'address'],
      hex,
    );

    expect(String(decToken).toLowerCase()).toBe(token.toLowerCase());
    expect(BigInt(decAmount.toString())).toBe(amount);
    expect(String(decReceiver).toLowerCase()).toBe(receiver.toLowerCase());
  });
});
