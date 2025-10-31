const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        __dirname: "readonly",
        console: "readonly",
        module: "readonly",
        require: "readonly"
      }
    },
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
