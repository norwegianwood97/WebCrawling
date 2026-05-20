import { AppConfig } from "../config.js";
import { AgentAction } from "./types.js";
import { parseAgentAction } from "./safetyGuard.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

const extractJson = (content: string): unknown => {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error(`LLM 응답에서 JSON을 찾지 못했습니다: ${trimmed.slice(0, 300)}`);
  }
};

export const requestNextAction = async (
  config: AppConfig,
  prompt: string,
): Promise<AgentAction> => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: config.llmTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 Playwright 기반 웹 탐색 에이전트다. 출력은 반드시 JSON 객체 하나만 사용한다. 데이터 추출은 하지 말고 다음 행동 하나만 판단한다.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(json.error?.message || `OpenAI API 호출 실패: ${response.status}`);
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 응답에 content가 없습니다.");
  }

  return parseAgentAction(extractJson(content));
};
