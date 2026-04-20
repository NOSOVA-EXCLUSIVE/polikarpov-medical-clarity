export type Nullable<T> = T | null;

export type OpaqueTokenPayload = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};
