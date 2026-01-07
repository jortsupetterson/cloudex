import { packMessage } from "../../helpers/message";
import { ResourceChannel } from "../ResourceChannel/class";
export class ResourceCluster {
  static #channels = new WeakMap<string, WeakRef<ResourceChannel>>();

  static #loadChannel(id: string): ResourceChannel {
    const weakRef = ResourceCluster.#channels.get(id);
    let channel = weakRef?.deref();
    if (!channel) {
      channel = new ResourceChannel(id);
      ResourceCluster.#channels.set(id, new WeakRef(channel));
    }
    return channel;
  }

  static async broadcast(id: string, message: object): Promise<boolean> {
    const channel = ResourceCluster.#loadChannel(id);
    channel.broadcast(packMessage(id, envelope));
  }
  static async close();
}
