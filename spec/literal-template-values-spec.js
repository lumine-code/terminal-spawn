const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");
const { Disposable } = require("lumine");

describe("terminal-spawn literal template values", () => {
  let scratch, temporaryRoot, service, lease, previousPaths, editor;

  beforeEach(async () => {
    jasmine.useRealClock();
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"]) {
      spyOn(lumine.shell, method).and.returnValue(Promise.resolve());
    }
    spyOn(lumine.application, "openWindow").and.returnValue(Promise.resolve());
    spyOn(childProcess, "exec").and.returnValue({});
    temporaryRoot = fs.realpathSync.native(os.tmpdir());
    scratch = fs.realpathSync.native(
      fs.mkdtempSync(path.join(temporaryRoot, "terminal-template-")),
    );
    previousPaths = lumine.project.getPaths();
    lease = lumine.packages.serviceHub.consume("terminal-spawn", "^1.0.0", (provided) => {
      service = provided;
      return new Disposable(() => {
        service = null;
      });
    });
    await lumine.packages.activatePackage("terminal-spawn");
    expect(service).toBeDefined();
    lumine.config.set("terminal-spawn.command", 'launch "{cwd}"');
    lumine.config.set("terminal-spawn.commandWithArgs", 'launch "{cwd}" --request "{command}"');
  });

  afterEach(async () => {
    editor?.destroy();
    editor = null;
    lease?.dispose();
    await lumine.project.setPaths(previousPaths);
    if (lumine.packages.isPackageLoaded("terminal-spawn")) {
      await lumine.packages.deactivatePackage("terminal-spawn");
    }
    const target = fs.realpathSync.native(scratch);
    const relative = path.relative(fs.realpathSync.native(temporaryRoot), target);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("Refusing cleanup outside the owned temporary child");
    }
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  });

  async function capturedLaunch() {
    await conditionPromise(() => childProcess.exec.calls.count() === 1);
    return childProcess.exec.calls.mostRecent().args;
  }

  it("preserves dollar replacement syntax and placeholder text in an existing directory", async () => {
    const directory = path.join(scratch, "literal $& {command}");
    fs.mkdirSync(directory);
    service.open(directory, "echo ready");
    const [command, options] = await capturedLaunch();
    expect(command).toBe(`launch "${directory}" --request "echo ready"`);
    expect(options.cwd).toBe(directory);
  });

  it("preserves replacement syntax and placeholder text in the supplied command", async () => {
    const requested = "echo $& {cwd} $$";
    service.open(scratch, requested);
    const [command, options] = await capturedLaunch();
    expect(command).toBe(`launch "${scratch}" --request "${requested}"`);
    expect(options.cwd).toBe(scratch);
  });

  it("retains ordinary command dispatch and resolves an owned file to its directory", async () => {
    const file = path.join(scratch, "ordinary.txt");
    fs.writeFileSync(file, "control\n");
    editor = await lumine.workspace.open(file);
    const workspace = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspace);
    lumine.commands.dispatch(lumine.views.getView(editor), "terminal-spawn:open");
    const [command, options] = await capturedLaunch();
    expect(command).toBe(`launch "${scratch}"`);
    expect(options.cwd).toBe(scratch);
  });
});
