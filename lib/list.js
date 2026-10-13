const os = require("os");
const { PRESETS } = require("./presets");

const windowLists = new Map();

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

function show(window = lumine.workspace.getMainWindow()) {
  const platform = os.platform();
  const items = PRESETS.filter((p) => p.platform === platform);

  let record = windowLists.get(window);
  if (!record) {
    const selectListHost = lumine.workspace.addSelectList(
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
      { className: "terminal-spawn-list", crumb: "Shell Presets", window },
    );
    const lease = window.onWillDestroy(() => {
      windowLists.delete(window);
      lease.dispose();
      void selectListHost.destroy();
    });
    record = { host: selectListHost, lease };
    windowLists.set(window, record);
  } else {
    record.host.getModel().setItems(items);
  }
  return record.host.show();
}

function destroy() {
  const records = [...windowLists.values()];
  windowLists.clear();
  for (const record of records) record.lease.dispose();
  return Promise.all(records.map(({ host }) => host.destroy()));
}

module.exports = { show, destroy };
