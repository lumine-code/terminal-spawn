# terminal-spawn

Spawn the system terminal in the current file or project directory.

Distinct from the built-in `terminal` package: this one launches the OS terminal application as a separate process, not an embedded one.

## Features

- **Spawn at file**: launch the terminal in the active file's directory or tree view selection.
- **Spawn at project root**: launch the terminal in the project root directory.
- **Configurable command**: customize the shell command used on each platform.
- **Spawn with command**: launch the terminal with a command pre-executed inside it (via the provided service).
- **Preset list**: pick from a list of per-platform terminal presets to populate the settings.
- **Lumine MCP targeting**: new terminals inherit the current window's bridge port when `lumine-mcp` is available, while every agent still needs your approval before it can connect.

## Installation

To install `terminal-spawn` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/terminal-spawn`.

## Commands

Commands available in `lumine-workspace`:

- `terminal-spawn:root`: spawn the terminal in the project root directory,
- `terminal-spawn:open`: spawn the terminal in the selected or active file's directory,
- `terminal-spawn:list`: open a list of terminal presets and apply the chosen one to the settings.

## Configuration

Pick a row matching your terminal of choice. Use `terminal-spawn:list` to apply one directly, or copy the snippets into the two settings. Defaults for each platform are marked `(default)`.

| Platform | Terminal                      | Command                                                                 | Command with arguments                                                                                                       |
| -------- | ----------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Windows  | Command Prompt (default)      | `start /D "{cwd}" cmd`                                                  | `start /D "{cwd}" cmd /K "{command}"`                                                                                        |
| Windows  | Windows PowerShell            | `start powershell -NoExit -Command "Set-Location -LiteralPath '{cwd}'"` | `start powershell -NoExit -Command "Set-Location -LiteralPath '{cwd}'; {command}"`                                           |
| Windows  | PowerShell 7                  | `start pwsh -NoExit -Command "Set-Location -LiteralPath '{cwd}'"`       | `start pwsh -NoExit -Command "Set-Location -LiteralPath '{cwd}'; {command}"`                                                 |
| Windows  | Windows Terminal (new window) | `wt -w new new-tab --inheritEnvironment -d "{cwd}"`                     | `wt -w new new-tab --inheritEnvironment -d "{cwd}" cmd /K "{command}"`                                                       |
| Windows  | Windows Terminal (new tab)    | `wt -w 0 new-tab --inheritEnvironment -d "{cwd}"`                       | `wt -w 0 new-tab --inheritEnvironment -d "{cwd}" cmd /K "{command}"`                                                         |
| macOS    | Terminal.app (default)        | `open -a Terminal.app "{cwd}"`                                          | `osascript -e 'tell app "Terminal" to do script "cd \"{cwd}\" && {command}"'`                                                |
| macOS    | iTerm2                        | `open -a iTerm "{cwd}"`                                                 | `osascript -e 'tell app "iTerm" to create window with default profile command "bash -c \"cd {cwd}; {command}; exec bash\""'` |
| Linux    | Default emulator (default)    | `x-terminal-emulator`                                                   | `x-terminal-emulator -e bash -c 'cd "{cwd}"; {command}; exec bash'`                                                          |
| Linux    | GNOME Terminal                | `gnome-terminal --tab --working-directory="{cwd}"`                      | `gnome-terminal --working-directory="{cwd}" -- bash -c '{command}; exec bash'`                                               |
| Linux    | Konsole                       | `konsole --new-tab --workdir "{cwd}"`                                   | `konsole --workdir "{cwd}" -e bash -c '{command}; exec bash'`                                                                |
| Linux    | WezTerm                       | `wezterm start --cwd "{cwd}"`                                           | `wezterm start --cwd "{cwd}" -- bash -c '{command}; exec bash'`                                                              |
| Linux    | Kitty                         | `kitty @ launch --type tab --cwd "{cwd}"`                               | `kitty @ launch --type tab --cwd "{cwd}" bash -c '{command}; exec bash'`                                                     |

Supports `{cwd}` and `{command}` placeholders.

When `lumine-mcp` is running, `terminal-spawn` removes any inherited `LUMINE_BRIDGE_HOST`, `LUMINE_BRIDGE_PORT`, and `LUMINE_BRIDGE_TOKEN`, then supplies only the current window's `LUMINE_BRIDGE_PORT` to the new terminal. This lets an MCP client call `ConnectToLumine()` without being told a port, but does not authorize it: Lumine still asks you to allow or deny every connection. If the bridge is unavailable, the terminal opens normally without MCP targeting information.

An emulator that delegates new tabs to an already-running GUI process may discard the launcher's environment. In that case, use `Lumine MCP: Status` and give its port to the agent explicitly; `terminal-spawn` does not force a separate emulator instance just to carry the variable.

## Services

- [`terminal-spawn`](docs/terminal-spawn.md): provided to packages that need an external terminal; exposes `open(dirpath, command)` which spawns the user-configured terminal at `dirpath`. If `command` is given, the terminal opens with that command pre-executed (using the `Terminal command with arguments` template). If `dirpath` is falsy, falls back to the active project root; if it points to a file, its parent directory is used.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
