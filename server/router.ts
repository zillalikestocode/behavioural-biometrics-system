/**
 * Minimal Router for Bun Request/Response with support for use/get/post
 */

import { ExtendedRequest } from "./types";

export type Handler = (req: ExtendedRequest) => Promise<Response> | Response;

type Route = {
  method: string; // GET, POST, etc or "USE" for mount
  path: string; // normalized absolute path
  handler: Handler;
};

export class Router {
  private routes: Route[] = [];

  /** Mount a subrouter or handler under a base path */
  use(basePath: string, routerOrHandler: Router | Handler) {
    const prefix = this.normalize(basePath);
    if (routerOrHandler instanceof Router) {
      for (const r of routerOrHandler.routes) {
        this.routes.push({
          method: r.method,
          path: this.combine(prefix, r.path),
          handler: r.handler,
        });
      }
    } else {
      // Register as catch-all for the prefix
      this.routes.push({
        method: "USE",
        path: prefix,
        handler: routerOrHandler,
      });
    }
    return this;
  }

  get(path: string, handler: Handler) {
    this.routes.push({ method: "GET", path: this.normalize(path), handler });
    return this;
  }

  post(path: string, handler: Handler) {
    this.routes.push({ method: "POST", path: this.normalize(path), handler });
    return this;
  }

  put(path: string, handler: Handler) {
    this.routes.push({ method: "PUT", path: this.normalize(path), handler });
    return this;
  }

  delete(path: string, handler: Handler) {
    this.routes.push({ method: "DELETE", path: this.normalize(path), handler });
    return this;
  }

  /**
   * Dispatch the request to a matching route.
   * Returns a Response or null if no route matched.
   */
  async handle(request: ExtendedRequest): Promise<Response | null> {
    const url = new URL(request.url);
    const pathname = this.normalize(url.pathname);
    const method = request.method.toUpperCase();

    // Prioritize exact method matches, then USE mounts
    for (const route of this.routes) {
      if (route.method === method && pathname === route.path) {
        return await route.handler(request);
      }
    }

    // Prefix matches for mounted routers or catch-alls
    for (const route of this.routes) {
      if (route.method === "USE" && this.isUnderPrefix(pathname, route.path)) {
        return await route.handler(request);
      }
    }

    return null;
  }

  private normalize(path: string) {
    if (!path) return "/";
    let p = path.trim();
    if (!p.startsWith("/")) p = "/" + p;
    // Remove trailing slash except root
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }

  private combine(prefix: string, path: string) {
    if (prefix === "/") return this.normalize(path);
    const joined = `${prefix}/${path.replace(/^\//, "")}`;
    return this.normalize(joined);
  }

  private isUnderPrefix(pathname: string, prefix: string) {
    if (prefix === "/") return true;
    return pathname === prefix || pathname.startsWith(prefix + "/");
  }
}
