export type UserRole = 'admin' | 'worker';
export type UserStatus = 'approved' | 'pending' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  category?: string;
  updatedAt: string;
}

export interface QuoteItem {
  materialId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ClientInfo {
  name: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
}

export type QuoteStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sent';

export interface Quote {
  id: string;
  quoteNumber: string;
  date: string;
  validityDays: number;
  status: QuoteStatus;
  client: ClientInfo;
  workDescription: string;
  items: QuoteItem[];
  laborCost: number;
  additionalCosts: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethods: string[];
  conditions: string;
  createdBy: string;
  approvedBy?: string;
}

export interface CompanyInfo {
  name: string;
  legalName: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
}
