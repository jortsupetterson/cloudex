import type { ResourceIdentifier } from "../../helpers/validateIdentifier";
import {
  packMessage,
  unpackPatch,
  type ResourceChannelMessage,
} from "../../helpers/message";
import { validateIdentifier } from "../../helpers/validateIdentifier";
import { UUID } from "crypto";

type ResourceChannelChallenge = {
  challengeId: UUID;
  challengePayload: Base64URLString;
};

export type ResourceChannelMessageCodes =
  | 1 /** sign -> challenge */
  | 2 /** patch -> CRDT op */
  | 3; /** merge -> state */

export type ResourceProxyMessageCodes =
  | 4 /** verify -> signature */
  | 5 /** backup  -> state*/;

type ResourceChannelEventMap = {
  "connection-challenged": Set<ResourceChannelChallenge>;
  "connection-verified": Set<ResourceChannelMessage>;
  "broadcast-recieved": Set<ResourceChannelMessage>;
  "peer-state-recieved": Set<ResourceChannelMessage>;
};

export type ResourceChannelMessage = {
  type: ResourceChannelMessageType;
  identifier: Base64URLString;
  envelope: unknown;
};

export class ResourceChannel {
  private readonly url: `/api/v1/resource/${ResourceIdentifier}`;
  private broadcastChannel: BroadcastChannel | null = null;
  private webSocket: WebSocket | null = null;
  private isLeader: boolean = false;
  private eventListeners: {
    [key in keyof ResourceChannelEventMap]?: (
      data: ResourceChannelEventMap[key]
    ) => void;
  } = {};

  constructor(identifier: string) {
    const validatedIdentifier = validateIdentifier(identifier);

    this.url = `/api/v1/resource/${validatedIdentifier}`;

    const channelName = ResourceChannel.channelName(this.url);
    const lockName = ResourceChannel.lockName(this.url);

    this.broadcastChannel = new BroadcastChannel(channelName);

    this.broadcastChannel.onmessage = (
      event: MessageEvent<ResourceChannelMessage>
    ) => {
      const message = event.data;
      if (!message) return;

      const eventListeners = this.eventListeners["broadcast-recieved"];

      if (!this.isLeader) return;
      const webSocket = this.webSocket;
      if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;

      ResourceChannel.sendWebSocket(webSocket, message);
    };

    /** if navigator online, and on "online" event,  */
    void (async () => {
      while (true) {
        await navigator.locks.request(
          lockName,
          { ifAvailable: true },
          async (lockHandle) => {
            if (!lockHandle) return;

            this.#isLeader = true;
            const webSocket = new WebSocket(this.url);
            this.#ws = webSocket;

            webSocket.onopen = (socket: WebSocket, ev: Event) => {
              /**  */
            };

            webSocket.onmessage = (event: MessageEvent<unknown>) => {
              const deliver = async () => {
                const message = await ResourceChannel.#toMessage(event.data);
                if (!message) return;

                this.#onmessage(message);
                this.#bc.postMessage(message);
              };
              void deliver();
            };

            webSocket.onclose = () => {
              if (this.#ws === webSocket) this.#ws = null;
            };

            await new Promise<void>((resolve) => {
              webSocket.addEventListener("close", () => resolve(), {
                once: true,
              });
            });

            this.#isLeader = false;
            if (this.#ws === webSocket) this.#ws = null;
          }
        );

        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    })();
  }

  requestStateSync() {}

  broadcast(message: ResourceChannelMessage): void {
    this.#onmessage(message);
    this.#bc.postMessage(message);

    if (!this.#isLeader) return;
    const webSocket = this.#ws;
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;

    ResourceChannel.#sendWebSocket(webSocket, message);
  }

  backup(object) {}

  verify(signedChallenge) {}

  close(): void {
    try {
      this.broadcastChannel.close();
    } catch {}
    try {
      this.webSocket?.close(1000, "closed");
    } catch {}
    this.webSocket = null;
    this.isLeader = false;
  }

  private static channelName(webSocketUrl: ResourceChannel["url"]): string {
    return `origin-channel::${webSocketUrl}`;
  }

  private static lockName(webSocketUrl: ResourceChannel["url"]): string {
    return `origin-channel-lock::${webSocketUrl}`;
  }

  private static sendWebSocket(
    webSocket: WebSocket,
    message: ResourceChannelMessage
  ): void {
    if (
      !Object.hasOwn(message, "identifier") ||
      !Object.hasOwn(message, "envelope")
    )
      return;
    const buffer = packMessage(message);
    webSocket.send(buffer);
  }

  public addEventListener(
    type: keyof ResourceChannelEventMap,
    listener: (this: ResourceChannel, data: ResourceChannelMessage) => void
  ) {}

  public removeEventListener() {}
}

new HTMLElement().addEventListener();
