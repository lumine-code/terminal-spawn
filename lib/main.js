const { CompositeDisposable } = require("lumine");
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const selectPreset = require("./list");

const LEAKED_ENV_VARS = ["NODE_PATH", "NODE_ENV", "GOOGLE_API_KEY", "LUMINE_HOME"];

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
    if (!LEAKED_ENV_VARS.includes(key)) env[key] = value;
  }
  return env;
}

function getActiveFilePath() {
  const selected = document.querySelector(".tree-view .selected");
  if (selected && typeof selected.getPath === "function") {
    return selected.getPath();
  }
  const item = lumine.workspace.getActivePaneItem();
  return item?.buffer?.file?.path;
}

function getRootDir() {
  const dirs = lumine.project.getDirectories();
  const defaultPath = dirs[0]?.getPath();
  if (dirs.length < 2) return defaultPath;
  const activeFilePath = getActiveFilePath();
  if (!activeFilePath) return defaultPath;
  for (const dir of dirs) {
    const dirPath = dir.getPath();
    if (activeFilePath.startsWith(dirPath + path.sep)) return dirPath;
  }
  return defaultPath;
}

// The path a dispatch is about: the tree-view row it came from, the editor it
// came from, and otherwise whatever the workspace is showing. The application
// menu dispatches at whatever holds focus, so only the last branch applies
// there — which is why one workspace registration can serve all three.
function pathForEvent(event) {
  const target = event?.target;
  const row = target?.closest?.(".tree-view .selected");
  if (typeof row?.getPath === "function") return row.getPath();
  const editorPath = target?.closest?.("lumine-text-editor:not([mini])")?.getModel?.()?.getPath?.();
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
  // The defaults depend on the current platform, so the config schema must be
  // built dynamically at runtime rather than declared in package.json.
  config: {
    command: {
      title: "Terminal command",
      description: "Shell command executed to launch the terminal. Use `{cwd}` as placeholder.",
      type: "string",
      default: defaultCommand(),
    },
    commandWithArgs: {
      title: "Terminal command with arguments",
      description:
        "Template used when launching the terminal with a command. Use `{cwd}` and `{command}` as placeholders.",
      type: "string",
      default: defaultCommandWithArgs(),
    },
  },

  activate() {
    this.disposables = new CompositeDisposable(
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
    selectPreset.destroy();
    this.disposables.dispose();
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
      const template = lumine.config.get("terminal-spawn.commandWithArgs");
      return module.exports.spawnCommand(applyTemplate(template, dirpath, command), dirpath);
    } else {
      const template = lumine.config.get("terminal-spawn.command");
      return module.exports.spawnCommand(applyTemplate(template, dirpath, ""), dirpath);
    }
  },

  spawnCommand(command, cwd) {
    if (!command || !cwd) return;
    try {
      return exec(command, { cwd, env: filterProcessEnv() });
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

  provideTerminalSpawn() {
    return {
      open: (dirpath, command) => module.exports.openTerminal(dirpath, command),
    };
  },
};
