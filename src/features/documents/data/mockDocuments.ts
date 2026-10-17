/* ==========================================================================
   TYPES
   ========================================================================== */

export type EntityType = 'rider' | 'driver'

export type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'missing'

export type DocumentType =
  // Drivers
  | 'drivers_license'
  | 'vehicle_registration'
  | 'vehicle_insurance'
  | 'road_worthiness'
  | 'proof_of_ownership'
  | 'lasdri'
  | 'vehicle_photo'
  | 'profile_photo'
  // Riders
  | 'nin_slip'
  | 'government_id'
  | 'proof_of_address'
  | 'selfie_verification'

export type KYCStatus = 'not_started' | 'in_review' | 'verified' | 'rejected' | 'expired'

export type Document = {
  id: string
  entityType: EntityType
  entityId: string
  entityName: string
  type: DocumentType
  documentNumber: string | null
  fileUrl: string
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf'
  sizeBytes: number
  status: DocumentStatus
  submittedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  rejectionReason: string | null
  expiresAt: string | null
  notes: string | null
}

export type EntityKYC = {
  entityType: EntityType
  entityId: string
  entityName: string
  kycStatus: KYCStatus
  documents: Document[]
  requiredTypes: DocumentType[]
  missingTypes: DocumentType[]
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  expiredCount: number
  progressPct: number
  lastSubmittedAt: string | null
  firstApprovedAt: string | null
}

/* ==========================================================================
   METADATA
   ========================================================================== */

export const ALL_DOCUMENT_STATUSES: DocumentStatus[] = [
  'pending', 'approved', 'rejected', 'expired', 'missing',
]

export const DOCUMENT_STATUS_META: Record<
  DocumentStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; color: string }
> = {
  pending:  { label: 'Pending review', tone: 'warning', color: '#f59e0b' },
  approved: { label: 'Approved',       tone: 'success', color: '#10b981' },
  rejected: { label: 'Rejected',       tone: 'danger',  color: '#ef4444' },
  expired:  { label: 'Expired',        tone: 'danger',  color: '#b91c1c' },
  missing:  { label: 'Not submitted',  tone: 'neutral', color: '#64748b' },
}

export const DOCUMENT_TYPE_META: Record<
  DocumentType,
  {
    label: string
    shortLabel: string
    requiredFor: EntityType[]
    hasExpiry: boolean
    description: string
  }
> = {
  drivers_license: {
    label: "Driver's License",
    shortLabel: 'License',
    requiredFor: ['driver'],
    hasExpiry: true,
    description: 'Valid Nigerian driver\'s license',
  },
  vehicle_registration: {
    label: 'Vehicle Registration',
    shortLabel: 'Reg',
    requiredFor: ['driver'],
    hasExpiry: true,
    description: 'Current vehicle registration certificate',
  },
  vehicle_insurance: {
    label: 'Vehicle Insurance',
    shortLabel: 'Insurance',
    requiredFor: ['driver'],
    hasExpiry: true,
    description: 'Third-party motor insurance',
  },
  road_worthiness: {
    label: 'Road Worthiness',
    shortLabel: 'Road worthy',
    requiredFor: ['driver'],
    hasExpiry: true,
    description: 'Vehicle inspection certificate',
  },
  proof_of_ownership: {
    label: 'Proof of Ownership',
    shortLabel: 'Ownership',
    requiredFor: ['driver'],
    hasExpiry: false,
    description: 'Vehicle title or purchase receipt',
  },
  lasdri: {
    label: 'LASDRI Card',
    shortLabel: 'LASDRI',
    requiredFor: ['driver'],
    hasExpiry: true,
    description: 'Lagos State Drivers Institute certification',
  },
  vehicle_photo: {
    label: 'Vehicle Photo',
    shortLabel: 'Vehicle photo',
    requiredFor: ['driver'],
    hasExpiry: false,
    description: 'Exterior photo showing plate number clearly',
  },
  profile_photo: {
    label: 'Profile Photo',
    shortLabel: 'Profile',
    requiredFor: ['driver', 'rider'],
    hasExpiry: false,
    description: 'Recent clear headshot',
  },
  nin_slip: {
    label: 'NIN Slip',
    shortLabel: 'NIN',
    requiredFor: ['rider', 'driver'],
    hasExpiry: false,
    description: 'National Identity Number slip',
  },
  government_id: {
    label: 'Government ID',
    shortLabel: 'Govt ID',
    requiredFor: ['rider'],
    hasExpiry: true,
    description: 'Passport, voter\'s card, or driver\'s license',
  },
  proof_of_address: {
    label: 'Proof of Address',
    shortLabel: 'Address',
    requiredFor: ['rider'],
    hasExpiry: true,
    description: 'Utility bill or bank statement (max 3 months old)',
  },
  selfie_verification: {
    label: 'Selfie Verification',
    shortLabel: 'Selfie',
    requiredFor: ['rider'],
    hasExpiry: false,
    description: 'Live selfie matching government ID',
  },
}

