describe("External terminal command availability", () => {
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    lumine.project.setPaths([]);
    await lumine.packages.activatePackage("terminal-spawn");
  });
  it("does not resolve real filesystem roots while checking the root command", async () => {
    lumine.project.setPaths([__dirname]);
    const editor = await lumine.workspace.open(__filename, { opener: "text-editor" });
    const resolve = spyOn(lumine.project, "relativizePath").and.callThrough();
    try {
      expect(lumine.commands.canDispatch(editor.getElement(), "terminal-spawn:root")).toBe(true);
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      resolve.and.callThrough();
      editor.destroy();
    }
  });
  it("requires a path or project but leaves terminal presets accessible", () => {
    const target = lumine.workspace.getElement();
    expect(lumine.commands.canDispatch(target, "terminal-spawn:open")).toBe(false);
    expect(lumine.commands.canDispatch(target, "terminal-spawn:root")).toBe(false);
    expect(lumine.commands.canDispatch(target, "terminal-spawn:list")).toBe(true);
    lumine.project.setPaths([__dirname]);
    expect(lumine.commands.canDispatch(target, "terminal-spawn:open")).toBe(true);
    expect(lumine.commands.canDispatch(target, "terminal-spawn:root")).toBe(true);
  });
});
