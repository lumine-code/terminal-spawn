const path = require("path");
const { PRESETS } = require("../lib/presets");

// The editor checkout is not at a fixed relative path from this repository —
// siblings in CI, two levels apart in the workspace — so `spec/helpers/
// modal-helpers` cannot be required from here. This is the same settle it
// performs: drain the kernel's coalescing timers, then wait on the source run.
async function settleModal() {
  const session = atom.modals.getActiveSession();
  if (!session) return;
  if (typeof advanceClock === "function") advanceClock(0);
  await Promise.resolve();
  const run = session.frames.length > 0 ? session.frame.run : null;
  if (run) await run.whenSettled();
  if (typeof advanceClock === "function") advanceClock(0);
  await Promise.resolve();
}

describe("terminal-spawn", () => {
  let workspaceElement, mainModule;

  beforeEach(async () => {
    workspaceElement = atom.views.getView(atom.workspace);
    jasmine.attachToDOM(workspaceElement);
    ({ mainModule } = await atom.packages.activatePackage("terminal-spawn"));
    spyOn(mainModule, "spawnCommand");
  });

  it("registers its workspace commands", () => {
    const commands = atom.commands
      .findCommands({ target: workspaceElement })
      .map((command) => command.name);
    expect(commands).toContain("terminal-spawn:root");
    expect(commands).toContain("terminal-spawn:open");
    expect(commands).toContain("terminal-spawn:list");
  });

  describe("terminal-spawn:root", () => {
    it("spawns the configured terminal at the project root", () => {
      atom.project.setPaths([__dirname]);
      const root = atom.project.getPaths()[0];
      atom.commands.dispatch(workspaceElement, "terminal-spawn:root");

      const template = atom.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", root).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, root);
    });

    it("does nothing without a project root", () => {
      atom.project.setPaths([]);
      atom.commands.dispatch(workspaceElement, "terminal-spawn:root");
      expect(mainModule.spawnCommand).not.toHaveBeenCalled();
    });
  });

  describe("terminal-spawn:open", () => {
    it("spawns the terminal in the active file's directory", async () => {
      const editor = await atom.workspace.open(__filename);
      const editorElement = atom.views.getView(editor);
      atom.commands.dispatch(editorElement, "terminal-spawn:open");

      const cwd = path.dirname(__filename);
      const template = atom.config.get("terminal-spawn.command");
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

      const template = atom.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", __dirname).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, __dirname);
    });

    it("uses the command template when a command is given", () => {
      const service = mainModule.provideTerminalSpawn();
      service.open(__dirname, "npm test");

      const template = atom.config.get("terminal-spawn.commandWithArgs");
      const expected = template.replaceAll("{cwd}", __dirname).replaceAll("{command}", "npm test");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, __dirname);
    });

    it("resolves a file path to its parent directory", () => {
      const service = mainModule.provideTerminalSpawn();
      service.open(__filename);

      const cwd = path.dirname(__filename);
      const template = atom.config.get("terminal-spawn.command");
      const expected = template.replaceAll("{cwd}", cwd).replaceAll("{command}", "");
      expect(mainModule.spawnCommand).toHaveBeenCalledWith(expected, cwd);
    });
  });

  describe("terminal-spawn:list", () => {
    afterEach(() => {
      atom.modals.cancel("spec");
    });

    it("shows the preset list and applies the confirmed preset", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settleModal();

      const session = atom.modals.getActiveSession();
      expect(session).not.toBeNull();
      expect(session.rootSpec.id).toBe("terminal-spawn.presets");
      expect(session.element.classList.contains("terminal-spawn-list")).toBe(true);
      expect(session.element.querySelectorAll("ol.list-group > li").length).toBeGreaterThan(0);

      atom.commands.dispatch(session.element, "core:confirm");
      await settleModal();

      const preset = PRESETS.find((p) => p.platform === process.platform);
      expect(atom.config.get("terminal-spawn.command")).toBe(preset.command);
      expect(atom.config.get("terminal-spawn.commandWithArgs")).toBe(preset.commandWithArgs);
    });

    it("lists only the presets of the running platform, command lines below the name", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settleModal();

      const session = atom.modals.getActiveSession();
      const expected = PRESETS.filter((preset) => preset.platform === process.platform);
      expect(session.getVisibleItems()).toEqual(expected);

      const row = session.element.querySelector("ol.list-group > li");
      expect(row.querySelector(".primary-text").textContent).toBe(expected[0].name);
      const details = Array.from(row.querySelectorAll(".secondary-line")).map(
        (line) => line.textContent,
      );
      expect(details).toEqual([expected[0].command, expected[0].commandWithArgs]);
    });

    it("stays open on a query that matches nothing", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settleModal();

      const session = atom.modals.getActiveSession();
      const command = atom.config.get("terminal-spawn.command");
      session.setQuery("no-such-preset");
      await settleModal();
      expect(session.getVisibleItems().length).toBe(0);

      atom.commands.dispatch(session.element, "core:confirm");
      await settleModal();
      expect(atom.modals.getActiveSession()).toBe(session);
      expect(atom.config.get("terminal-spawn.command")).toBe(command);
    });

    it("reopens on a second invocation", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settleModal();
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settleModal();

      const session = atom.modals.getActiveSession();
      expect(session).not.toBeNull();
      expect(session.getVisibleItems().length).toBeGreaterThan(0);
    });
  });
});
