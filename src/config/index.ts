import { validateEnv, type EnvConfig } from "./env.js";

export const config: EnvConfig = validateEnv();

export { validateEnv, type EnvConfig };
