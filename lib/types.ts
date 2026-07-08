// Shared client-facing shapes (dates serialize to numbers/strings over JSON).

export type SourceType = "meeting" | "slack" | "email" | "chat";

export type DecisionRow = {
  id: number;
  text: string;
  owner: string | null;
  deadline: string | null;
  status: string;
  createdAt: string | number;
  sourceMeeting: number;
  sourceType: SourceType;
  sourceLabel: string | null;
  sourceSnippet: string | null;
  category: string | null;
};

export type QuestionRow = {
  id: number;
  text: string;
  owner: string | null;
  createdAt: string | number;
  sourceType: SourceType;
  sourceLabel: string | null;
};

export type DecisionsResponse = {
  decisions: DecisionRow[];
  openQuestions: QuestionRow[];
};

export type ConflictDecisionRow = {
  id: number;
  text: string;
  owner: string | null;
  deadline: string | null;
  status: string;
  createdAt: string | number;
  sourceMeeting: number;
  sourceType: SourceType;
  sourceLabel: string | null;
  category: string | null;
};

export type ConflictsResponse = {
  stale: ConflictDecisionRow[];
  contradictions: {
    reason: string;
    a: ConflictDecisionRow | null;
    b: ConflictDecisionRow | null;
  }[];
  contradictionError: string | null;
};
