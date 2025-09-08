/* eslint-disable @typescript-eslint/no-explicit-any */
// todo: deal with any types

export type RpcTransport = (method: string, params?: unknown[]) => Promise<any>;

// Ethers: provider.send(method, params)
export function makeTransportFromEthers(provider: { send: (m: string, p: any[]) => Promise<any> }): RpcTransport {
  return (m, p = []) => provider.send(m, p);
}

// Viem: client.request({ method, params })
// export function makeTransportFromViem(client: { request: (args: { method: string; params?: any[] }) => Promise<any> }): RpcTransport {
//   return (m, p = []) => client.request({ method: m, params: p });
// }
