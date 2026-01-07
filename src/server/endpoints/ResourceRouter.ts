// src/endpoints/ResourceRouter.ts
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class ResourceRouter extends OpenAPIRoute {
  schema = {
    tags: ["Realtime"],
    summary: "Upgrade to WebSocket for realtime session",
    request: {
      params: z.object({
        identifier: z.string().min(43).max(43),
      }),
      headers: z.object({
        upgrade: z.string(),
        connection: z.string(),
        "sec-websocket-key": z.string().min(1),
        "sec-websocket-version": z.literal("13"),
      }),
    },
    responses: {
      "101": { description: "WebSocket upgrade" },
      "400": {
        description: "Not a WebSocket handshake",
        content: {
          "application/json": {
            schema: z.object({
              ok: z.literal(false),
              error: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(context: AppContext) {
    const validated = await this.getValidatedData<typeof this.schema>();
    const identifier = validated.params.identifier;

    const upgrade = validated.headers.upgrade.toLowerCase();
    const connection = validated.headers.connection.toLowerCase();
    if (upgrade !== "websocket" || !connection.includes("upgrade")) {
      return context.json(
        {
          ok: false,
          error: "Expected a WebSocket handshake (Upgrade headers).",
        },
        400
      );
    }

    const durableObjectId = context.env.RESOURCE_PROXY.idFromName(identifier);
    return context.env.RESOURCE_PROXY.get(durableObjectId).fetch(
      identifier,
      context.req.raw
    );
  }
}
