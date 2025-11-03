export const countWords = (contentBlocks = []) => {
  if (!Array.isArray(contentBlocks)) return 0;

  return contentBlocks.reduce((total, block) => {
    if (!block) return total;
    let text = "";

    if (typeof block.text === "string") {
      text += ` ${block.text}`;
    }

    if (Array.isArray(block.items)) {
      block.items.forEach((item) => {
        if (typeof item?.text === "string") {
          text += ` ${item.text}`;
        }
      });
    }

    if (typeof block.codeBlock === "string") {
      text += ` ${block.codeBlock}`;
    }

    const words = text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    return total + words;
  }, 0);
};

export const estimateReadingTime = (wordCount) => {
  const WORDS_PER_MINUTE = 200;
  if (!wordCount) return 1;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
};
