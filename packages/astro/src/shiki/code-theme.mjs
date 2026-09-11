// Custom TextMate theme: amber on the parent theme's dark brown.
export default {
  name: "terminal-amber",
  type: "dark",
  colors: {
    "editor.background": "#1b140c",
    "editor.foreground": "#e8d9c3",
  },
  tokenColors: [
    {
      scope: ["keyword", "storage", "keyword.control"],
      settings: { foreground: "#ffaa3c" },
    },
    {
      scope: ["entity.name.function", "support.function", "entity.name.tag"],
      settings: { foreground: "#ffd18a" },
    },
    {
      scope: [
        "string",
        "constant.numeric",
        "constant.language",
        "constant.character",
      ],
      settings: { foreground: "#e07c14" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#8a7a63", fontStyle: "italic" },
    },
    {
      scope: ["variable", "support.variable"],
      settings: { foreground: "#e8d9c3" },
    },
  ],
};
