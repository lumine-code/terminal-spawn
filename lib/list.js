const os = require("os");
const { PRESETS } = require("./presets");

const VIEW_ID = "terminal-spawn.presets";

function applyPreset(item) {
  atom.config.set("terminal-spawn.command", item.command);
  atom.config.set("terminal-spawn.commandWithArgs", item.commandWithArgs);
  atom.notifications.addSuccess(`Presets applied!`, {
    description: `${item.name}`,
    detail: `${item.command}\n${item.commandWithArgs}`,
  });
}

function show() {
  // The platform is read per invocation rather than baked into a long-lived
  // view, so a spec that stubs it still sees the right presets.
  const platform = os.platform();

  return atom.modals.open({
    id: VIEW_ID,
    className: "terminal-spawn-list",
    placeholder: "Search terminal presets...",
    emptyMessage: "No presets match this platform",
    source: () => PRESETS.filter((preset) => preset.platform === platform),
    renderer: {
      // Preset objects are module constants, so they are their own identity.
      entry: (item) => ({ id: item, text: item.name }),
      row: (item) => ({
        label: item.name,
        detail: [item.command, item.commandWithArgs],
      }),
    },
    confirm: ({ item }) => {
      // Enter on a query that matches nothing did nothing before, and closing
      // the list would lose whatever the user was still typing.
      if (!item) return { keepOpen: true };
      applyPreset(item);
    },
  });
}

// Deactivating the package must not leave its list standing on handlers that
// are about to go away.
function close() {
  const session = atom.modals.getActiveSession();
  if (session && session.rootSpec.id === VIEW_ID) session.cancel("api");
}

module.exports = { show, close, VIEW_ID };
