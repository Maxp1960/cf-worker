export interface Env {
  // R2 bucket binding for country flags
  FLAGS_BUCKET: R2Bucket;

  // Optional local dev mock variables
  DEV_MOCK_EMAIL?: string;
  DEV_MOCK_COUNTRY?: string;
}

export interface UserIdentity {
  email: string;
  timestamp: string;
  country: string;
  source: 'cloudflare-access' | 'local-dev' | 'cf-edge';
}
