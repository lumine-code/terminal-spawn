// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript"],
  viewport: { width: 1100, height: 730 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("workflows/signal.js");
    await lumine.project.setPaths([fixture("workflows")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Choose a preset for launching an external terminal.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          lumine.commands.dispatch(lumine.views.getView(state.editor), "terminal-spawn:list");
        }
      },
      ready() {
        const list = document.querySelector(".terminal-spawn-list");
        return (
          list?.getBoundingClientRect().height > 0 && Boolean(list.querySelector('[role="option"]'))
        );
      },
    },
  ],
  async cleanup() {},
};
