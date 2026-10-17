export const BRAND = {
  name: 'HarkeyzRide',
  shortName: 'Harkeyz',
  tagline: 'CNG Powered Mobility',
  parentCompany: 'Harkeyz Holdings Ltd.',
  productLabel: 'Admin Console',
  emailDomain: 'harkeyzride.dev',
  referencePrefix: 'HR',        // was SR — appears in mocks like HR-CNG-0919-001
  webDomain: 'harkeyzride.app',
  version: 'v1.0.0',
} as const

export const DEMO_CREDENTIALS = {
  email: `admin@${BRAND.emailDomain}`,
  password: 'HarkeyzRide2026!',
} as const