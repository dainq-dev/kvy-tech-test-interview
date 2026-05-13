export interface Document {
  id: string;
  file_name: string;
  file_size_bytes: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'under_review' | 'failed';
  submitted_at: string;
  decided_at: string | null;
  decision_reason: string | null;
}

export interface DocumentDetail extends Document {
  history: Array<{
    action: string;
    from_status: string | null;
    to_status: string | null;
    created_at: string;
  }>;
}

export interface AdminDocument extends Document {
  seller_email: string;
  seller_name: string;
  reviewer_name: string | null;
}

export interface AdminDocumentDetail extends AdminDocument {
  file_url: string;
  current_reviewer_id: string | null;
  
  history: Array<{
    action: string;
    from_status: string | null;
    to_status: string | null;
    actor_name: string | null;
    actor_email: string | null;
    metadata: Record<string, string | number | boolean | null> | null;
    created_at: string;
  }>;
}
