/**256-bit base64url (43 chars, no padding).*/

export type ResourceIdentifier = string & {
  readonly __brand: "ResourceIdentifier";
};
const BASE64URL_256_REGEX = /^[A-Za-z0-9_-]{43}$/;

export function validateIdentifier(identifier: string): ResourceIdentifier {
  if (!BASE64URL_256_REGEX.test(identifier)) {
    throw new TypeError(
      "{cloudex} identifier must be 256-bit base64url (43 chars, no padding)."
    );
  }
  return identifier as ResourceIdentifier;
}
