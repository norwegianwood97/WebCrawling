import { Page } from "playwright";
import { AppConfig } from "../config.js";
import { logAgent } from "../utils/logger.js";
import { writeDebugArtifacts } from "../utils/debug.js";
import { executeAction } from "./actionExecutor.js";
import { observePage } from "./pageObserver.js";
import { buildPrompt } from "./promptBuilder.js";
import { requestNextAction } from "./llmClient.js";
import { AgentHistoryItem, AgentLoopResult } from "./types.js";

const doneByUrl = (url: string): boolean =>
  /\/zf_user\/jobs\/list\//i.test(url) && /search_done=y|preview=y/i.test(url);

const isGoalConditionsReady = (observation: Awaited<ReturnType<typeof observePage>>): boolean =>
  observation.progress.regionSelected &&
  observation.progress.jobCategorySelected &&
  observation.progress.careerSelected;

const isSearchResultReady = (observation: Awaited<ReturnType<typeof observePage>>): boolean =>
  observation.progress.resultListVisible || doneByUrl(observation.currentUrl);

export const runAgentLoop = async (
  page: Page,
  config: AppConfig,
): Promise<AgentLoopResult> => {
  const history: AgentHistoryItem[] = [];
  const failedHistory: AgentHistoryItem[] = [];

  for (let step = 1; step <= config.maxAgentSteps; step += 1) {
    const observation = await observePage(page, config, step);
    logAgent(`step ${step} observe 완료`);

    if (observation.progress.blockedOrCaptchaLikely) {
      await writeDebugArtifacts(page, config, "차단/CAPTCHA 의심 화면 감지", "debug");
      return { success: false, reason: "차단/CAPTCHA 의심 화면이 감지되어 중단했습니다.", steps: step };
    }

    const goalConditionsReady = isGoalConditionsReady(observation);
    const searchResultReady = isSearchResultReady(observation);

    if (goalConditionsReady && searchResultReady) {
      const reason = "목표 조건이 적용된 결과 목록이 보입니다.";
      logAgent(`조건 설정 완료: ${reason}`);
      return { success: true, reason, steps: step };
    }

    const prompt = buildPrompt(observation, history, failedHistory);
    const action = await requestNextAction(config, prompt);
    logAgent(`step ${step} action: ${action.action} ${action.target || action.selector || action.url || ""}`);

    const result = await executeAction(page, config, action);
    const item: AgentHistoryItem = {
      step,
      action,
      success: result.success,
      message: result.message,
    };

    history.push(item);
    if (!result.success) {
      failedHistory.push(item);
      logAgent(`step ${step} action 실패: ${result.message}`);
      continue;
    }

    if (action.action === "extract_results") {
      if (goalConditionsReady && searchResultReady) {
        const reason = "LLM이 결과 추출을 요청했고 목표 조건이 준비되어 있습니다.";
        logAgent(`조건 설정 완료: ${reason}`);
        return { success: true, reason, steps: step };
      }

      const message =
        "LLM이 결과 추출을 요청했지만 지역/직업/경력 조건 또는 채용 목록 페이지가 아직 준비되지 않았습니다.";
      failedHistory.push({ step, action, success: false, message });
      logAgent(`step ${step} action 보류: ${message}`);
      continue;
    }

    if (action.action === "stop") {
      await writeDebugArtifacts(page, config, "LLM이 stop을 반환했습니다.", "debug");
      return { success: false, reason: action.reason || "LLM stop", steps: step };
    }
  }

  await writeDebugArtifacts(page, config, "MAX_AGENT_STEPS 초과", "debug");
  return {
    success: false,
    reason: `MAX_AGENT_STEPS(${config.maxAgentSteps})를 초과했습니다.`,
    steps: config.maxAgentSteps,
  };
};
