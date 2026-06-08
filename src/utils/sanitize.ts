import DOMPurify from "dompurify";

/** Hard cap on a single user message (also enforced by the BFF). */
export const MAX_INPUT_LENGTH = 4000;

/**
 * Sanitize raw user input before it leaves the browser.
 *
 * Defense in depth: the UI renders message content as plain text (React escapes
 * it automatically and we never use dangerouslySetInnerHTML), but we still strip
 * any HTML/script payload here so nothing malicious is ever forwarded to the
 * agent or echoed back into the DOM.
 */
export function sanitizeUserInput(raw: string): string {
  if (typeof raw !== "string") {
    return "";
  }

  // 1. Remove every HTML tag and attribute, keeping only the text content.
  const withoutHtml = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // 2. Drop control characters (keep newlines and tabs) and normalize newlines.
  const cleaned = withoutHtml
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n");

  // 3. Enforce the maximum length.
  return cleaned.slice(0, MAX_INPUT_LENGTH);
}

/** True when, after sanitization, there is something worth sending. */
export function isSubmittable(value: string): boolean {
  return sanitizeUserInput(value).trim().length > 0;
}
