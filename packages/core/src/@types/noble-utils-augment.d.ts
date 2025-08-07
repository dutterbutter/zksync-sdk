// Widen noble utils to work smoothly with Uint8Array<ArrayBufferLike>
declare module '@noble/hashes/utils' {
  export function hexToBytes(hex: string): Uint8Array<ArrayBufferLike>;
  export function bytesToHex(bytes: Uint8Array<ArrayBufferLike>): string;
  export function concatBytes(
    ...arrays: Uint8Array<ArrayBufferLike>[]
  ): Uint8Array<ArrayBufferLike>;
}
