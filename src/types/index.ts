export type RoleSlug =
  | 'admin'
  | 'staff'
  | 'department_head'
  | 'business_head'
  | 'it_checker_first'
  | 'it_checker_second'
  | 'finance_reviewer'
  | 'hr_reviewer'
  | 'ceo'
  | 'exco_member';

export type MemoStatusSlug =
  | 'draft'
  | 'submitted'
  | 'pending_department_head'
  | 'pending_business_head'
  | 'pending_it_review'
  | 'pending_it_checker_first'
  | 'pending_it_checker_second'
  | 'pending_finance'
  | 'pending_hr'
  | 'pending_ceo'
  | 'pending_exco'
  | 'returned'
  | 'rejected'
  | 'approved'
  | 'withdrawn'
  | 'archived'
  | 'deleted';

export type MemoTypeSlug =
  | 'payment_request'
  | 'procurement_request'
  | 'hr_request'
  | 'leave_request'
  | 'it_request'
  | 'marketing_request'
  | 'finance_request'
  | 'general_internal';

export type ApprovalAction = 'approve' | 'return' | 'reject' | 'pending';

export type ImportanceLevel = 'normal' | 'high' | 'exco';

export interface User {
  id: string;
  email: string;
  full_name: string;
  title?: string;
  department_id?: string;
  role_id: string;
  role?: Role;
  department?: Department;
  signature_path?: string;
  signature_uploaded_at?: string;
  is_active: boolean;
  must_set_password?: boolean;
}

export interface Role {
  id: string;
  name: string;
  slug: RoleSlug;
  description?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface MemoType {
  id: string;
  name: string;
  slug: MemoTypeSlug;
  description?: string;
}

export interface MemoStatus {
  id: string;
  name: string;
  slug: MemoStatusSlug;
  sort_order: number;
}

export interface Memo {
  id: string;
  reference_number: string;
  memo_type_id: string;
  status_id: string;
  creator_id: string;
  department_id: string;
  workflow_id?: string;
  current_version: number;
  current_step_order: number;
  memo_from?: string;
  memo_thru?: string;
  memo_to?: string;
  memo_date?: string;
  subject?: string;
  background?: string;
  financial_implication?: string;
  justification?: string;
  recommendation?: string;
  requires_exco: boolean;
  requires_finance: boolean;
  importance_level: ImportanceLevel;
  withdrawal_reason?: string;
  rejection_reason?: string;
  submitted_at?: string;
  approved_at?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  memo_type?: MemoType;
  status?: MemoStatus;
  creator?: User;
  department?: Department;
  attachments?: MemoAttachment[];
  approvals?: Approval[];
  signature_records?: SignatureRecord[];
}

export interface MemoAttachment {
  id: string;
  memo_id: string;
  version_number: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: string;
  created_at: string;
}

export interface Approval {
  id: string;
  memo_id: string;
  step_order: number;
  approver_id: string;
  delegated_from_id?: string;
  action: ApprovalAction;
  comments?: string;
  signature_path?: string;
  signed_at?: string;
  is_parallel: boolean;
  approver?: User;
}

export interface ExcoApproval {
  id: string;
  memo_id: string;
  exco_member_id: string;
  approver_id: string;
  action: ApprovalAction;
  comments?: string;
  signed_at?: string;
  exco_member?: { position: string; user?: User };
}

export interface Comment {
  id: string;
  memo_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  visible_to_shared_only: boolean;
  created_at: string;
  user?: User;
}

export interface SignatureRecord {
  id: string;
  memo_id: string;
  approver_id: string;
  approver_name: string;
  approver_title?: string;
  signature_path: string;
  block_type: 'prepared' | 'checked' | 'reviewed' | 'approved';
  signed_at: string;
  delegated_from_id?: string;
  delegation_note?: string;
}

export interface Delegation {
  id: string;
  original_approver_id: string;
  delegated_to_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'active' | 'expired' | 'cancelled';
}

export interface BrandingSettings {
  id: string;
  company_name: string;
  company_short_name: string;
  company_address?: string;
  logo_path?: string;
  footer_text?: string;
  confidentiality_notice?: string;
  page_number_style?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  memo_id?: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  memo_id?: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at: string;
  user?: User;
}

export interface MemoVersion {
  id: string;
  memo_id: string;
  version_number: number;
  subject?: string;
  background?: string;
  change_reason?: string;
  created_at: string;
}

export interface CreateMemoInput {
  memo_type_id: string;
  memo_from?: string;
  memo_thru?: string;
  memo_to?: string;
  memo_date?: string;
  subject?: string;
  background?: string;
  financial_implication?: string;
  justification?: string;
  recommendation?: string;
  requires_finance?: boolean;
  importance_level?: ImportanceLevel;
}

export interface ApprovalInput {
  action: 'approve' | 'return' | 'reject';
  comments?: string;
}
