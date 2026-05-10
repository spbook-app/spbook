export type AppEnvironment = "local" | "development" | "production";

const labels: Record<AppEnvironment, string> = {
  local: "Local",
  development: "Development",
  production: "Production"
};

function isAppEnvironment(value: string): value is AppEnvironment {
  return value === "local" || value === "development" || value === "production";
}

export function getAppEnvironment(value = import.meta.env.VITE_APP_ENV): AppEnvironment {
  return value && isAppEnvironment(value) ? value : "local";
}

export function getAppEnvironmentLabel(environment = getAppEnvironment()) {
  return labels[environment];
}

export function shouldShowEnvironmentBadge(environment = getAppEnvironment()) {
  return environment !== "production";
}
