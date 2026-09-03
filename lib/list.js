const os = require("os");
const { PRESETS } = require("./presets");

let selectList = null;
let selectListHost = null;

function getFilterText(item) {
  return item.name;
}

function renderItem(item, { filterKey, highlight }) {
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

  if (!selectList) {
    selectListHost = lumine.workspace.addSelectList(
      {
        items,
        getItemId: (item) => `${item.platform}:${item.name}`,
        search: { getFilterText },
        renderItem,
        emptyMessage: "No presets match this platform",
        placeholderText: "Search terminal presets...",
        commands: {
          "terminal-spawn:apply-selected-preset": {
            description: "Use the selected shell preset for new terminals.",
            didDispatch: (event) => applyPreset(event.detail.item),
          },
        },
        actions: [
          {
            command: "terminal-spawn:apply-selected-preset",
            context: "item",
            primary: true,
            disposition: "close",
          },
        ],
      },
      { className: "terminal-spawn-list", crumb: "Shell Presets" },
    );
    selectList = selectListHost.getModel();
  } else {
    selectList.setItems(items);
  }
  selectListHost.show();
}

function destroy() {
  if (selectListHost) {
    selectListHost.destroy();
    selectListHost = null;
    selectList = null;
  }
}

module.exports = { show, destroy };
