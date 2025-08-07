/* -------------------------------------------------------------------------- */
/*  src/actions/index.ts                                                      */
/* -------------------------------------------------------------------------- */

import { sendBundle } from './sendBundle';
import { sendNative, sendERC20 } from './transfers';
import { remoteCall } from './remoteCall';

export { sendBundle, sendNative, sendERC20, remoteCall };

// export { estimateBundle }      from './estimateBundle';
// export { awaitFinalization }   from './awaitFinalization';
// export { getMessageStatus }    from './getMessageStatus';

export default {
  sendBundle,
  sendNative,
  sendERC20,
  remoteCall,
//   estimateBundle,
//   awaitFinalization,
//   getMessageStatus,
};
