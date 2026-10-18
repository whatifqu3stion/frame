import { SHORT_FORM_MAX_SECONDS } from "../constants/productConfig";

/** A length policy, not a guess at YouTube's format: all videos must exceed three minutes. */
export function isLongFormDuration(seconds: unknown): seconds is number {
  return typeof seconds === "number" && Number.isInteger(seconds) && seconds > SHORT_FORM_MAX_SECONDS;
}

export function videoLengthMessage(seconds: unknown): string {
  return typeof seconds === "number" && Number.isInteger(seconds) && seconds > 0
    ? "Frame is for longer videos. Videos of 3 minutes or less are excluded."
    : "Frame needs a confirmed video length over 3 minutes before this video can be opened.";
}
