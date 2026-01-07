import { Bytes } from "bytecodec";
import { encode, decode } from "@msgpack/msgpack";
import { validateIdentifier } from "../validateIdentifier";

type BytePayload = BufferSource;

type ChallengeMessage = { code: 1; payload: { challenge: Base64URLString } };
type PatchMessage = {
  code: 2;
  payload: { iv: Uint8Array; ciphertext: ArrayBuffer } | ArrayBuffer;
};
type MergeMessage = {
  code: 3;
  payload: { iv: Uint8Array; ciphertext: ArrayBuffer } | ArrayBuffer;
};
type BackupMessage = {
  code: 4;
  payload:
    | {
        identifier: Base64URLString;
        envelope: { iv: Uint8Array; ciphertext: ArrayBuffer };
      }
    | ArrayBuffer;
};
type SignatureMessage = { code: 5; payload: { signature: BytePayload } };

export type ResourceMessageObject =
  | ChallengeMessage
  | PatchMessage
  | MergeMessage
  | BackupMessage
  | SignatureMessage;

const CODE_BYTES = 1;

export function packMessage(
  messageObject: ResourceMessageObject
): ArrayBufferLike {
  const codeByte = Uint8Array.of(messageObject.code);

  switch (messageObject.code) {
    case 1: {
      const challengeBytes = Bytes.fromBase64UrlString(
        messageObject.payload.challenge
      );
      return Bytes.concat([codeByte, challengeBytes]).buffer;
    }

    case 2: {
      return Bytes.concat([codeByte, encode(messageObject.payload)]).buffer;
    }

    case 3: {
      return Bytes.concat([codeByte, encode(messageObject.payload)]).buffer;
    }

    case 4: {
      validateIdentifier(messageObject.payload.identifier);
      return Bytes.concat([codeByte, encode(messageObject.payload)]).buffer;
    }

    case 5: {
      return Bytes.concat([codeByte, encode(messageObject.payload)]).buffer;
    }
  }
}

export function unpackMessage(
  messageBuffer: ArrayBuffer
): ResourceMessageObject {
  const bytes = Bytes.toUint8Array(messageBuffer);
  if (bytes.byteLength < CODE_BYTES) throw new TypeError("message too short");

  const code = bytes[0];
  const payloadBytes = bytes.slice(CODE_BYTES);

  switch (code) {
    case 1:
      return {
        code: 1,
        payload: { challenge: Bytes.toBase64UrlString(payloadBytes) },
      };

    case 2:
      return {
        code: 2,
        payload: decode(payloadBytes) as PatchMessage["payload"],
      };

    case 3:
      return {
        code: 3,
        payload: decode(payloadBytes) as MergeMessage["payload"],
      };

    case 4: {
      const payload = decode(payloadBytes) as BackupMessage["payload"];
      validateIdentifier(payload.identifier);
      return { code: 4, payload };
    }

    case 5:
      return {
        code: 5,
        payload: decode(payloadBytes) as SignatureMessage["payload"],
      };

    default:
      throw new TypeError(`unknown message code: ${code}`);
  }
}
