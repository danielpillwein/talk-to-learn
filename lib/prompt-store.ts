import fs from "fs";
import path from "path";

const promptCache = new Map<string, string>();

type TemplateVars = Record<string, string | number | boolean | null | undefined>;

function normalizePromptName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Prompt name is required.");
  }
  return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
}

export function loadPrompt(name: string): string {
  const filename = normalizePromptName(name);
  if (promptCache.has(filename)) {
    return promptCache.get(filename)!;
  }

  const filePath = path.join(process.cwd(), "prompts", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  promptCache.set(filename, content);
  return content;
}

export function renderPrompt(template: string, values: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function loadRenderedPrompt(name: string, values: TemplateVars): string {
  return renderPrompt(loadPrompt(name), values);
}
