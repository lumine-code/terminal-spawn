const path = require("path");
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
  });

  describe("the terminal-spawn service", () => {
    it("exposes an open function", () => {
      const service = mainModule.provideTerminalSpawn();
      expect(typeof service.open).toBe("function");
    });

    it("spawns the terminal at the given directory", () => {
      const service = mainModule.provideTerminalSpawn();
      service.open(__dirname);

      const template = lumine.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", __dirname).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, __dirname);
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

  describe("terminal-spawn:list", () => {
    it("shows the preset list and applies the confirmed preset", async () => {
      lumine.commands.dispatch(workspaceElement, "terminal-spawn:list");

      const listElement = await waitFor(() => document.querySelector(".terminal-spawn-list"));
      await waitFor(() => listElement.querySelectorAll("li").length > 0);

      const queryEditor = listElement.querySelector("lumine-text-editor");
      lumine.commands.dispatch(queryEditor, "core:confirm");

      const preset = PRESETS.find((p) => p.platform === process.platform);
      expect(lumine.config.get("terminal-spawn.command")).toBe(preset.command);
      expect(lumine.config.get("terminal-spawn.commandWithArgs")).toBe(preset.commandWithArgs);
    });
  });
});
