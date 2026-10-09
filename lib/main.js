const { CompositeDisposable, Disposable } = require("lumine");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const selectPreset = require("./list");

const STRIPPED_ENV_VARS = new Set([
  "NODE_PATH",
  "NODE_ENV",
  "GOOGLE_API_KEY",
  "LUMINE_HOME",
  "LUMINE_BRIDGE_HOST",
  "LUMINE_BRIDGE_PORT",
  "LUMINE_BRIDGE_TOKEN",
]);

function defaultCommand() {
  switch (os.platform()) {
    case "darwin":
      return 'open -a Terminal.app "{cwd}"';
    case "win32":
      return 'start /D "{cwd}" cmd';
    default:
      return "x-terminal-emulator";
  }
}

function defaultCommandWithArgs() {
  switch (os.platform()) {
    case "darwin":
      return `osascript -e 'tell app "Terminal" to do script "cd \\"{cwd}\\" && {command}"'`;
    case "win32":
      return 'start /D "{cwd}" cmd /K "{command}"';
    default:
      return `x-terminal-emulator -e bash -c 'cd "{cwd}"; {command}; exec bash'`;
  }
}

function applyTemplate(template, cwd, command) {
  return template.replaceAll("{cwd}", cwd).replaceAll("{command}", command);
}

function filterProcessEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!STRIPPED_ENV_VARS.has(key.toUpperCase())) env[key] = value;
  }
  return env;
}

async function environmentForSpawn(bridge) {
  const env = filterProcessEnv();
  if (typeof bridge?.getBridgePortWhenReady !== "function") return env;

  try {
    const port = await bridge.getBridgePortWhenReady();
    if (Number.isInteger(port) && port >= 1024 && port <= 65535) {
      env.LUMINE_BRIDGE_PORT = String(port);
    }
  } catch {
    // The bridge is optional. An unavailable bridge must never prevent the
    // user's terminal from opening.
  }
  return env;
}

function connectBridge(main, owner, bridge) {
  if (owner.retired || main.activation !== owner) return new Disposable();
  const connection = { bridge };
  owner.connections.add(connection);
  main.mcpBridge = bridge;
  const lease = new Disposable(() => {
    owner.connections.delete(connection);
    owner.subscriptions.remove(lease);
    if (!owner.retired && main.activation === owner) {
      main.mcpBridge = [...owner.connections].at(-1)?.bridge ?? null;
    }
  });
  owner.subscriptions.add(lease);
  return lease;
}

function getActiveFilePath() {
  const selected = document.querySelector(".tree-view .selected");
  if (selected && typeof selected.getPath === "function") {
    return selected.getPath();
  }
  const item = lumine.workspace.getActivePaneItem();
  return item?.getPath?.();
}

function getRootDir() {
  const defaultPath = lumine.project.getPaths()[0];
  const activeFilePath = getActiveFilePath();
  if (!activeFilePath) return defaultPath;
  return lumine.project.relativizePath(activeFilePath)[0] ?? defaultPath;
}

// The path a dispatch is about: the tree-view row it came from, the editor it
// came from, and otherwise whatever the workspace is showing. The application
// menu dispatches at whatever holds focus, so only the last branch applies
// there — which is why one workspace registration can serve all three.
function pathForEvent(event) {
  const target = event?.target;
  const row = target?.closest?.(".tree-view .selected");
  if (typeof row?.getPath === "function") return row.getPath();
  const editorPath = lumine.workspace
    .getTextEditorForElement(target, { includeMini: false })
    ?.getPath?.();
  return editorPath || getActiveFilePath();
}

function resolveDir(filepath) {
  if (!filepath) return getRootDir();
  try {
    const real = fs.realpathSync(filepath);
    if (fs.lstatSync(real).isFile()) return path.dirname(filepath);
    return filepath;
  } catch {
    return path.dirname(filepath);
  }
}

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "terminal-spawn",
      tips: [
        "You can open your system terminal for the current file or folder with {{ 'terminal-spawn:open' | keystroke }}",
      ],
    };
  },

  activate() {
    const owner = {
      connections: new Set(),
      subscriptions: new CompositeDisposable(),
      retired: false,
    };
    const main = this;
    this.activation = owner;
    this.bridgeConnections = owner.connections;
    this.mcpBridge = null;
    this.disposables = owner.subscriptions;
    this.consumeMcpBridge = function consumeMcpBridge(bridge) {
      return connectBridge(main, owner, bridge);
    };
    owner.subscriptions.add(
      lumine.commands.add("lumine-workspace", {
        "terminal-spawn:open": {
          description: "Spawn an external terminal in this file's folder.",
          didDispatch: (event) => module.exports.openTerminal(pathForEvent(event)),
        },
        "terminal-spawn:root": {
          description: "Spawn an external terminal at the project root.",
          didDispatch: () => module.exports.openTerminal(),
        },
        "terminal-spawn:list": {
          description: "Choose which of the configured terminals to spawn.",
          didDispatch: () => selectPreset.show(),
        },
      }),
    );
  },

  deactivate() {
    const owner = this.activation;
    if (!owner) return;
    owner.retired = true;
    this.activation = null;
    this.disposables = null;
    this.bridgeConnections = null;
    this.mcpBridge = null;
    owner.connections.clear();
    try {
      return selectPreset.destroy();
    } finally {
      owner.subscriptions.dispose();
    }
  },

  openTerminal(filepath, command) {
    const dirpath = resolveDir(filepath);
    if (!dirpath) {
      lumine.notifications.addWarning("terminal-spawn: no directory to open", {
        detail: "Open a project folder or a saved file first.",
      });
      return;
    }
    if (command) {
      const template =
        lumine.config.get("terminal-spawn.commandWithArgs") || defaultCommandWithArgs();
      return module.exports.spawnCommand(applyTemplate(template, dirpath, command), dirpath);
    } else {
      const template = lumine.config.get("terminal-spawn.command") || defaultCommand();
      return module.exports.spawnCommand(applyTemplate(template, dirpath, ""), dirpath);
    }
  },

  async spawnCommand(command, cwd) {
    if (!command || !cwd) return;
    const env = await environmentForSpawn(this.mcpBridge);
    try {
      return childProcess.exec(command, { cwd, env });
    } catch (error) {
      if (error.code === "EACCES") {
        lumine.notifications.addError(`Permission denied to run command at ${cwd}`, {
          dismissable: true,
        });
      } else {
        throw error;
      }
    }
  },

  consumeMcpBridge(_bridge) {
    return new Disposable();
  },

  provideTerminalSpawn() {
    return {
      open: (dirpath, command) => {
        module.exports.openTerminal(dirpath, command);
      },
    };
  },
};
