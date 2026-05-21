import { describe, expect, it } from "vitest";
import { router } from "@/routes/router";

describe("router smoke", () => {
  it("registers expected top-level routes", () => {
    const fullPaths = Object.values(router.routesById).map((route) => route.fullPath);

    expect(fullPaths).toContain("/");
    expect(fullPaths).toContain("/home");
    expect(fullPaths).toContain("/models");
    expect(fullPaths).toContain("/cleanup");
    expect(fullPaths).toContain("/settings");
  });
});
