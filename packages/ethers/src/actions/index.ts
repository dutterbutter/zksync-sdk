/* -------------------------------------------------------------------------- */
/*  src/actions/index.ts                                                      */
/* -------------------------------------------------------------------------- */

import { sendBundle } from './sendBundle';
import { sendNative, sendERC20 } from './transfers';
import { remoteCall } from './remoteCall';

export { sendBundle, sendNative, sendERC20, remoteCall };

export default {
  sendBundle,
  sendNative,
  sendERC20,
  remoteCall,
};
