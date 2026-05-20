import { AgentAction, allowedActions } from "./types.js";
import { isSaraminUrl, toAbsoluteUrl } from "../utils/url.js";
import { normalizeText } from "../utils/text.js";

const forbiddenIntentPattern =
  /(login|로그인|auth|인증|proxy|프록시|우회|bypass|solve_captcha|use_proxy|scrape_private_data|aggressive_refresh|infinite_loop|password|비밀번호)/i;

const captchaInteractionPattern = /(captcha|캡차|보안문자|자동입력)/i;

const riskySelectorPattern =
  /(password|passwd|token|secret|cookie|localStorage|sessionStorage|script|iframe|html|body|document|window)/i;

export const looksBlockedText = (text: string, url = "", title = ""): boolean => {
  const target = normalizeText(`${text} ${url} ${title}`).toLowerCase();
  const signals = [
    /captcha/,
    /access\s+denied/,
    /too\s+many\s+requests/,
    /request\s+blocked/,
    /unusual\s+traffic/,
    /403/,
    /429/,
    /보안문자/,
    /자동입력/,
    /비정상\s*접근/,
    /접근이\s*차단/,
    /서비스\s*이용이\s*제한/,
  ];

  return signals.some((pattern) => pattern.test(target));
};

export const isForbiddenIntent = (action: AgentAction): boolean => {
  const executableFields = [
    action.action,
    action.target ?? "",
    action.selector ?? "",
    action.url ?? "",
    action.text ?? "",
    action.key ?? "",
  ].join(" ");

  if (forbiddenIntentPattern.test(executableFields)) {
    return true;
  }

  if (action.action !== "stop" && action.action !== "extract_results") {
    return captchaInteractionPattern.test(executableFields);
  }

  return false;
};

export const isSafeSelector = (selector: string): boolean => {
  const value = normalizeText(selector);
  if (!value || value.length > 220) {
    return false;
  }

  if (riskySelectorPattern.test(value)) {
    return false;
  }

  return !/[{};]/.test(value);
};

export const parseAgentAction = (value: unknown): AgentAction => {
  if (!value || typeof value !== "object") {
    throw new Error("LLM 응답이 JSON 객체가 아닙니다.");
  }

  const raw = value as Record<string, unknown>;
  const action = raw.action;
  if (typeof action !== "string" || !allowedActions.includes(action as AgentAction["action"])) {
    throw new Error(`허용되지 않은 action입니다: ${String(action)}`);
  }

  return {
    action: action as AgentAction["action"],
    target: typeof raw.target === "string" ? raw.target : undefined,
    selector: typeof raw.selector === "string" ? raw.selector : undefined,
    url: typeof raw.url === "string" ? raw.url : undefined,
    text: typeof raw.text === "string" ? raw.text : undefined,
    key: typeof raw.key === "string" ? raw.key : undefined,
    ms: typeof raw.ms === "number" ? raw.ms : undefined,
    reason: typeof raw.reason === "string" ? raw.reason : "",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
  };
};

export const validateAction = (
  action: AgentAction,
): { ok: true } | { ok: false; reason: string } => {
  if (!allowedActions.includes(action.action)) {
    return { ok: false, reason: `허용되지 않은 action입니다: ${action.action}` };
  }

  if (isForbiddenIntent(action)) {
    return { ok: false, reason: "로그인, CAPTCHA, 프록시, 우회 등 금지된 의도가 포함되어 있습니다." };
  }

  if (action.action === "goto") {
    const url = toAbsoluteUrl(action.url);
    if (!url || !isSaraminUrl(url)) {
      return { ok: false, reason: `사람인 도메인이 아닌 URL은 이동하지 않습니다: ${action.url ?? ""}` };
    }
  }

  if (action.action === "click_selector" || action.action === "fill_text") {
    const selector = action.selector || action.target || "";
    if (!isSafeSelector(selector)) {
      return { ok: false, reason: `위험하거나 너무 넓은 selector입니다: ${selector}` };
    }
  }

  if (action.action === "wait" && action.ms !== undefined && action.ms > 10_000) {
    return { ok: false, reason: "wait은 10초를 초과할 수 없습니다." };
  }

  return { ok: true };
};
