// Shared client-facing shapes (dates serialize to numbers/strings over JSON).

export type DecisionRow = {
  id: number;
  text: string;
  owner: string | null;
  deadline: string | null;
  status: string;
  createdAt: string | number;
  sourceMeeting: number;
  meetingTitle: string | null;
};

export type QuestionRow = {
  id: number;
  text: string;
  owner: string | null;
  createdAt: string | number;
  meetingTitle: string | null;
};

export type DecisionsResponse = {
  decisions: DecisionRow[];
  openQuestions: QuestionRow[];
};

export type ConflictsResponse = {
  stale: {
    id: number;
    text: string;
    owner: string | null;
    deadline: string | null;
    status: string;
    createdAt: string | number;
    sourceMeeting: number;
  }[];
  contradictions: {
    reason: string;
    a: { id: number; text: string } | null;
    b: { id: number; text: string } | null;
  }[];
  contradictionError: string | null;
};
