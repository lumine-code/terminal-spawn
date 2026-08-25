const PRESETS = [
  {
    platform: "win32",
    name: "Command Prompt",
    command: 'start /D "{cwd}" cmd',
    commandWithArgs: 'start /D "{cwd}" cmd /K "{command}"',
  },
  {
    platform: "win32",
    name: "Windows PowerShell",
    command: `start powershell -NoExit -Command "Set-Location -LiteralPath '{cwd}'"`,
    commandWithArgs: `start powershell -NoExit -Command "Set-Location -LiteralPath '{cwd}'; {command}"`,
  },
  {
    platform: "win32",
    name: "PowerShell 7",
    command: `start pwsh -NoExit -Command "Set-Location -LiteralPath '{cwd}'"`,
    commandWithArgs: `start pwsh -NoExit -Command "Set-Location -LiteralPath '{cwd}'; {command}"`,
  },
  {
    platform: "win32",
    name: "Windows Terminal (new window)",
    command: 'wt -w new new-tab --inheritEnvironment -d "{cwd}"',
    commandWithArgs: 'wt -w new new-tab --inheritEnvironment -d "{cwd}" cmd /K "{command}"',
  },
  {
    platform: "win32",
    name: "Windows Terminal (new tab)",
    command: 'wt -w 0 new-tab --inheritEnvironment -d "{cwd}"',
    commandWithArgs: 'wt -w 0 new-tab --inheritEnvironment -d "{cwd}" cmd /K "{command}"',
  },
  {
    platform: "darwin",
    name: "Terminal.app",
    command: 'open -a Terminal.app "{cwd}"',
    commandWithArgs: `osascript -e 'tell app "Terminal" to do script "cd \\"{cwd}\\" && {command}"'`,
  },
  {
    platform: "darwin",
    name: "iTerm2",
    command: 'open -a iTerm "{cwd}"',
    commandWithArgs: `osascript -e 'tell app "iTerm" to create window with default profile command "bash -c \\"cd {cwd}; {command}; exec bash\\""'`,
  },
  {
    platform: "linux",
    name: "Default emulator",
    command: "x-terminal-emulator",
    commandWithArgs: `x-terminal-emulator -e bash -c 'cd "{cwd}"; {command}; exec bash'`,
  },
  {
    platform: "linux",
    name: "GNOME Terminal",
    command: 'gnome-terminal --tab --working-directory="{cwd}"',
    commandWithArgs: `gnome-terminal --working-directory="{cwd}" -- bash -c '{command}; exec bash'`,
  },
  {
    platform: "linux",
    name: "Konsole",
    command: 'konsole --new-tab --workdir "{cwd}"',
    commandWithArgs: `konsole --workdir "{cwd}" -e bash -c '{command}; exec bash'`,
  },
  {
    platform: "linux",
    name: "WezTerm",
    command: 'wezterm start --cwd "{cwd}"',
    commandWithArgs: `wezterm start --cwd "{cwd}" -- bash -c '{command}; exec bash'`,
  },
  {
    platform: "linux",
    name: "Kitty",
    command: 'kitty @ launch --type tab --cwd "{cwd}"',
    commandWithArgs: `kitty @ launch --type tab --cwd "{cwd}" bash -c '{command}; exec bash'`,
  },
];

module.exports = { PRESETS };
