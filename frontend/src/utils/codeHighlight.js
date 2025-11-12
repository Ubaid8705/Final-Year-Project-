import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import ruby from "highlight.js/lib/languages/ruby";
import go from "highlight.js/lib/languages/go";
import php from "highlight.js/lib/languages/php";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import plaintext from "highlight.js/lib/languages/plaintext";

const LANGUAGE_MODULES = {
  plaintext,
  javascript,
  typescript,
  python,
  java,
  ruby,
  go,
  php,
  xml,
  css,
  json,
  bash,
  c,
  cpp,
};

const LANGUAGE_ALIASES = {
  text: "plaintext",
  plaintext: "plaintext",
  none: "plaintext",
  plain: "plaintext",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  python: "python",
  py: "python",
  java: "java",
  ruby: "ruby",
  rb: "ruby",
  go: "go",
  golang: "go",
  php: "php",
  xml: "xml",
  html: "xml",
  css: "css",
  json: "json",
  bash: "bash",
  shell: "bash",
  sh: "bash",
  c: "c",
  "c-lang": "c",
  cpp: "cpp",
  "c++": "cpp",
  cplusplus: "cpp",
};

const LANGUAGE_LABELS = {
  plaintext: "Plain Text",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  ruby: "Ruby",
  go: "Go",
  php: "PHP",
  xml: "HTML / XML",
  css: "CSS",
  json: "JSON",
  bash: "Shell",
  c: "C",
  cpp: "C++",
};

export const SUPPORTED_CODE_LANGUAGES = Object.keys(LANGUAGE_MODULES);

export const normalizeCodeLanguage = (value) => {
  if (!value) {
    return null;
  }

  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (LANGUAGE_MODULES[normalized]) {
    return normalized;
  }

  return LANGUAGE_ALIASES[normalized] || null;
};

export const getCodeLanguageLabel = (value) => {
  const normalized = normalizeCodeLanguage(value) || "plaintext";
  return LANGUAGE_LABELS[normalized] || normalized;
};

export const createCodeLowlight = () => {
  const instance = createLowlight();

  Object.entries(LANGUAGE_MODULES).forEach(([name, syntax]) => {
    instance.register(name, syntax);
  });

  instance.registerAlias({
    plaintext: ["text", "plain"],
    javascript: ["js"],
    typescript: ["ts"],
    python: ["py"],
    ruby: ["rb"],
    go: ["golang"],
    xml: ["html"],
    bash: ["shell", "sh"],
    c: ["c-lang"],
    cpp: ["c++", "cplusplus"],
  });

  return instance;
};

export const isSupportedCodeLanguage = (value) => {
  const normalized = normalizeCodeLanguage(value);
  if (!normalized) {
    return false;
  }
  return Boolean(LANGUAGE_MODULES[normalized]);
};
