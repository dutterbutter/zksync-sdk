import { Interface, type InterfaceAbi } from 'ethers';
import { InteropCenterAbi, InteropHandlerAbi } from '@zksync-sdk/core';

export const Center = new Interface(InteropCenterAbi as unknown as InterfaceAbi);
export const Handler = new Interface(InteropHandlerAbi as unknown as InterfaceAbi);
