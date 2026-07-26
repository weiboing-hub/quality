export type Profile = "strict" | "balanced" | "aggressive";
export type RecordStatus = "all" | "changed" | "review" | "unchanged";

export interface QualityValues {
  completeness: number;
  validity: number;
  consistency: number;
  uniqueness: number;
  score: number;
}

export interface Dashboard {
  record_count: number;
  changed_records: number;
  field_changes: number;
  review_count: number;
  quality_gain: number;
  quality: {
    before: QualityValues;
    after: QualityValues;
  };
  rule_hits: Record<string, number>;
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  description: string;
  risk: string;
  enabled: boolean;
  hits: number;
}

export interface Change {
  field: string;
  before: string;
  after: string;
  rule_id: string;
  rule_name: string;
  risk: "low" | "medium" | "high";
}

export interface ReviewDecision {
  record_id: string;
  decision: "approved" | "rejected" | "edited";
  note: string;
  operator: string;
  decided_at: string;
}

export interface ComparisonRecord {
  id: string;
  source: string;
  before: Record<string, string>;
  after: Record<string, string>;
  changes: Change[];
  issues: string[];
  confidence: number;
  needs_review: boolean;
  status: Exclude<RecordStatus, "all">;
  review_decision?: ReviewDecision;
}

