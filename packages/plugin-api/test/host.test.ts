import { describe, expect, it, vi } from "vitest";
import { PluginHost, type Plugin } from "../src";

const p = (id: string, extra: Partial<Plugin<string>> = {}): Plugin<string> => ({
  manifest: { id, version: "1.0.0", name: id, engine: "^0.1.0", kind: "ui" },
  ...extra,
});

describe("PluginHost", () => {
  it("collects contributions from enabled plugins only, ordered", () => {
    const host = new PluginHost<string>();
    host.register(p("a", { contributes: { slots: [{ id: "x", slot: "s", order: 2, component: "X" }] } }));
    host.register(p("b", { contributes: { slots: [{ id: "y", slot: "s", order: 1, component: "Y" }] } }));
    host.register(p("c", { contributes: { slots: [{ id: "z", slot: "s", component: "Z" }] } }), false);
    expect(host.slots("s").map((s) => s.component)).toEqual(["Y", "X"]);
    host.enable("c");
    expect(host.slots("s")).toHaveLength(3);
    host.disable("a");
    expect(host.slots("s").map((s) => s.id)).toEqual(["y", "z"]);
  });
  it("enables dependencies and tears down setup on disable", () => {
    const host = new PluginHost<string>();
    const off = vi.fn();
    host.register(p("base", { setup: () => off }), false);
    host.register(p("ext", { manifest: { id: "ext", version: "1", name: "ext", engine: "*", kind: "ui", requires: ["base"] } }));
    expect(host.isEnabled("base")).toBe(true);
    host.disable("base");
    expect(off).toHaveBeenCalledOnce();
  });
  it("isolates failing event handlers", () => {
    const host = new PluginHost<string>();
    const ok = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    host.on("theme:changed", () => {
      throw new Error("boom");
    });
    host.on("theme:changed", ok);
    host.emit("theme:changed", { id: "x" });
    expect(ok).toHaveBeenCalled();
  });
});
