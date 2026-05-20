export const allowedActions = [
  "goto",
  "click_text",
  "click_selector",
  "fill_text",
  "press",
  "wait",
  "extract_results",
  "stop",
] as const;

export type AgentActionName = (typeof allowedActions)[number];

export interface AgentAction {
  action: AgentActionName;
  target?: string;
  selector?: string;
  url?: string;
  text?: string;
  key?: string;
  ms?: number;
  reason: string;
  confidence: number;
}

export interface ElementCandidate {
  tag: string;
  text: string;
  selector: string;
  role: string;
  visible: boolean;
  href?: string;
  placeholder?: string;
  name?: string;
  type?: string;
}

export interface GoalProgress {
  regionSelected: boolean;
  jobCategorySelected: boolean;
  careerSelected: boolean;
  resultListVisible: boolean;
  blockedOrCaptchaLikely: boolean;
}

export interface PageObservation {
  currentUrl: string;
  title: string;
  bodyText: string;
  screenshotPath: string;
  buttons: ElementCandidate[];
  links: ElementCandidate[];
  inputs: ElementCandidate[];
  candidateSelectors: string[];
  progress: GoalProgress;
}

export interface AgentHistoryItem {
  step: number;
  action: AgentAction;
  success: boolean;
  message: string;
}

export interface AgentLoopResult {
  success: boolean;
  reason: string;
  steps: number;
}
