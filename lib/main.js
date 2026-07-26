const { CompositeDisposable } = require("atom");
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
  const item = atom.workspace.getActivePaneItem();
  return item?.buffer?.file?.path;
}

function getRootDir() {
  const dirs = atom.project.getDirectories();
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
      atom.commands.add(".tree-view .selected, atom-text-editor, atom-workspace", {
        "terminal-spawn:open": function (event) {
          event.stopImmediatePropagation();
          const target = this.getPath?.() || this.getModel?.()?.getPath?.() || getActiveFilePath();
          module.exports.openTerminal(target);
        },
      }),
      atom.commands.add("atom-workspace", {
        "terminal-spawn:root": (event) => {
          event.stopImmediatePropagation();
          module.exports.openTerminal();
        },
        "terminal-spawn:list": (event) => {
          event.stopImmediatePropagation();
          selectPreset.show();
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
    if (!dirpath) return;
    if (command) {
      const template = atom.config.get("terminal-spawn.commandWithArgs");
      return module.exports.spawnCommand(applyTemplate(template, dirpath, command), dirpath);
    } else {
      const template = atom.config.get("terminal-spawn.command");
      return module.exports.spawnCommand(applyTemplate(template, dirpath, ""), dirpath);
    }
  },

  spawnCommand(command, cwd) {
    if (!command || !cwd) return;
    try {
      return exec(command, { cwd, env: filterProcessEnv() });
    } catch (error) {
      if (error.code === "EACCES") {
        atom.notifications.addError(`Permission denied to run command at ${cwd}`, {
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
