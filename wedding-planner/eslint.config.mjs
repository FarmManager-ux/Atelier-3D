import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tools/**"] },
  {
    // Regras do React Compiler que dão falsos positivos com react-hook-form (watch),
    // dnd-kit (refs por callback) e com o reset de formulários em diálogos.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/refs": "off",
      // Pré-visualizações com URLs assinados (não otimizáveis) e recarga completa após autenticação.
      "@next/next/no-img-element": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
];
export default config;
