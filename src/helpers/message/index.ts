import { Bytes } from "bytecodec";
import { validateIdentifier } from "../validateIdentifier";
import { encode, decode } from "@msgpack/msgpack";

type ChallengeMessage = { code: 1; payload: { challenge: Base64URLString } };
type PatchPayload = {
  code: 2;
  payload: {
    patch: ArrayBuffer;
  };
};
type MergePayload = {
  code: 3;
  payload: {
    state: ArrayBuffer;
  };
};
type BackupPayload = {
  code: 4;
  payload: {
    identifier: Base64URLString;
    envelope: unknown;
  };
};

type ResourceMessageObject = ChallengeMessage | PatchPayload | MergePayload;
const IDENTIFIER_BYTES = 32;

export function packMessage(
  messageObject: ResourceChannelMessage
): ArrayBuffer {
  const validIdentifier = validateIdentifier(messageObject.identifier);
  const identifierBytes = Bytes.fromBase64UrlString(validIdentifier);
  if (identifierBytes.byteLength !== IDENTIFIER_BYTES) {
    throw new TypeError("identifier must decode to 32 bytes");
  }

  const envelopeBytes = encode(messageObject.envelope);
  const out = new Uint8Array(IDENTIFIER_BYTES + envelopeBytes.byteLength);
  out.set(identifierBytes, 0);
  out.set(envelopeBytes, IDENTIFIER_BYTES);
  return out.buffer;
}

export function unpackPatch(messageBuffer: ArrayBuffer): {
  identifier: Base64URLString;
  envelope: unknown;
} {
  if (message.byteLength < IDENTIFIER_BYTES)
    throw new TypeError("message too short");
  const view = new Uint8Array(message);

  const identifierBytes = view.subarray(0, IDENTIFIER_BYTES);
  const envelopeBytes = view.subarray(IDENTIFIER_BYTES);

  return {
    identifier: Bytes.toBase64UrlString(identifierBytes),
    envelope: decode(envelopeBytes) as unknown,
  };
}
