import config from "@haccp/eslint-config/node";

export default [
  ...config,
  { ignores: ["playwright-report/**", "test-results/**", ".auth/**"] },
];
