export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export interface Diagnostic {
  severity: 'info' | 'warning' | 'error';
  message: string;
}

interface DiscoveryBase {
  rootPath: string;
  diagnostics: Diagnostic[];
}

export type ProjectDiscovery =
  | (DiscoveryBase & { kind: 'invalid' | 'not-astro' })
  | (DiscoveryBase & {
      kind: 'astro';
      name: string;
      astroVersion: string;
      packageManager: PackageManager | null;
      packageManagerSource: 'declaration' | 'lockfile' | 'fallback' | 'unresolved';
      devScript: string | null;
    });
