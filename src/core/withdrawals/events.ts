import { L2_ASSET_ROUTER_ADDR, TOPIC_L1_MESSAGE_SENT } from "../constants";
import type { ParsedLog, ParsedReceipt } from "./types";

export function findL1MessageSentLog(
  receipt: ParsedReceipt,
  opts?: { preferAddr?: string; index?: number }
): ParsedLog {
  const index = opts?.index ?? 0;
  const prefer = (opts?.preferAddr ?? L2_ASSET_ROUTER_ADDR).toLowerCase();

  const matches = receipt.logs.filter(
    (lg) => (lg.topics?.[0] ?? "").toLowerCase() === TOPIC_L1_MESSAGE_SENT
  );
  if (!matches.length) {
    throw new Error("No L1MessageSent event found in L2 receipt logs.");
  }

  const preferred = matches.find((lg) => (lg.address ?? "").toLowerCase() === prefer);
  const chosen = preferred ?? matches[index];
  if (!chosen) {
    throw new Error("No suitable L1MessageSent event found.");
  }
  return chosen;
}
