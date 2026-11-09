export type ProjectSettings = {
  name: string;
  serviceUrl: string;
  allowChanges: boolean;
  allowDeployment: boolean;
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  name: "My first service",
  serviceUrl: "",
  allowChanges: false,
  allowDeployment: false,
};

export const DEMO_PROJECT = {
  repository: "https://github.com/ongleam/compiled-ex-project",
  branch: "main",
} as const;
