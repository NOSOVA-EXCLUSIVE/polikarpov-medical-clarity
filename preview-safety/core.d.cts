export type PreviewResourcePins = Readonly<{
  ready: boolean;
  branch: string;
  vercelProjectId: string;
  neonProjectId: string;
  neonBranchId: string;
  databaseName: string;
  databaseRole: string;
  databaseHostnames: readonly string[];
  blobStoreId: string;
  blobHostname: string;
  blobTokenSha256: string | null;
}>;
export type PreviewIsolationContext = Readonly<{
  appUrl: string;
  pins: PreviewResourcePins;
}>;
export function isPreviewIsolationRequired(raw?: Record<string, string | undefined>): boolean;
export function assertPreviewIsolation(
  raw?: Record<string, string | undefined>, pins?: PreviewResourcePins
): PreviewIsolationContext | null;
export function assertPreviewDatabaseUrl(value: string): void;
export function assertPreviewBlobToken(value: string): void;
export function assertPreviewStorageKey(value: string): void;
export function assertPreviewBlobUrl(value: string, expectedKey: string): void;
export function assertPreviewBlobSignedUrl(value: string, expected: {
  key: string;
  operation: "get" | "put";
  signedToken: { delegationToken: string; clientSigningToken: string };
  validUntil: number;
  contentType?: string;
  maximumSizeInBytes?: number;
}): void;
export function assertPreviewAllowedOperation(operation: string): void;
export function getPreviewAppUrl(): string | null;
export function isSyntheticEmail(value: unknown): boolean;
