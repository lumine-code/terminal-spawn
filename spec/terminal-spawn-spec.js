const path = require("path");
const { PRESETS } = require("../lib/presets");

// The shared modal vocabulary lives in the editor checkout, which sits beside
// this repository in CI and one level further up in the development workspace,
// so resolve it through the running editor rather than by a relative path.
const {
  activeSession,
  cancel,
  confirm,
  confirmItem,
  emptyMessageText,
  isModalOpen,
  modalElement,
  settle,
  setQuery,
  visibleItems,
  visibleLabels,
} = require(path.join(atom.getLoadSettings().resourcePath, "spec", "helpers", "modal-helpers"));

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
    // Every platform's presets, in the order the list renders them.
    const platformPresets = PRESETS.filter((preset) => preset.platform === process.platform);

    afterEach(async () => {
      if (isModalOpen()) cancel();
      await settle();
    });

    it("shows the preset list and applies the confirmed preset", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();

      const session = activeSession();
      expect(session).not.toBeNull();
      expect(session.rootSpec.id).toBe("terminal-spawn.presets");
      expect(modalElement().classList.contains("terminal-spawn-list")).toBe(true);

      // Deliberately not the first row: on every platform the first preset is
      // also that platform's config default, so confirming it would assert
      // nothing about whether the confirm handler ran at all.
      const preset = platformPresets[1];
      await confirmItem(preset);

      expect(isModalOpen()).toBe(false);
      expect(atom.config.get("terminal-spawn.command")).toBe(preset.command);
      expect(atom.config.get("terminal-spawn.commandWithArgs")).toBe(preset.commandWithArgs);
    });

    it("lists only the presets of the running platform, command lines below the name", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();

      expect(visibleItems()).toEqual(platformPresets);
      expect(visibleLabels()).toEqual(platformPresets.map((preset) => preset.name));

      const row = modalElement().querySelector("ol.list-group > li");
      const details = Array.from(row.querySelectorAll(".secondary-line")).map(
        (line) => line.textContent,
      );
      expect(details).toEqual([platformPresets[0].command, platformPresets[0].commandWithArgs]);
    });

    it("highlights the matched characters of the preset name", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();

      // The old list highlighted the name by hand; the kernel now does it from
      // `ctx.highlights.label`, so the rendered spans are worth pinning down.
      const preset = platformPresets[0];
      const query = preset.name.slice(0, 3);
      setQuery(query);
      await settle();

      const row = Array.from(modalElement().querySelectorAll("ol.list-group > li")).find(
        (li) => li.querySelector(".primary-text").textContent === preset.name,
      );
      expect(row).toBeTruthy();
      const matched = Array.from(row.querySelectorAll(".primary-text .character-match"))
        .map((span) => span.textContent)
        .join("");
      expect(matched.toLowerCase()).toBe(query.toLowerCase());
    });

    it("stays open on a query that matches nothing", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();

      const session = activeSession();
      const command = atom.config.get("terminal-spawn.command");
      setQuery("no-such-preset");
      await settle();
      expect(visibleItems().length).toBe(0);
      expect(emptyMessageText()).toBe("No presets match this platform");

      confirm();
      await settle();
      expect(activeSession()).toBe(session);
      expect(atom.config.get("terminal-spawn.command")).toBe(command);
    });

    it("reopens on a second invocation", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();
      const first = activeSession();

      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();

      expect(activeSession()).not.toBeNull();
      expect(activeSession()).not.toBe(first);
      expect(visibleItems().length).toBeGreaterThan(0);
    });

    it("closes the list when the package deactivates", async () => {
      atom.commands.dispatch(workspaceElement, "terminal-spawn:list");
      await settle();
      expect(isModalOpen()).toBe(true);

      await atom.packages.deactivatePackage("terminal-spawn");
      expect(isModalOpen()).toBe(false);
    });
  });
});
