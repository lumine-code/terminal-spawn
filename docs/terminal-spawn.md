# terminal-spawn

Opens the user's external terminal application at a directory, optionally with a command already run.

|             |                                                                   |
| ----------- | ----------------------------------------------------------------- |
| Version     | `1.0.0`                                                           |
| Provided by | `provideTerminalSpawn()` returning `{ open }`                     |
| Consumed by | `consumeTerminalSpawn(terminalSpawn)`                             |
| Owner       | [`terminal-spawn`](https://github.com/lumine-code/terminal-spawn) |

The counterpart to `terminal`: that one runs commands inside the editor, this one hands the user off to their real terminal. Use it when the work outlives the editor session or wants a full shell.

## Registration

In your `package.json`:

```json
{
  "consumedServices": {
    "terminal-spawn": {
      "versions": { "^1.0.0": "consumeTerminalSpawn" }
    }
  }
}
```

## Contract

```ts
type TerminalSpawn = {
  open(dirpath?: string, command?: string): void;
};
```

| Argument  | Description                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dirpath` | Where to open. **A falsy value falls back to the active project root**, and a path to a _file_ uses its parent directory.                           |
| `command` | Optional. When given, the terminal opens with the command already executed, using the user's configured "terminal command with arguments" template. |

## Minimal example

```js
const { Disposable } = require("lumine");

module.exports = {
  consumeTerminalSpawn(terminalSpawn) {
    this.spawn = terminalSpawn;
    return new Disposable(() => (this.spawn = null));
  },

  openHere() {
    // A file path is fine — the parent directory is used.
    this.spawn?.open(lumine.workspace.getActiveTextEditor()?.getPath());
  },
};
```

## Behavior

The path handling is forgiving on purpose: pass whatever you have. A file path resolves to its directory, and passing nothing at all opens at the project root, so a consumer rarely needs to normalise anything itself.

**Which terminal opens is the user's setting**, as is the template used to pass a command. Do not build shell invocations expecting a particular emulator or shell — supply the command and let the template place it.

`open` returns nothing and reports nothing. There is no way to know whether the terminal launched, whether the command ran, or what it produced. If you need the result, this is the wrong service.

Because the command goes through a user-editable template, treat it as a request rather than an execution: keep it simple and avoid multi-statement shell constructs that a different template might mangle.

## Teardown

Return a `Disposable` that drops your reference. The spawned terminal is an external process and is not yours to manage.

## Versioning

`1.0.0` provided, `^1.0.0` consumed. A change that breaks this shape gets a new service name rather than a new major version, and both sides move in the same release.
