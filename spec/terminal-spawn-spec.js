const path = require("path");
const childProcess = require("child_process");
const { PRESETS } = require("../lib/presets");

// The spec runner freezes `setTimeout`, so poll on animation frames instead.
function waitFor(predicate, timeout = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      let value;
      try {
        value = predicate();
      } catch (error) {
        reject(error);
        return;
      }
      if (value) {
        resolve(value);
      } else if (Date.now() - start > timeout) {
        reject(new Error("Timed out waiting for condition"));
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

describe("terminal-spawn", () => {
  let workspaceElement, mainModule;

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    ({ mainModule } = await lumine.packages.activatePackage("terminal-spawn"));
    spyOn(mainModule, "spawnCommand");
  });

  it("registers its workspace commands", () => {
    const commands = lumine.commands
      .findCommands({ target: workspaceElement })
      .map((command) => command.name);
    expect(commands).toContain("terminal-spawn:root");
    expect(commands).toContain("terminal-spawn:open");
    expect(commands).toContain("terminal-spawn:list");
  });

  describe("terminal-spawn:root", () => {
    it("spawns the configured terminal at the project root", () => {
      lumine.project.setPaths([__dirname]);
      const root = lumine.project.getPaths()[0];
      lumine.commands.dispatch(workspaceElement, "terminal-spawn:root");

      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", root).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, root);
    });

    it("does nothing without a project root", () => {
      lumine.project.setPaths([]);
      lumine.commands.dispatch(workspaceElement, "terminal-spawn:root");
      expect(mainModule.spawnCommand).not.toHaveBeenCalled();
    });
  });

  describe("terminal-spawn:open", () => {
    it("spawns the terminal in the active file's directory", async () => {
      const editor = await lumine.workspace.open(__filename);
      const editorElement = lumine.views.getView(editor);
      lumine.commands.dispatch(editorElement, "terminal-spawn:open");

      const cwd = path.dirname(__filename);
      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", cwd).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, cwd);
    });

    it("spawns the terminal at the tree view's last selection", () => {
      const treeView = document.createElement("div");
      treeView.classList.add("tree-view");
      const entry = document.createElement("div");
      entry.classList.add("selected");
      entry.getPath = () => __filename;
      treeView.appendChild(entry);
      workspaceElement.appendChild(treeView);

      lumine.commands.dispatch(treeView, "terminal-spawn:open");

      const cwd = path.dirname(__filename);
      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", cwd).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, cwd);
    });

    it("falls back to the first project root without a file context", () => {
      lumine.project.setPaths([__dirname]);

      lumine.commands.dispatch(workspaceElement, "terminal-spawn:open");

      const root = lumine.project.getPaths()[0];
      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", root).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, root);
    });
  });

  describe("the context menu", () => {
    it("offers Spawn New inside the shared Terminal submenu", async () => {
      const editor = await lumine.workspace.open(__filename);
      const terminal = lumine.contextMenu
        .templateForElement(editor.getElement())
        .find((item) => item.label === "Terminal");

      expect(terminal.submenu).toContain(
        jasmine.objectContaining({
          label: "Spawn New",
          command: "terminal-spawn:open",
        }),
      );
    });
  });

  describe("the terminal-spawn service", () => {
    it("exposes an open function", () => {
      const service = mainModule.provideTerminalSpawn();
      expect(typeof service.open).toBe("function");
    });

    it("spawns the terminal at the given directory", () => {
      const service = mainModule.provideTerminalSpawn();
      const result = service.open(__dirname);

      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", __dirname).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, __dirname);
      expect(result).toBeUndefined();
    });

    it("uses the command template when a command is given", () => {
      const service = mainModule.provideTerminalSpawn();
      service.open(__dirname, "npm test");

      const template = lumine.config.get("terminal-spawn.commandWithArgs");
      const expected = template.replaceAll("{cwd}", __dirname).replaceAll("{command}", "npm test");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, __dirname);
    });

    it("resolves a file path to its parent directory", () => {
      const service = mainModule.provideTerminalSpawn();
      service.open(__filename);

      const cwd = path.dirname(__filename);
      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", cwd).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, cwd);
    });
  });

  describe("the MCP bridge environment", () => {
    const bridgeVariables = ["LUMINE_BRIDGE_HOST", "LUMINE_BRIDGE_PORT", "LUMINE_BRIDGE_TOKEN"];
    let previousEnvironment;

    beforeEach(() => {
      previousEnvironment = new Map(
        bridgeVariables.map((key) => [
          key,
          Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined,
        ]),
      );
      process.env.LUMINE_BRIDGE_HOST = "stale-host";
      process.env.LUMINE_BRIDGE_PORT = "3999";
      process.env.LUMINE_BRIDGE_TOKEN = "stale-token";
      mainModule.spawnCommand.and.callThrough();
      spyOn(childProcess, "exec").and.returnValue({ pid: 1234 });
    });

    afterEach(() => {
      for (const [key, value] of previousEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("waits for the current bridge port and passes only that bridge variable", async () => {
      let resolvePort;
      const getBridgePortWhenReady = jasmine
        .createSpy("getBridgePortWhenReady")
        .and.returnValue(new Promise((resolve) => (resolvePort = resolve)));
      mainModule.consumeMcpBridge({ getBridgePortWhenReady });

      const launch = mainModule.spawnCommand("terminal", __dirname);
      expect(childProcess.exec).not.toHaveBeenCalled();

      resolvePort(4321);
      await launch;

      const options = childProcess.exec.calls.mostRecent().args[1];
      expect(options.env.LUMINE_BRIDGE_PORT).toBe("4321");
      expect(options.env.LUMINE_BRIDGE_HOST).toBeUndefined();
      expect(options.env.LUMINE_BRIDGE_TOKEN).toBeUndefined();
    });

    it("asks the bridge for its current port before every launch", async () => {
      const getBridgePortWhenReady = jasmine
        .createSpy("getBridgePortWhenReady")
        .and.returnValues(Promise.resolve(4321), Promise.resolve(4322));
      mainModule.consumeMcpBridge({ getBridgePortWhenReady });

      await mainModule.spawnCommand("first", __dirname);
      await mainModule.spawnCommand("second", __dirname);

      expect(getBridgePortWhenReady).toHaveBeenCalledTimes(2);
      expect(childProcess.exec.calls.argsFor(0)[1].env.LUMINE_BRIDGE_PORT).toBe("4321");
      expect(childProcess.exec.calls.argsFor(1)[1].env.LUMINE_BRIDGE_PORT).toBe("4322");
    });

    it("opens normally without bridge variables when the bridge fails", async () => {
      mainModule.consumeMcpBridge({
        getBridgePortWhenReady: () => Promise.reject(new Error("bridge failed")),
      });

      await mainModule.spawnCommand("terminal", __dirname);

      const options = childProcess.exec.calls.mostRecent().args[1];
      expect(options.env.LUMINE_BRIDGE_HOST).toBeUndefined();
      expect(options.env.LUMINE_BRIDGE_PORT).toBeUndefined();
      expect(options.env.LUMINE_BRIDGE_TOKEN).toBeUndefined();
    });

    it("stops using the bridge after its service is disposed", async () => {
      const disposable = mainModule.consumeMcpBridge({
        getBridgePortWhenReady: () => Promise.resolve(4321),
      });
      disposable.dispose();

      await mainModule.spawnCommand("terminal", __dirname);

      const options = childProcess.exec.calls.mostRecent().args[1];
      expect(options.env.LUMINE_BRIDGE_PORT).toBeUndefined();
    });
  });

  describe("terminal-spawn:list", () => {
    it("shows the preset list and applies the confirmed preset", async () => {
      lumine.commands.dispatch(workspaceElement, "terminal-spawn:list");

      const listElement = await waitFor(() => document.querySelector(".terminal-spawn-list"));
      await waitFor(() => listElement.querySelectorAll("li").length > 0);

      const queryEditor = listElement.querySelector("lumine-text-editor");
      await lumine.commands.dispatch(queryEditor, "core:confirm");

      const preset = PRESETS.find((p) => p.platform === process.platform);
      expect(lumine.config.get("terminal-spawn.command")).toBe(preset.command);
      expect(lumine.config.get("terminal-spawn.commandWithArgs")).toBe(preset.commandWithArgs);
    });
  });

  it("makes every Windows Terminal preset inherit the launching environment", () => {
    const windowsTerminalPresets = PRESETS.filter(
      (preset) => preset.platform === "win32" && preset.name.startsWith("Windows Terminal"),
    );
    expect(windowsTerminalPresets.length).toBe(2);
    for (const preset of windowsTerminalPresets) {
      expect(preset.command).toContain("new-tab --inheritEnvironment");
      expect(preset.commandWithArgs).toContain("new-tab --inheritEnvironment");
    }
  });
});
