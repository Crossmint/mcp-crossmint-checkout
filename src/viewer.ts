#!/usr/bin/env node

import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import {
  BasketStore,
  getBasketViewerUrl,
  resolveBasketStorePath,
  resolveBasketViewerPort,
  summarizeBasket,
} from "./basket/store.js";
import {
  BASKET_MODEL_FIELD_GUIDE,
  BasketContextInputSchema,
  CandidateStatusSchema,
  CartItemInputSchema,
} from "./basket/schema.js";
import { renderBasketViewerHtml } from "./basket/viewer-html.js";

function setBaseHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  setBaseHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendHtml(response: ServerResponse, html: string): void {
  setBaseHeaders(response);
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(html);
}

function sendError(response: ServerResponse, statusCode: number, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(response, statusCode, { error: message });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function itemIdFromPath(pathname: string, suffix = ""): string | null {
  const prefix = "/api/items/";
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }
  const withoutPrefix = pathname.slice(prefix.length);
  const id = suffix.length > 0 ? withoutPrefix.slice(0, -suffix.length) : withoutPrefix;
  return id.length > 0 ? decodeURIComponent(id) : null;
}

export async function startBasketViewer(options: {
  port?: number;
  store?: BasketStore;
} = {}): Promise<Server> {
  const port = options.port || resolveBasketViewerPort();
  const store = options.store || new BasketStore(resolveBasketStorePath());
  await store.load();

  const server = createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        setBaseHeaders(response);
        response.statusCode = 204;
        response.end();
        return;
      }

      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      const pathname = url.pathname;

      if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        sendHtml(response, renderBasketViewerHtml());
        return;
      }

      if (request.method === "GET" && pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          viewerUrl: getBasketViewerUrl(port),
          storePath: store.path(),
        });
        return;
      }

      if (request.method === "GET" && pathname === "/api/model") {
        sendJson(response, 200, {
          fields: BASKET_MODEL_FIELD_GUIDE,
        });
        return;
      }

      if (request.method === "GET" && pathname === "/api/basket") {
        sendJson(response, 200, summarizeBasket(await store.load()));
        return;
      }

      if (request.method === "GET" && pathname === "/api/basket/raw") {
        sendJson(response, 200, await store.load());
        return;
      }

      if (request.method === "POST" && pathname === "/api/context") {
        const body = BasketContextInputSchema.parse(await readJson(request));
        sendJson(response, 200, summarizeBasket(await store.setContext(body)));
        return;
      }

      if (request.method === "POST" && pathname === "/api/items") {
        const body = await readJson(request);
        const itemInput = CartItemInputSchema.parse(
          typeof body === "object" && body != null && "item" in body
            ? (body as { item: unknown }).item
            : body
        );
        const result = await store.upsertItem(itemInput);
        sendJson(response, result.created ? 201 : 200, {
          item: result.item,
          basket: summarizeBasket(result.basket),
        });
        return;
      }

      const statusItemId = itemIdFromPath(pathname, "/status");
      if (request.method === "POST" && statusItemId != null) {
        const body = await readJson(request);
        const status = CandidateStatusSchema.parse((body as { status?: unknown }).status);
        const item = await store.updateStatus(statusItemId, status);
        if (item == null) {
          sendJson(response, 404, { error: "Item not found" });
          return;
        }
        sendJson(response, 200, { item, basket: summarizeBasket(await store.load()) });
        return;
      }

      const deleteItemId = itemIdFromPath(pathname);
      if (request.method === "DELETE" && deleteItemId != null) {
        const removed = await store.removeItem(deleteItemId);
        sendJson(response, removed ? 200 : 404, {
          removed,
          basket: summarizeBasket(await store.load()),
        });
        return;
      }

      if (request.method === "POST" && pathname === "/api/clear") {
        const body = await readJson(request);
        if ((body as { confirm?: boolean }).confirm !== true) {
          sendJson(response, 400, { error: "confirm must be true" });
          return;
        }
        sendJson(response, 200, summarizeBasket(await store.clear()));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendError(response, 400, error);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = resolveBasketViewerPort();
  startBasketViewer({ port })
    .then(() => {
      console.error(`Crossmint agent basket viewer: ${getBasketViewerUrl(port)}`);
      console.error(`Basket store: ${resolveBasketStorePath()}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
