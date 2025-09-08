import type { Hex } from '../types/primitives';

export type ParsedLog = {
  address: string;
  topics: Hex[];
  data: Hex;
};

export type ParsedReceipt = {
  logs: ParsedLog[];
};
