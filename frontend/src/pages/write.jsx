import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import xml from "highlight.js/lib/languages/xml";
import cssLang from "highlight.js/lib/languages/css";
import jsonLang from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import ruby from "highlight.js/lib/languages/ruby";
import go from "highlight.js/lib/languages/go";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { useAuth } from "../contexts/AuthContext";
import "./write.css";

const LinkIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M9.5 14.5l-2.15 2.15a2.6 2.6 0 0 1-3.68-3.68L5.82 10" />
    <path d="M14.5 9.5l2.15-2.15a2.6 2.6 0 1 1 3.68 3.68L18.18 14" />
    <path d="M10.5 13.5l3-3" />
  </svg>
);

const buildFallbackAvatar = (seed) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    seed || "Writer"
  )}`;

const formatRelativeTimestamp = (timestamp) => {
  if (!timestamp) {
    return "Draft in progress";
  }

  const delta = Date.now() - timestamp;

  if (delta < 5000) {
    return "Saved just now";
  }

  if (delta < 60000) {
    return `Saved ${Math.floor(delta / 1000)}s ago`;
  }

  if (delta < 3600000) {
    return `Saved ${Math.floor(delta / 60000)}m ago`;
  }

  if (delta < 86400000) {
    return `Saved ${Math.floor(delta / 3600000)}h ago`;
  }

  const savedDate = new Date(timestamp);
  return `Saved on ${savedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

const MARK_TYPE_MAP = {
  bold: "BOLD",
  italic: "ITALIC",
  code: "CODE",
  link: "LINK",
};

const extractTextAndMarkups = (node) => {
  let text = "";
  const markups = [];

  const walk = (current) => {
    if (!current) {
      return;
    }

    if (current.type === "text") {
      const value = current.text || "";
      const start = text.length;
      text += value;

      if (Array.isArray(current.marks)) {
        current.marks.forEach((mark) => {
          const markupType = MARK_TYPE_MAP[mark.type];
          if (!markupType) {
            return;
          }

          const markup = {
            type: markupType,
            start,
            end: start + value.length,
          };

          if (mark.type === "link" && mark.attrs?.href) {
            markup.href = mark.attrs.href;
          }

          markups.push(markup);
        });
      }
    } else if (current.type === "hardBreak") {
      text += "\n";
    }

    if (Array.isArray(current.content)) {
      current.content.forEach(walk);
    }
  };

  walk(node);
  return { text, markups };
};

const normalizeTextAndMarkups = (rawText, markups) => {
  if (!rawText) {
    return { text: "", markups: [] };
  }

  const leadingWhitespace = rawText.length - rawText.trimStart().length;
  const trailingWhitespace = rawText.length - rawText.trimEnd().length;
  const startIndex = Math.max(leadingWhitespace, 0);
  const endIndex = rawText.length - Math.max(trailingWhitespace, 0);
  const normalizedText = rawText.slice(startIndex, endIndex);

  if (!normalizedText.trim()) {
    return { text: "", markups: [] };
  }

  const normalizedMarkups = markups
    .map(({ start, end, ...rest }) => {
      const newStart = Math.max(start - startIndex, 0);
      const newEnd = Math.max(end - startIndex, 0);

      if (newEnd <= 0 || newStart >= normalizedText.length) {
        return null;
      }

      return {
        ...rest,
        start: Math.max(0, Math.min(newStart, normalizedText.length)),
        end: Math.max(0, Math.min(newEnd, normalizedText.length)),
      };
    })
    .filter(Boolean);

  return { text: normalizedText, markups: normalizedMarkups };
};

const extractListItems = (node) =>
  (node.content || [])
    .map((itemNode) => {
      const { text, markups } = extractTextAndMarkups(itemNode);
      const normalized = normalizeTextAndMarkups(text, markups);
      if (!normalized.text) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);

const transformDocToContent = (doc) => {
  if (!doc || !Array.isArray(doc.content)) {
    return [];
  }

  const blocks = [];

  doc.content.forEach((node) => {
    switch (node.type) {
      case "paragraph": {
        const { text, markups } = extractTextAndMarkups(node);
        const normalized = normalizeTextAndMarkups(text, markups);
        if (normalized.text) {
          blocks.push({
            type: "P",
            text: normalized.text,
            markups: normalized.markups,
          });
        }
        break;
      }
      case "heading": {
        const { text, markups } = extractTextAndMarkups(node);
        const normalized = normalizeTextAndMarkups(text, markups);
        if (!normalized.text) {
          break;
        }

        const level = node.attrs?.level || 2;
        const headingMap = { 1: "H1", 2: "H2", 3: "H3" };
        const type = headingMap[level] || "H3";
        blocks.push({
          type,
          text: normalized.text,
          markups: normalized.markups,
        });
        break;
      }
      case "blockquote": {
        const { text, markups } = extractTextAndMarkups(node);
        const normalized = normalizeTextAndMarkups(text, markups);
        if (normalized.text) {
          blocks.push({
            type: "BQ",
            text: normalized.text,
            markups: normalized.markups,
          });
        }
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = extractListItems(node);
        if (items.length) {
          blocks.push({
            type: node.type === "bulletList" ? "UL" : "OL",
            items,
          });
        }
        break;
      }
      case "image": {
        const url = node.attrs?.src;
        if (url) {
          blocks.push({
            type: "IMG",
            image: {
              url,
              alt: node.attrs?.alt || "",
              caption: node.attrs?.title || "",
              width: node.attrs?.width,
              height: node.attrs?.height,
            },
          });
        }
        break;
      }
      case "youtube": {
        const url = node.attrs?.src || node.attrs?.videoId;
        if (url) {
          blocks.push({
            type: "VIDEO",
            video: {
              url,
              platform: "YOUTUBE",
              caption: node.attrs?.title || "",
            },
          });
        }
        break;
      }
      case "codeBlock": {
        const { text } = extractTextAndMarkups(node);
        if (text.trim()) {
          blocks.push({ type: "CODE", codeBlock: text });
        }
        break;
      }
      case "horizontalRule": {
        blocks.push({ type: "DIVIDER" });
        break;
      }
      default: {
        break;
      }
    }
  });

  return blocks;
};

const shouldShowFloatingMenu = (editor, state) => {
  if (!editor || !state) {
    return false;
  }

  if (!editor.isFocused) {
    return false;
  }

  const { selection } = state;
  if (!selection || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if (!$from) {
    return false;
  }

  const parent = $from.parent;
  if (!parent || !parent.isTextblock) {
    return false;
  }

  if (parent.type.name === "codeBlock" || editor.isActive("codeBlock")) {
    return false;
  }

  return true;
};

const Write = ({ postId, authorId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [insertMode, setInsertMode] = useState(null); // 'image' | 'video' | 'embed'
  const [urlInput, setUrlInput] = useState("");
  const [floatingMenuState, setFloatingMenuState] = useState({
    top: 0,
    left: 0,
    visible: false,
  });

  const coverInputRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const editorContainerRef = useRef(null);
  const floatingMenuRef = useRef(null);

  const displayName = user?.name || user?.username || "Your workspace";

  const displayAvatar = useMemo(
    () =>
      user?.avatar || user?.profilePicture || buildFallbackAvatar(displayName),
    [user?.avatar, user?.profilePicture, displayName]
  );

  const scheduleAutoSave = useCallback(() => {
    setIsSaving(true);
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = window.setTimeout(() => {
      setLastSavedAt(Date.now());
      setIsSaving(false);
    }, 1200);
  }, []);

  const codeSyntaxLowlight = useMemo(() => {
    const instance = createLowlight();

    instance.register({
      plaintext,
      javascript,
      typescript,
      python,
      java,
      ruby,
      go,
      php,
      xml,
      css: cssLang,
      json: jsonLang,
      bash,
    });

    instance.registerAlias({
      plaintext: ["text"],
      javascript: ["js"],
      typescript: ["ts"],
      python: ["py"],
      xml: ["html"],
      bash: ["shell"],
    });

    return instance;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      CodeBlockLowlight.configure({
        lowlight: codeSyntaxLowlight,
        defaultLanguage: "plaintext",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({ inline: false }),
      Youtube.configure({
        controls: true,
        nocookie: true,
      }),
    ],
    content: "",
    onUpdate: () => {
      scheduleAutoSave();
    },
  });

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    const syncEmptyState = () => {
      setIsEditorEmpty(editor.isEmpty);
    };

    syncEmptyState();
    editor.on("update", syncEmptyState);
    editor.on("selectionUpdate", syncEmptyState);

    return () => {
      editor.off("update", syncEmptyState);
      editor.off("selectionUpdate", syncEmptyState);
    };
  }, [editor]);

  // Remove conflicting effect that used x/y; rely on unified updateFloatingMenuPosition below

  useEffect(() => {
    if (!isInsertMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (
        floatingMenuRef.current &&
        !floatingMenuRef.current.contains(event.target)
      ) {
        setIsInsertMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInsertMenuOpen]);

  const updateFloatingMenuPosition = useCallback(() => {
    if (!editor || !editorContainerRef.current) {
      return;
    }

    const { state, view } = editor;
    if (!shouldShowFloatingMenu(editor, state)) {
      if (isInsertMenuOpen || insertMode) {
        return;
      }
      setFloatingMenuState((previous) => {
        if (!previous.visible) {
          return previous;
        }
        return { ...previous, visible: false };
      });
      setIsInsertMenuOpen(false);
      return;
    }

    const { from } = state.selection;

    let coords;
    try {
      coords = view.coordsAtPos(from);
    } catch (error) {
      return;
    }

    if (!coords) {
      return;
    }

    const containerRect = editorContainerRef.current.getBoundingClientRect();
    const top = coords.top - containerRect.top;
    const left = coords.left - containerRect.left;

    if (!Number.isFinite(top) || !Number.isFinite(left)) {
      return;
    }

    setFloatingMenuState((previous) => {
      const next = {
        top,
        left,
        visible: true,
      };

      if (
        Math.abs(previous.top - next.top) < 0.5 &&
        Math.abs(previous.left - next.left) < 0.5 &&
        previous.visible === next.visible
      ) {
        return previous;
      }

      return next;
    });
  }, [editor, insertMode, isInsertMenuOpen, setIsInsertMenuOpen]);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    const handleUpdate = () => {
      window.requestAnimationFrame(updateFloatingMenuPosition);
    };

    const handleBlur = ({ event }) => {
      const nextFocused = event?.relatedTarget || document.activeElement;
      if (
        floatingMenuRef.current &&
        nextFocused &&
        floatingMenuRef.current.contains(nextFocused)
      ) {
        return;
      }
      if (isInsertMenuOpen || insertMode) {
        return;
      }
      setFloatingMenuState((previous) => {
        if (!previous.visible) {
          return previous;
        }
        return { ...previous, visible: false };
      });
      setIsInsertMenuOpen(false);
    };

    editor.on("selectionUpdate", handleUpdate);
    editor.on("transaction", handleUpdate);
    editor.on("focus", handleUpdate);
    editor.on("blur", handleBlur);

    handleUpdate();

    return () => {
      editor.off("selectionUpdate", handleUpdate);
      editor.off("transaction", handleUpdate);
      editor.off("focus", handleUpdate);
      editor.off("blur", handleBlur);
    };
  }, [editor, insertMode, isInsertMenuOpen, updateFloatingMenuPosition, setIsInsertMenuOpen]);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    const handleWindowChange = () => {
      updateFloatingMenuPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [editor, updateFloatingMenuPosition]);

  const handleTitleChange = (event) => {
    setTitle(event.target.value);
    scheduleAutoSave();
  };

  const handleSubtitleChange = (event) => {
    setSubtitle(event.target.value);
    scheduleAutoSave();
  };

  const addTag = useCallback(
    (rawValue) => {
      const cleaned = rawValue.trim().toLowerCase();
      if (!cleaned) {
        setTagInput("");
        return;
      }

      let tagAdded = false;
      setTags((previous) => {
        if (previous.length >= 5 || previous.includes(cleaned)) {
          return previous;
        }
        tagAdded = true;
        return [...previous, cleaned];
      });

      setTagInput("");
      if (tagAdded) {
        scheduleAutoSave();
      }
    },
    [scheduleAutoSave]
  );

  const handleTagInputChange = (event) => {
    setTagInput(event.target.value);
  };

  const handleTagKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
      return;
    }

    if (event.key === "Backspace" && !tagInput && tags.length) {
      event.preventDefault();
      const lastTag = tags[tags.length - 1];
      removeTag(lastTag);
    }
  };

  const handleTagBlur = () => {
    if (tagInput.trim()) {
      addTag(tagInput);
    }
  };

  const removeTag = useCallback(
    (tagToRemove) => {
      let removed = false;
      setTags((previous) => {
        if (!previous.includes(tagToRemove)) {
          return previous;
        }
        removed = true;
        return previous.filter((tag) => tag !== tagToRemove);
      });

      if (removed) {
        scheduleAutoSave();
      }
    },
    [scheduleAutoSave]
  );

  const handleBack = () => {
    navigate(-1);
  };

  const handleCoverSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCoverUrl(reader.result);
        scheduleAutoSave();
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleCoverRemove = () => {
    setCoverUrl("");
    scheduleAutoSave();
  };

  const handlePublish = () => {
    if (!editor) {
      return;
    }

    const documentJson = editor.getJSON();
    const content = transformDocToContent(documentJson);
    const plainText = editor.getText();
    const wordCount = plainText
      ? plainText.trim().split(/\s+/).filter(Boolean).length
      : 0;
    const readingTime = wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : 0;

    const payload = {
      id: postId || undefined,
      authorId: authorId || user?.id || user?._id,
      title: title.trim(),
      subtitle: subtitle.trim(),
      tags,
      coverImage: coverUrl || null,
      content,
      wordCount,
      readingTime,
    };

    console.log("Publish payload", payload);
    window.alert("Publishing flow coming soon. Your draft is safe.");
    setLastSavedAt(Date.now());
  };

  const headerStatus = isSaving
    ? "Saving..."
    : formatRelativeTimestamp(lastSavedAt);

  const insertImage = useCallback(() => {
    setInsertMode("image");
    setUrlInput("");
  }, []);

  const insertVideo = useCallback(() => {
    setInsertMode("video");
    setUrlInput("");
  }, []);

  const insertEmbed = useCallback(() => {
    setInsertMode("embed");
    setUrlInput("");
  }, []);

  const insertCodeBlock = () => {
    if (!editor) {
      return;
    }

    editor.chain().focus().toggleCodeBlock({ language: "javascript" }).run();
    setIsInsertMenuOpen(false);
  };

  const insertDivider = () => {
    if (!editor) {
      return;
    }

    editor.chain().focus().setHorizontalRule().run();
    setIsInsertMenuOpen(false);
  };

  const toggleLink = useCallback(() => {
    if (!editor) {
      return;
    }

    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt("Enter link URL");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const toggleHeadingLevel2 = useCallback(() => {
    if (!editor) {
      return;
    }

    editor.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const toggleBlockquote = useCallback(() => {
    if (!editor) {
      return;
    }

    editor.chain().focus().toggleBlockquote().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    if (!editor) {
      return;
    }

    editor.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    if (!editor) {
      return;
    }

    editor.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const bubbleMenuItems = useMemo(() => {
    if (!editor) {
      return [];
    }

    return [
      {
        key: "bold",
        display: "B",
        ariaLabel: "Bold",
        className: "write-bubble__button--bold",
        onClick: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive("bold"),
      },
      {
        key: "italic",
        display: "i",
        ariaLabel: "Italic",
        className: "write-bubble__button--italic",
        onClick: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive("italic"),
      },
      {
        key: "link",
        display: <LinkIcon className="write-bubble__icon" />,
        ariaLabel: "Add link",
        className: "write-bubble__button--link",
        onClick: toggleLink,
        isActive: () => editor.isActive("link"),
      },
      { key: "divider-1", type: "divider" },
      {
        key: "heading",
        display: "T",
        ariaLabel: "Toggle heading",
        className: "write-bubble__button--heading",
        onClick: toggleHeadingLevel2,
        isActive: () => editor.isActive("heading", { level: 2 }),
      },
      {
        key: "quote",
        display: "“”",
        ariaLabel: "Toggle quote",
        className: "write-bubble__button--quote",
        onClick: toggleBlockquote,
        isActive: () => editor.isActive("blockquote"),
      },
      {
        key: "bullet",
        display: "•",
        ariaLabel: "Toggle bullet list",
        className: "write-bubble__button--bullet",
        onClick: toggleBulletList,
        isActive: () => editor.isActive("bulletList"),
      },
      {
        key: "ordered",
        display: "1.",
        ariaLabel: "Toggle ordered list",
        className: "write-bubble__button--ordered",
        onClick: toggleOrderedList,
        isActive: () => editor.isActive("orderedList"),
      },
    ];
  }, [
    editor,
    toggleBlockquote,
    toggleHeadingLevel2,
    toggleLink,
    toggleBulletList,
    toggleOrderedList,
  ]);

  return (
    <div className="write-page">
      <header className="write-header">
        <div className="write-header__left">
          <button
            type="button"
            className="write-header__back"
            onClick={handleBack}
            aria-label="Go back"
          >
            {"<"}
          </button>
          <div className="write-header__state">
            Draft in {displayName} - {headerStatus}
          </div>
        </div>
        <div className="write-header__right">
          <button
            type="button"
            className="write-header__btn"
            onClick={() => window.alert("Preview coming soon")}
          >
            Preview
          </button>
          <button
            type="button"
            className="write-header__btn write-header__btn--primary"
            onClick={handlePublish}
          >
            Publish
          </button>
          <div className="write-header__profile">
            <img src={displayAvatar} alt={displayName} />
            <span>{displayName}</span>
          </div>
        </div>
      </header>

      <main className="write-main">
        <section className="write-stage">
          <div
            className={`write-cover${coverUrl ? " write-cover--filled" : ""}`}
          >
            {coverUrl ? (
              <>
                <img src={coverUrl} alt="Cover" />
                <div className="write-cover__actions">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Replace
                  </button>
                  <button type="button" onClick={handleCoverRemove}>
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <div className="write-cover__placeholder">
                <p>Add a cover image</p>
                <span>Make your story stand out with a striking visual.</span>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                >
                  Upload
                </button>
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="write-cover__input"
              onChange={handleCoverSelect}
            />
          </div>

          <div className="write-fields">
            <textarea
              className="write-title"
              placeholder="Title"
              value={title}
              onChange={handleTitleChange}
              rows={1}
            />
            <textarea
              className="write-subtitle"
              placeholder="Tell readers what your story is about"
              value={subtitle}
              onChange={handleSubtitleChange}
              rows={2}
            />
          </div>

          <div className="write-editor" ref={editorContainerRef}>
            {editor && (
              <div
                ref={floatingMenuRef}
                className={`write-plus${
                  floatingMenuState.visible ? " write-plus--visible" : ""
                }${isInsertMenuOpen ? " write-plus--open" : ""}`}
                style={{
                  top: floatingMenuState.top,
                  left: floatingMenuState.left,
                }}
                aria-hidden={!floatingMenuState.visible}
              >
                <button
                  type="button"
                  className="write-plus__trigger"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setInsertMode(null);
                    setUrlInput("");
                    setIsInsertMenuOpen((prev) => !prev);
                  }}
                  aria-expanded={isInsertMenuOpen}
                  aria-label="Insert options"
                >
                  {isInsertMenuOpen ? "×" : "+"}
                </button>
                {isInsertMenuOpen && (
                  <div className="write-plus__options">
                    {insertMode ? (
                      <div className="write-plus__url">
                        <input
                          className="write-plus__url-input"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const url = urlInput.trim();
                              if (!url) return;
                              if (insertMode === "image") {
                                editor.chain().focus().setImage({ src: url }).run();
                              } else if (insertMode === "video") {
                                editor.chain().focus().setYoutubeVideo({ src: url }).run();
                              } else if (insertMode === "embed") {
                                editor
                                  .chain()
                                  .focus()
                                  .insertContent({
                                    type: "blockquote",
                                    content: [{ type: "text", text: url }],
                                  })
                                  .run();
                              }
                              setInsertMode(null);
                              setUrlInput("");
                              setIsInsertMenuOpen(false);
                            }
                            if (e.key === "Escape") {
                              setInsertMode(null);
                            }
                          }}
                          placeholder={
                            insertMode === "video"
                              ? "Paste video URL"
                              : insertMode === "embed"
                              ? "Paste link to embed"
                              : "Paste image URL"
                          }
                        />
                        <button
                          type="button"
                          className="write-plus__url-confirm"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const url = urlInput.trim();
                            if (!url) return;
                            if (insertMode === "image") {
                              editor.chain().focus().setImage({ src: url }).run();
                            } else if (insertMode === "video") {
                              editor.chain().focus().setYoutubeVideo({ src: url }).run();
                            } else if (insertMode === "embed") {
                              editor
                                .chain()
                                .focus()
                                .insertContent({
                                  type: "blockquote",
                                  content: [{ type: "text", text: url }],
                                })
                                .run();
                            }
                            setInsertMode(null);
                            setUrlInput("");
                            setIsInsertMenuOpen(false);
                          }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="write-plus__url-cancel"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setInsertMode(null)}
                          aria-label="Cancel"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={insertImage}
                          aria-label="Insert image"
                        >
                          Img
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={insertVideo}
                          aria-label="Embed video"
                        >
                          Vid
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={insertEmbed}
                          aria-label="Embed link"
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={insertCodeBlock}
                          aria-label="Insert code block"
                        >
                          {"</>"}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={insertDivider}
                          aria-label="Insert divider"
                        >
                          HR
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {editor && bubbleMenuItems.length > 0 && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }}>
                <div className="write-bubble">
                  {bubbleMenuItems.map((item) => {
                    if (item.type === "divider") {
                      return (
                        <span
                          key={item.key}
                          className="write-bubble__divider"
                          aria-hidden="true"
                        />
                      );
                    }

                    const isActive = item.isActive();
                    const classes = ["write-bubble__button"];
                    if (item.className) {
                      classes.push(item.className);
                    }
                    if (isActive) {
                      classes.push("is-active");
                    }
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={classes.join(" ")}
                        onClick={item.onClick}
                        aria-label={item.ariaLabel}
                      >
                        <span aria-hidden="true">{item.display}</span>
                      </button>
                    );
                  })}
                  {editor.isActive("codeBlock") && (
                    <div className="write-code-toolbar">
                      <select
                        className="write-code-lang"
                        value={editor.getAttributes("codeBlock").language || "plaintext"}
                        onChange={(e) =>
                          editor
                            .chain()
                            .focus()
                            .updateAttributes("codeBlock", { language: e.target.value })
                            .run()
                        }
                      >
                        {[
                          { value: "plaintext", label: "Plain Text" },
                          { value: "javascript", label: "JavaScript" },
                          { value: "typescript", label: "TypeScript" },
                          { value: "python", label: "Python" },
                          { value: "java", label: "Java" },
                          { value: "go", label: "Go" },
                          { value: "php", label: "PHP" },
                          { value: "ruby", label: "Ruby" },
                          { value: "html", label: "HTML" },
                          { value: "css", label: "CSS" },
                          { value: "json", label: "JSON" },
                          { value: "bash", label: "Shell" },
                        ].map((lang) => (
                          <option key={lang.value} value={lang.value}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="write-code-copy"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          const { $from } = editor.state.selection;
                          let depth = $from.depth;
                          let codeBlockNode = null;

                          while (depth > 0) {
                            const nodeAtDepth = $from.node(depth);
                            if (nodeAtDepth?.type?.name === "codeBlock") {
                              codeBlockNode = nodeAtDepth;
                              break;
                            }
                            depth -= 1;
                          }

                          const text = codeBlockNode?.textContent || "";
                          if (!text.trim()) {
                            return;
                          }
                          navigator.clipboard.writeText(text).catch(() => {});
                        }}
                        aria-label="Copy code"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              </BubbleMenu>
            )}

            {isEditorEmpty && (
              <div className="write-editor__placeholder">
                Tell your story...
              </div>
            )}

            <div className="write-editor__content">
              <EditorContent editor={editor} />
            </div>
          </div>
        </section>

        <aside className="write-sidebar">
          <div className="write-meta">
            <label htmlFor="write-tags-input">Tags</label>
            <div className="write-tags" id="write-tags-input">
              {tags.map((tag) => (
                <span key={tag} className="write-tag">
                  <span className="write-tag__label">#{tag}</span>
                  <button
                    type="button"
                    className="write-tag__remove"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                className="write-tags__input"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
                placeholder={tags.length ? "" : "Add a tag and press Enter"}
              />
            </div>
            <p className="write-meta__hint">
              Use up to five tags to help readers discover your story.
            </p>
          </div>

          <div className="write-sidebar__card">
            <h3>Writing tips</h3>
            <ul>
              <li>Start with a compelling intro to hook readers.</li>
              <li>Use headings and quotes to structure your narrative.</li>
              <li>Add visuals and embeds to enhance understanding.</li>
            </ul>
          </div>

          <div className="write-sidebar__card">
            <h3>Draft status</h3>
            <p>{headerStatus}</p>
            <p>Autosave keeps your progress safe while you write.</p>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default Write;