export const REQUIRED_DOCS: Record<EntityType, DocumentType[]> = {
  driver: [
    'drivers_license',
    'vehicle_registration',
    'vehicle_insurance',
    'road_worthiness',
    'profile_photo',
    'nin_slip',
  ],
  rider: ['nin_slip', 'government_id', 'selfie_verification'],
}

export const REJECTION_REASONS = [
  'Blurry or unreadable',
  'Expired document',
  'Name mismatch',
  'Photo does not match ID',
  'Wrong document type',
  'Cropped / incomplete',
  'Forged or altered',
  'Document number unreadable',
]

export const EXPIRY_WARNING_DAYS = 30

/* ==========================================================================
   MOCK DATA
   ========================================================================== */

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString()
const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString()

const INITIAL: Document[] = [
  // ---- Rider: r1 Seyi Ariyo — fully verified
  { id: 'doc_r1_1', entityType: 'rider', entityId: 'r1', entityName: 'Seyi Ariyo', type: 'nin_slip', documentNumber: '12345678901', fileUrl: '/mock/nin_r1.pdf', mimeType: 'application/pdf', sizeBytes: 184320, status: 'approved', submittedAt: daysAgo(45), reviewedAt: daysAgo(44), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_r1_2', entityType: 'rider', entityId: 'r1', entityName: 'Seyi Ariyo', type: 'government_id', documentNumber: 'A1234567', fileUrl: '/mock/govid_r1.jpg', mimeType: 'image/jpeg', sizeBytes: 524288, status: 'approved', submittedAt: daysAgo(45), reviewedAt: daysAgo(44), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: daysFromNow(720), notes: null },
  { id: 'doc_r1_3', entityType: 'rider', entityId: 'r1', entityName: 'Seyi Ariyo', type: 'selfie_verification', documentNumber: null, fileUrl: '/mock/selfie_r1.jpg', mimeType: 'image/jpeg', sizeBytes: 245760, status: 'approved', submittedAt: daysAgo(45), reviewedAt: daysAgo(44), reviewedBy: 'Oladayo Ayomide', rejectionReason: null, expiresAt: null, notes: null },

  // ---- Rider: r3 Bola Ariyo — NIN pending
  { id: 'doc_r3_1', entityType: 'rider', entityId: 'r3', entityName: 'Bola Ariyo', type: 'nin_slip', documentNumber: null, fileUrl: '/mock/nin_r3.pdf', mimeType: 'application/pdf', sizeBytes: 210432, status: 'pending', submittedAt: daysAgo(2), reviewedAt: null, reviewedBy: null, rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_r3_2', entityType: 'rider', entityId: 'r3', entityName: 'Bola Ariyo', type: 'government_id', documentNumber: null, fileUrl: '/mock/govid_r3.jpg', mimeType: 'image/jpeg', sizeBytes: 480000, status: 'pending', submittedAt: daysAgo(2), reviewedAt: null, reviewedBy: null, rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_r3_3', entityType: 'rider', entityId: 'r3', entityName: 'Bola Ariyo', type: 'selfie_verification', documentNumber: null, fileUrl: '/mock/selfie_r3.jpg', mimeType: 'image/jpeg', sizeBytes: 220000, status: 'pending', submittedAt: daysAgo(2), reviewedAt: null, reviewedBy: null, rejectionReason: null, expiresAt: null, notes: null },

  // ---- Rider: r5 Yusuf — rejected docs (suspended)
  { id: 'doc_r5_1', entityType: 'rider', entityId: 'r5', entityName: 'Yusuf Adeleke', type: 'nin_slip', documentNumber: '45678901234', fileUrl: '/mock/nin_r5.pdf', mimeType: 'application/pdf', sizeBytes: 95000, status: 'approved', submittedAt: daysAgo(60), reviewedAt: daysAgo(59), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_r5_2', entityType: 'rider', entityId: 'r5', entityName: 'Yusuf Adeleke', type: 'government_id', documentNumber: null, fileUrl: '/mock/govid_r5.jpg', mimeType: 'image/jpeg', sizeBytes: 89000, status: 'rejected', submittedAt: daysAgo(58), reviewedAt: daysAgo(57), reviewedBy: 'Oladayo Ayomide', rejectionReason: 'Blurry or unreadable', expiresAt: null, notes: 'Rider notified via SMS to re-upload' },

  // ---- Driver: d2 Musa Ibrahim — fully verified
  { id: 'doc_d2_1', entityType: 'driver', entityId: 'd2', entityName: 'Musa Ibrahim', type: 'drivers_license', documentNumber: 'DLN-2019-0012345', fileUrl: '/mock/dl_d2.jpg', mimeType: 'image/jpeg', sizeBytes: 620000, status: 'approved', submittedAt: daysAgo(90), reviewedAt: daysAgo(89), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: daysFromNow(180), notes: null },
  { id: 'doc_d2_2', entityType: 'driver', entityId: 'd2', entityName: 'Musa Ibrahim', type: 'vehicle_registration', documentNumber: 'VREG-2024-3321', fileUrl: '/mock/vreg_d2.pdf', mimeType: 'application/pdf', sizeBytes: 310000, status: 'approved', submittedAt: daysAgo(90), reviewedAt: daysAgo(89), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: daysFromNow(365), notes: null },
  { id: 'doc_d2_3', entityType: 'driver', entityId: 'd2', entityName: 'Musa Ibrahim', type: 'vehicle_insurance', documentNumber: 'INS-2026-8899', fileUrl: '/mock/ins_d2.pdf', mimeType: 'application/pdf', sizeBytes: 280000, status: 'approved', submittedAt: daysAgo(90), reviewedAt: daysAgo(89), reviewedBy: 'Oladayo Ayomide', rejectionReason: null, expiresAt: daysFromNow(15), notes: 'Expires soon' },
  { id: 'doc_d2_4', entityType: 'driver', entityId: 'd2', entityName: 'Musa Ibrahim', type: 'road_worthiness', documentNumber: 'RW-2026-112', fileUrl: '/mock/rw_d2.pdf', mimeType: 'application/pdf', sizeBytes: 220000, status: 'approved', submittedAt: daysAgo(90), reviewedAt: daysAgo(89), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: daysFromNow(280), notes: null },
  { id: 'doc_d2_5', entityType: 'driver', entityId: 'd2', entityName: 'Musa Ibrahim', type: 'profile_photo', documentNumber: null, fileUrl: '/mock/photo_d2.jpg', mimeType: 'image/jpeg', sizeBytes: 180000, status: 'approved', submittedAt: daysAgo(90), reviewedAt: daysAgo(89), reviewedBy: 'Oladayo Ayomide', rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_d2_6', entityType: 'driver', entityId: 'd2', entityName: 'Musa Ibrahim', type: 'nin_slip', documentNumber: '23456789012', fileUrl: '/mock/nin_d2.pdf', mimeType: 'application/pdf', sizeBytes: 195000, status: 'approved', submittedAt: daysAgo(90), reviewedAt: daysAgo(89), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: null, notes: null },

  // ---- Driver: d5 Segun Oladipo — pending + rejected
  { id: 'doc_d5_1', entityType: 'driver', entityId: 'd5', entityName: 'Segun Oladipo', type: 'drivers_license', documentNumber: 'DLN-2020-0099887', fileUrl: '/mock/dl_d5.jpg', mimeType: 'image/jpeg', sizeBytes: 540000, status: 'pending', submittedAt: daysAgo(1), reviewedAt: null, reviewedBy: null, rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_d5_2', entityType: 'driver', entityId: 'd5', entityName: 'Segun Oladipo', type: 'vehicle_registration', documentNumber: null, fileUrl: '/mock/vreg_d5.jpg', mimeType: 'image/jpeg', sizeBytes: 380000, status: 'rejected', submittedAt: daysAgo(5), reviewedAt: daysAgo(4), reviewedBy: 'Damilare Opeyemi', rejectionReason: 'Expired document', expiresAt: null, notes: 'Registration expired 2 months ago' },
  { id: 'doc_d5_3', entityType: 'driver', entityId: 'd5', entityName: 'Segun Oladipo', type: 'vehicle_insurance', documentNumber: null, fileUrl: '/mock/ins_d5.pdf', mimeType: 'application/pdf', sizeBytes: 310000, status: 'pending', submittedAt: daysAgo(1), reviewedAt: null, reviewedBy: null, rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_d5_4', entityType: 'driver', entityId: 'd5', entityName: 'Segun Oladipo', type: 'road_worthiness', documentNumber: null, fileUrl: '/mock/rw_d5.pdf', mimeType: 'application/pdf', sizeBytes: 240000, status: 'expired', submittedAt: daysAgo(400), reviewedAt: daysAgo(399), reviewedBy: 'Oladayo Ayomide', rejectionReason: null, expiresAt: daysAgo(10), notes: null },
  { id: 'doc_d5_5', entityType: 'driver', entityId: 'd5', entityName: 'Segun Oladipo', type: 'profile_photo', documentNumber: null, fileUrl: '/mock/photo_d5.jpg', mimeType: 'image/jpeg', sizeBytes: 200000, status: 'approved', submittedAt: daysAgo(120), reviewedAt: daysAgo(119), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: null, notes: null },

  // ---- Driver: d6 Emeka Okafor — pending insurance
  { id: 'doc_d6_1', entityType: 'driver', entityId: 'd6', entityName: 'Emeka Okafor', type: 'drivers_license', documentNumber: 'DLN-2018-0077554', fileUrl: '/mock/dl_d6.jpg', mimeType: 'image/jpeg', sizeBytes: 510000, status: 'approved', submittedAt: daysAgo(200), reviewedAt: daysAgo(199), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: daysFromNow(500), notes: null },
  { id: 'doc_d6_2', entityType: 'driver', entityId: 'd6', entityName: 'Emeka Okafor', type: 'vehicle_registration', documentNumber: 'VREG-2025-1100', fileUrl: '/mock/vreg_d6.pdf', mimeType: 'application/pdf', sizeBytes: 290000, status: 'approved', submittedAt: daysAgo(200), reviewedAt: daysAgo(199), reviewedBy: 'Oladayo Ayomide', rejectionReason: null, expiresAt: daysFromNow(300), notes: null },
  { id: 'doc_d6_3', entityType: 'driver', entityId: 'd6', entityName: 'Emeka Okafor', type: 'vehicle_insurance', documentNumber: null, fileUrl: '/mock/ins_d6.pdf', mimeType: 'application/pdf', sizeBytes: 275000, status: 'pending', submittedAt: daysAgo(0), reviewedAt: null, reviewedBy: null, rejectionReason: null, expiresAt: null, notes: 'Renewal — awaiting review' },
  { id: 'doc_d6_4', entityType: 'driver', entityId: 'd6', entityName: 'Emeka Okafor', type: 'road_worthiness', documentNumber: 'RW-2025-998', fileUrl: '/mock/rw_d6.pdf', mimeType: 'application/pdf', sizeBytes: 230000, status: 'approved', submittedAt: daysAgo(200), reviewedAt: daysAgo(199), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: daysFromNow(220), notes: null },
  { id: 'doc_d6_5', entityType: 'driver', entityId: 'd6', entityName: 'Emeka Okafor', type: 'profile_photo', documentNumber: null, fileUrl: '/mock/photo_d6.jpg', mimeType: 'image/jpeg', sizeBytes: 170000, status: 'approved', submittedAt: daysAgo(200), reviewedAt: daysAgo(199), reviewedBy: 'Oladayo Ayomide', rejectionReason: null, expiresAt: null, notes: null },
  { id: 'doc_d6_6', entityType: 'driver', entityId: 'd6', entityName: 'Emeka Okafor', type: 'nin_slip', documentNumber: '34567890123', fileUrl: '/mock/nin_d6.pdf', mimeType: 'application/pdf', sizeBytes: 188000, status: 'approved', submittedAt: daysAgo(200), reviewedAt: daysAgo(199), reviewedBy: 'Damilare Opeyemi', rejectionReason: null, expiresAt: null, notes: null },
]

/* ==========================================================================
   STORE
   ========================================================================== */

let store: Document[] = INITIAL.map((d) => ({ ...d }))

export function resetDocumentStore(): void {
  store = INITIAL.map((d) => ({ ...d }))
  _cache.clear()
}

export function getDocumentSnapshot(): Document[] {
  return store.map((d) => ({ ...d }))
}

/* ==========================================================================
   GUARDS & VALIDATION
   ========================================================================== */

export function isDocumentStatus(value: unknown): value is DocumentStatus {
  return typeof value === 'string' && ALL_DOCUMENT_STATUSES.includes(value as DocumentStatus)
}

export function validateDocument(doc: Partial<Document>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!doc.id) errors.push('id is required')
  if (!doc.entityType) errors.push('entityType is required')
  if (!doc.entityId) errors.push('entityId is required')
  if (!doc.entityName) errors.push('entityName is required')
  if (!doc.type) errors.push('type is required')
  if (!doc.fileUrl) errors.push('fileUrl is required')
  if (!isDocumentStatus(doc.status)) errors.push('status is invalid')
  if (!doc.submittedAt) errors.push('submittedAt is required')
  if (doc.status === 'rejected' && !doc.rejectionReason) {
    errors.push('rejectionReason is required when rejected')
  }
  return { valid: errors.length === 0, errors }
}

/* ==========================================================================
   FORMATTERS
   ========================================================================== */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatRelativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = Math.max(0, now - t)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((Date.parse(iso) - Date.now()) / (24 * 60 * 60 * 1000))
}

export function isExpiringSoon(doc: Document, thresholdDays = EXPIRY_WARNING_DAYS): boolean {
  if (!doc.expiresAt) return false
  const days = daysUntil(doc.expiresAt)
  return days != null && days >= 0 && days <= thresholdDays
}

export function isExpired(doc: Document): boolean {
  if (!doc.expiresAt) return false
  return Date.parse(doc.expiresAt) < Date.now()
}

/* ==========================================================================
   FILTERING & SORTING
   ========================================================================== */

export type DocumentFilters = {
  entityType?: EntityType | 'all'
  statuses?: DocumentStatus[]
  types?: DocumentType[]
  search?: string
  onlyExpiring?: boolean
  onlyExpired?: boolean
  submittedAfter?: string | null
}

export function filterDocuments(docs: Document[], filters: DocumentFilters): Document[] {
  const statusSet = filters.statuses?.length ? new Set(filters.statuses) : null
  const typeSet = filters.types?.length ? new Set(filters.types) : null
  const q = filters.search?.trim().toLowerCase() ?? ''

  return docs.filter((d) => {
    if (filters.entityType && filters.entityType !== 'all' && d.entityType !== filters.entityType) return false
    if (statusSet && !statusSet.has(d.status)) return false
    if (typeSet && !typeSet.has(d.type)) return false
    if (filters.onlyExpiring && !isExpiringSoon(d)) return false
    if (filters.onlyExpired && !isExpired(d)) return false
    if (filters.submittedAfter && d.submittedAt < filters.submittedAfter) return false
    if (q) {
      const haystack = [
        d.entityName, d.entityId, d.type,
        d.documentNumber ?? '', d.reviewedBy ?? '',
        d.rejectionReason ?? '',
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export type DocumentSortField = 'submittedAt' | 'reviewedAt' | 'entityName' | 'type' | 'status'

export function sortDocuments(
  docs: Document[],
  field: DocumentSortField = 'submittedAt',
  dir: 'asc' | 'desc' = 'desc',
): Document[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...docs].sort((a, b) => {
    const av = a[field] ?? ''
    const bv = b[field] ?? ''
    return String(av).localeCompare(String(bv)) * mul
  })
}

/* ==========================================================================
   GROUPING — per-entity KYC view
   ========================================================================== */

export function groupByEntity(docs: Document[]): EntityKYC[] {
  const map = new Map<string, EntityKYC>()

  for (const d of docs) {
    const key = `${d.entityType}:${d.entityId}`
    let row = map.get(key)
    if (!row) {
      const requiredTypes = REQUIRED_DOCS[d.entityType]
      row = {
        entityType: d.entityType,
        entityId: d.entityId,
        entityName: d.entityName,
        kycStatus: 'not_started',
        documents: [],
        requiredTypes,
        missingTypes: [],
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        expiredCount: 0,
        progressPct: 0,
        lastSubmittedAt: null,
        firstApprovedAt: null,
      }
      map.set(key, row)
    }
    row.documents.push(d)
    if (d.status === 'pending') row.pendingCount += 1
    else if (d.status === 'approved') row.approvedCount += 1
    else if (d.status === 'rejected') row.rejectedCount += 1
    else if (d.status === 'expired') row.expiredCount += 1
    if (!row.lastSubmittedAt || d.submittedAt > row.lastSubmittedAt) {
      row.lastSubmittedAt = d.submittedAt
    }
    if (d.status === 'approved' && d.reviewedAt) {
      if (!row.firstApprovedAt || d.reviewedAt < row.firstApprovedAt) {
        row.firstApprovedAt = d.reviewedAt
      }
    }
  }

  for (const row of map.values()) {
    row.documents.sort((a, b) => {
      const aOrder = row.requiredTypes.indexOf(a.type)
      const bOrder = row.requiredTypes.indexOf(b.type)
      if (aOrder !== bOrder) return aOrder - bOrder
      return b.submittedAt.localeCompare(a.submittedAt)
    })

    const approvedTypes = new Set(
      row.documents.filter((d) => d.status === 'approved').map((d) => d.type),
    )
    row.missingTypes = row.requiredTypes.filter((t) => !approvedTypes.has(t))
    const total = row.requiredTypes.length || 1
    row.progressPct = Math.round((approvedTypes.size / total) * 100)

    if (row.expiredCount > 0) row.kycStatus = 'expired'
    else if (row.rejectedCount > 0) row.kycStatus = 'rejected'
    else if (row.missingTypes.length === 0) row.kycStatus = 'verified'
    else if (row.pendingCount > 0) row.kycStatus = 'in_review'
    else row.kycStatus = 'not_started'
  }

  return [...map.values()].sort((a, b) => {
    const aPending = a.pendingCount > 0 ? 1 : 0
    const bPending = b.pendingCount > 0 ? 1 : 0
    if (aPending !== bPending) return bPending - aPending
    return (b.lastSubmittedAt ?? '').localeCompare(a.lastSubmittedAt ?? '')
  })
}

export function getEntityKYC(entityType: EntityType, entityId: string): EntityKYC | null {
  const filtered = store.filter((d) => d.entityType === entityType && d.entityId === entityId)
  const grouped = groupByEntity(filtered)
  return grouped[0] ?? null
}

/* ==========================================================================
   STATS
   ========================================================================== */

export type DocumentStats = {
  total: number
  pending: number
  approved: number
  rejected: number
  expired: number
  expiringSoon: number
  pendingRiders: number
  pendingDrivers: number
  fullyVerified: number
  avgReviewHours: number
}

export function computeDocumentStats(docs: Document[]): DocumentStats {
  const pending = docs.filter((d) => d.status === 'pending')
  const approved = docs.filter((d) => d.status === 'approved')
  const rejected = docs.filter((d) => d.status === 'rejected')
  const expired = docs.filter((d) => d.status === 'expired' || isExpired(d))
  const expiringSoon = docs.filter((d) => isExpiringSoon(d))

  const pendingRiders = new Set(
    pending.filter((d) => d.entityType === 'rider').map((d) => d.entityId),
  ).size
  const pendingDrivers = new Set(
    pending.filter((d) => d.entityType === 'driver').map((d) => d.entityId),
  ).size

  const entities = groupByEntity(docs)
  const fullyVerified = entities.filter((e) => e.kycStatus === 'verified').length

  const reviewedDocs = docs.filter((d) => d.status !== 'pending' && d.reviewedAt)
  const reviewHours = reviewedDocs.map(
    (d) => (Date.parse(d.reviewedAt!) - Date.parse(d.submittedAt)) / (60 * 60 * 1000),
  )
  const avgReviewHours =
    reviewHours.length > 0
      ? Math.round((reviewHours.reduce((s, h) => s + h, 0) / reviewHours.length) * 10) / 10
      : 0

  return {
    total: docs.length,
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
    expired: expired.length,
    expiringSoon: expiringSoon.length,
    pendingRiders,
    pendingDrivers,
    fullyVerified,
    avgReviewHours,
  }
}

/* ==========================================================================
   FETCHERS
   ========================================================================== */

type CacheSlot<T> = { at: number; data: T }
const _cache = new Map<string, CacheSlot<unknown>>()

export async function fetchDocuments(options: {
  force?: boolean
  ttlMs?: number
} = {}): Promise<Document[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'documents:list'
  const hit = _cache.get(key) as CacheSlot<Document[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) {
    return hit.data.map((d) => ({ ...d }))
  }
  await new Promise((r) => setTimeout(r, 500))
  const data = store.map((d) => ({ ...d }))
  _cache.set(key, { at: Date.now(), data })
  return data
}

/* ==========================================================================
   MUTATIONS — approve, reject, bulk
   ========================================================================== */

function invalidateCache(): void {
  _cache.delete('documents:list')
}

export async function approveDocument(
  id: string,
  adminName: string,
  note?: string,
): Promise<Document> {
  await new Promise((r) => setTimeout(r, 400))
  let updated: Document | null = null
  store = store.map((d) => {
    if (d.id !== id) return d
    updated = {
      ...d,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminName,
      rejectionReason: null,
      notes: note ?? d.notes,
    }
    return updated
  })
  if (!updated) throw new Error('Document not found')
  invalidateCache()
  return updated
}

export async function rejectDocument(
  id: string,
  adminName: string,
  reason: string,
  note?: string,
): Promise<Document> {
  if (!reason.trim()) throw new Error('Rejection reason is required')
  await new Promise((r) => setTimeout(r, 400))
  let updated: Document | null = null
  store = store.map((d) => {
    if (d.id !== id) return d
    updated = {
      ...d,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminName,
      rejectionReason: reason,
      notes: note ?? d.notes,
    }
    return updated
  })
  if (!updated) throw new Error('Document not found')
  invalidateCache()
  return updated
}

export type BulkResult = {
  succeeded: string[]
  failed: { id: string; error: string }[]
}

export async function bulkApprove(
  ids: string[],
  adminName: string,
): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] }
  for (const id of ids) {
    try {
      await approveDocument(id, adminName)
      result.succeeded.push(id)
    } catch (e) {
      result.failed.push({ id, error: e instanceof Error ? e.message : 'Unknown' })
    }
  }
  return result
}

export async function bulkReject(
  ids: string[],
  adminName: string,
  reason: string,
): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] }
  for (const id of ids) {
    try {
      await rejectDocument(id, adminName, reason)
      result.succeeded.push(id)
    } catch (e) {
      result.failed.push({ id, error: e instanceof Error ? e.message : 'Unknown' })
    }
  }
  return result
}

export async function markExpired(): Promise<number> {
  let count = 0
  store = store.map((d) => {
    if (d.status === 'approved' && isExpired(d)) {
      count += 1
      return { ...d, status: 'expired' }
    }
    return d
  })
  if (count > 0) invalidateCache()
  return count
}

/* ==========================================================================
   AUDIT HOOK — call from your mutation wrapper
   ========================================================================== */

export type DocumentAuditAction = 'approve' | 'reject' | 'expire' | 'resubmit'

export function buildAuditPayload(
  doc: Document,
  action: DocumentAuditAction,
  adminName: string,
): {
  module: 'drivers' | 'riders'
  action: 'approve' | 'reject' | 'update'
  targetType: 'document'
  targetId: string
  targetName: string
  notes: string
} {
  const statusMap: Record<DocumentAuditAction, 'approve' | 'reject' | 'update'> = {
    approve: 'approve',
    reject: 'reject',
    expire: 'update',
    resubmit: 'update',
  }
  return {
    module: doc.entityType === 'driver' ? 'drivers' : 'riders',
    action: statusMap[action],
    targetType: 'document',
    targetId: doc.id,
    targetName: `${doc.entityName} · ${DOCUMENT_TYPE_META[doc.type].label}`,
    notes: `${action} by ${adminName}${doc.rejectionReason ? ` — ${doc.rejectionReason}` : ''}`,
  }
}