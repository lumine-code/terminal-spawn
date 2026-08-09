const os = require("os");
const { PRESETS } = require("./presets");

let selectListView = null;

function filterKeyForItem(item) {
  return item.name;
}

function elementForItem(item, { filterKey, highlight }) {
  const secondary = document.createElement("div");
  const cmdLine = document.createElement("div");
  cmdLine.textContent = item.command;
  const argsLine = document.createElement("div");
  argsLine.textContent = item.commandWithArgs;
  secondary.appendChild(cmdLine);
  secondary.appendChild(argsLine);
  return {
    primary: highlight(filterKey),
    secondary,
  };
}

function applyPreset(item) {
  lumine.config.set("terminal-spawn.command", item.command);
  lumine.config.set("terminal-spawn.commandWithArgs", item.commandWithArgs);
  lumine.notifications.addSuccess(`Presets applied!`, {
    description: `${item.name}`,
    detail: `${item.command}\n${item.commandWithArgs}`,
  });
}

function show() {
  const platform = os.platform();
  const items = PRESETS.filter((p) => p.platform === platform);

  if (!selectListView) {
    selectListView = lumine.workspace.buildSelectList({
      className: "terminal-spawn-list",
      crumb: "Shell Presets",
      items,
      filterKeyForItem,
      elementForItem,
      emptyMessage: "No presets match this platform",
      placeholderText: "Search terminal presets...",
      didConfirmSelection: (item) => {
        applyPreset(item);
        selectListView.hide();
      },
      didCancelSelection: () => {
        selectListView.hide();
      },
    });
  } else {
    selectListView.update({ items });
  }
  selectListView.show();
}

function destroy() {
  if (selectListView) {
    selectListView.destroy();
    selectListView = null;
  }
}

module.exports = { show, destroy };
