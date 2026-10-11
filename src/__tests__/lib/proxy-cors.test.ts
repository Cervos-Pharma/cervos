import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const ALLOWED = "http://tauri.localhost";

function optionsReq(path: string, origin: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization,content-type",
    },
  });
}

describe("Proxy CORS Handling", () => {
  it("returns 204 and reflects an allowlisted origin for OPTIONS on /api/marketplace/:path*", async () => {
    const res = await proxy(optionsReq("/api/marketplace/products", ALLOWED));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, PATCH, PUT, DELETE, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization");
  });

  it("returns 204 and reflects an allowlisted origin for OPTIONS on /api/subscription/:path*", async () => {
    const res = await proxy(optionsReq("/api/subscription/status", ALLOWED));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
  });

  it("attaches CORS headers to GET requests from an allowlisted origin", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketplace/products", {
      method: "GET",
      headers: { origin: ALLOWED },
    });

    const res = await proxy(req);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("does NOT grant CORS to a non-allowlisted origin (no wildcard leak)", async () => {
    const evil = "https://evil.example.com";
    const res = await proxy(optionsReq("/api/marketplace/products", evil));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();

    const get = await proxy(
      new NextRequest("http://localhost:3000/api/marketplace/products", {
        method: "GET",
        headers: { origin: evil },
      })
    );
    expect(get.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows the production web origin and localhost dev server", async () => {
    for (const origin of ["https://cervos.online", "http://localhost:1420"]) {
      const res = await proxy(optionsReq("/api/subscription/status", origin));
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });
});
