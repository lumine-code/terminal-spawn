const childProcess = require("node:child_process");
const { Disposable } = require("lumine");

describe("terminal-spawn bridge provider ownership", () => {
  let main;
  const providers = [];
  const provide = (bridge) => {
    const provider = lumine.packages.serviceHub.provide("mcp.bridge", "1.1.0", bridge);
    providers.push(provider);
    return provider;
  };

  beforeEach(async () => {
    spyOn(childProcess, "exec").and.returnValue({});
    jasmine.useRealClock();
    main = (await lumine.packages.activatePackage("terminal-spawn")).mainModule;
  });

  afterEach(async () => {
    while (providers.length) providers.pop().dispose();
    await lumine.packages.deactivatePackage("terminal-spawn");
  });

  it("retains a shared bridge payload until its last actual provider edge is released", async () => {
    const bridge = { getBridgePortWhenReady: () => Promise.resolve(43123) };
    const first = provide(bridge);
    provide(bridge);
    first.dispose();
    await main.spawnCommand("test-command", "test-directory");
    expect(main.mcpBridge).toBe(bridge);
    expect(childProcess.exec.calls.mostRecent().args[1].env.LUMINE_BRIDGE_PORT).toBe("43123");
  });

  it("restores an older connected provider when a replacement disappears", async () => {
    const older = { getBridgePortWhenReady: () => Promise.resolve(43124) };
    const newer = { getBridgePortWhenReady: () => Promise.resolve(43125) };
    provide(older);
    const replacement = provide(newer);
    expect(main.mcpBridge).toBe(newer);
    replacement.dispose();
    await main.spawnCommand("test-command", "test-directory");
    expect(main.mcpBridge).toBe(older);
    expect(childProcess.exec.calls.mostRecent().args[1].env.LUMINE_BRIDGE_PORT).toBe("43124");
  });

  it("does not let an old manual lease clear a reconsumed current activation", async () => {
    const bridge = { getBridgePortWhenReady: () => Promise.resolve(43126) };
    const old = main.consumeMcpBridge(bridge);
    await lumine.packages.deactivatePackage("terminal-spawn");
    main = (await lumine.packages.activatePackage("terminal-spawn")).mainModule;
    const current = main.consumeMcpBridge(bridge);
    try {
      old.dispose();
      await main.spawnCommand("test-command", "test-directory");
      expect(main.mcpBridge).toBe(bridge);
      expect(childProcess.exec.calls.mostRecent().args[1].env.LUMINE_BRIDGE_PORT).toBe("43126");
    } finally {
      old.dispose();
      current.dispose();
    }
  });

  it("does not publish a bridge through a retained callback after retirement or a new activation", async () => {
    const retained = main.consumeMcpBridge.bind(main);
    const bridge = { getBridgePortWhenReady: () => Promise.resolve(43127) };
    await lumine.packages.deactivatePackage("terminal-spawn");
    const inactive = retained(bridge);
    expect(main.mcpBridge).toBeNull();
    main = (await lumine.packages.activatePackage("terminal-spawn")).mainModule;
    const currentBridge = main.mcpBridge;
    const stale = retained(bridge);
    expect(main.mcpBridge).toBe(currentBridge);
    inactive.dispose();
    stale.dispose();
  });

  it("retires manually acquired leases with their activation", async () => {
    const lease = main.consumeMcpBridge({ getBridgePortWhenReady: () => Promise.resolve(43128) });
    await lumine.packages.deactivatePackage("terminal-spawn");
    expect(lease.disposed).toBe(true);
  });

  it("preserves a replacement activation created by an owned cleanup callback", async () => {
    const bridge = { getBridgePortWhenReady: () => Promise.resolve(43129) };
    let replacements = 0;
    main.disposables.add(
      new Disposable(() => {
        main.activate();
        main.consumeMcpBridge(bridge);
        replacements++;
      }),
    );
    main.deactivate();
    expect(replacements).toBe(1);
    expect(main.mcpBridge).toBe(bridge);
    expect(main.disposables.disposed).toBe(false);
    await main.spawnCommand("test-command", "test-directory");
    expect(childProcess.exec.calls.mostRecent().args[1].env.LUMINE_BRIDGE_PORT).toBe("43129");
  });
});
