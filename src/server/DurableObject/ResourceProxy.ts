// src/DurableObject/ResourceProxy.ts

import { generateNonce } from "bytecodec";
import { DurableObject } from "cloudflare:workers";
import { HmacAgent } from "zeyra";
import { Bytes } from "bytecodec";
import { packMessage, unpackMessage } from "../../helpers/message";
export class ResourceProxy extends DurableObject<Env> {
  private identifier = "";
  private backup: ArrayBuffer | undefined = undefined;
  private secret: JsonWebKey | undefined = undefined;
  private readonly verifiedSockets = new WeakSet<WebSocket>();
  private readonly challenges = new WeakMap<WebSocket, Base64URLString>();

  async fetch(request: Request): Promise<Response> {
    if (!this.identifier) {
      const url = new URL(request.url);
      const identifier = url.pathname.split("/").pop() ?? "";
      this.identifier = identifier;
    }

    const existsPromise = this.env.PRIVATE_BUCKET.head(this.identifier);

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    this.ctx.acceptWebSocket(serverWebSocket);

    const resourceBackedup = Boolean(await existsPromise);
    if (resourceBackedup) {
      const secretJSON = await this.env.PRIVATE_BUCKET.get(
        `${this.identifier}:jwk`
      );
      if (typeof secretJSON !== "string") return;
      const secret = JSON.parse(secretJSON);
      this.secret = secret;

      this.backup = await this.env.PRIVATE_BUCKET.get(this.identifier);
      this.ctx.waitUntil(this.webSocketChallenge(serverWebSocket));
    }
    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  async webSocketMessage(sender: WebSocket, messageBuffer: ArrayBuffer) {
    const message = unpackMessage(messageBuffer);
    if (message.code === 5) {
      this.webSocketVerify(sender, message.payload.signature);
    }
    if (this.verifiedSockets.has(sender)) {
      for (const socket of this.ctx.getWebSockets()) {
        if (socket !== sender && this.verifiedSockets.has(socket)) {
          socket.send(message);
        }
      }
    }
  }

  async webSocketClose(socket: WebSocket) {}

  async webSocketError(socket: WebSocket, error: unknown) {}

  async webSocketChallenge(socket: WebSocket) {
    const challenge = generateNonce();
    this.challenges.set(socket, challenge);
    const message = packMessage({ code: 1, payload: { challenge } });
    socket.send(message);
  }

  async webSocketVerify(
    socket: WebSocket,
    signature: BufferSource
  ): Promise<void> {
    const challenge = this.challenges.get(socket);
    if (!challenge) return socket.close(1008, "verification failed");
    this.challenges.delete(socket);
    const verifier = new HmacAgent(this.secret);
    const challengeBytes = Bytes.toBufferSource(
      Bytes.fromBase64UrlString(challenge)
    );
    const verified = await verifier.verify(challengeBytes, signature);
    if (!verified) return socket.close(1008, "verification failed");
    this.verifiedSockets.add(socket);
    const downStream = packMessage({ code: 3, payload: this.backup });
    socket.send();
  }

  async resourceBackup(backup: ArrayBuffer) {}

  async resourceRegisterBackup() {}

  async resourceRegistrationConflict() {}
}
