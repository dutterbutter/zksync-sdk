/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeTransportFromEthers } from '../../core/rpc/transport';
import { createZksRpc } from '../../core/rpc/zks';

export const zksRpcFromEthers = (l2Provider: { send: (m: string, p: any[]) => Promise<any> }) =>
  createZksRpc(makeTransportFromEthers(l2Provider));
