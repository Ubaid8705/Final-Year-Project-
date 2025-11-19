import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
  UNSAFE_NavigationContext,
} from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import { uploadImage } from "../services/mediaService";
import {
  createCodeLowlight,
  getCodeLanguageLabel,
  normalizeCodeLanguage,
  SUPPORTED_CODE_LANGUAGES,
} from "../utils/codeHighlight";
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

const EnhancedImage = Image.extend({
  addAttributes() {
    const parentAttributes = (typeof this.parent === "function" && this.parent()) || {};
    return {
      ...parentAttributes,
      width: { default: null },
      height: { default: null },
      publicId: { default: null },
      displayUrl: { default: null },
      originalUrl: { default: null },
      thumbnailUrl: { default: null },
      placeholderUrl: { default: null },
      aspectRatio: { default: null },
    };
  },
});

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

const NAVIGATION_WARNING_MESSAGE =
  "You have unsaved changes. Are you sure you want to leave without saving?";

const useNavigationPrompt = (when, onNavigationAttempt) => {
  const navigationContext = useContext(UNSAFE_NavigationContext);

  useEffect(() => {
    if (!when || typeof onNavigationAttempt !== "function") {
      return undefined;
    }

    const navigator = navigationContext?.navigator;
    if (!navigator || typeof navigator.block !== "function") {
      return undefined;
    }

    const unblock = navigator.block((tx) => {
      onNavigationAttempt({ tx, unblock });
    });

    return unblock;
  }, [when, navigationContext, onNavigationAttempt]);
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
          const language = normalizeCodeLanguage(node.attrs?.language);
          blocks.push({
            type: "CODE",
            codeBlock: text,
            codeLanguage: language || null,
          });
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

const buildTextNodes = (text) => {
  if (!text) {
    return [];
  }
  return [{ type: "text", text }];
};

const buildParagraphNode = (text) => {
  const content = buildTextNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

const transformContentToDoc = (blocks = []) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const docContent = [];

  blocks.forEach((block) => {
    if (!block || typeof block !== "object") {
      return;
    }

    const rawType = block.type || "";
    const type = rawType.toString().toUpperCase();

    switch (type) {
      case "H1":
      case "H2":
      case "H3": {
        const level = type === "H1" ? 1 : type === "H2" ? 2 : 3;
        const content = buildTextNodes(block.text);
        docContent.push({
          type: "heading",
          attrs: { level },
          content: content.length ? content : [{ type: "text", text: "" }],
        });
        break;
      }
      case "BQ":
      case "BLOCKQUOTE": {
        docContent.push({
          type: "blockquote",
          content: [buildParagraphNode(block.text || "")],
        });
        break;
      }
      case "IMG": {
        const image = block.image || {};
        const src =
          image.displayUrl ||
          image.url ||
          image.originalUrl ||
          image.thumbnailUrl ||
          null;

        if (src) {
          const attrs = {
            src,
            alt: image.alt || "",
            title: image.caption || "",
          };
          if (image.width) {
            attrs.width = image.width;
          }
          if (image.height) {
            attrs.height = image.height;
          }
          docContent.push({ type: "image", attrs });
        }
        break;
      }
      case "VIDEO": {
        const video = block.video || {};
        const url = video.url || "";
        if (url && /youtube\.com|youtu\.be/.test(url)) {
          docContent.push({ type: "youtube", attrs: { src: url } });
        } else if (url) {
          docContent.push(buildParagraphNode(url));
        }
        break;
      }
      case "CODE": {
        const code = block.codeBlock || block.text || "";
        const normalizedLanguage =
          normalizeCodeLanguage(block.codeLanguage || block.language) ||
          "plaintext";
        docContent.push({
          type: "codeBlock",
          attrs: { language: normalizedLanguage },
          content: [{ type: "text", text: code }],
        });
        break;
      }
      case "UL":
      case "OL": {
        const items = Array.isArray(block.items) ? block.items : [];
        if (!items.length) {
          break;
        }
        const listItems = items.map((item) => ({
          type: "listItem",
          content: [buildParagraphNode(item?.text || "")],
        }));
        docContent.push({
          type: type === "OL" ? "orderedList" : "bulletList",
          content: listItems,
        });
        break;
      }
      case "DIVIDER": {
        docContent.push({ type: "horizontalRule" });
        break;
      }
      default: {
        docContent.push(buildParagraphNode(block.text || ""));
        break;
      }
    }
  });

  if (docContent.length === 0) {
    docContent.push({ type: "paragraph" });
  }

  return { type: "doc", content: docContent };
};

const normalizeCoverAssetFromPost = (post = {}) => {
  const meta = post.coverImageMeta || {};
  const hasMeta = meta && Object.keys(meta).length > 0;
  const fallback = post.coverImage || null;

  if (!hasMeta && !fallback) {
    return null;
  }

  const displayUrl =
    meta.displayUrl ||
    fallback ||
    meta.originalUrl ||
    meta.thumbnailUrl ||
    null;

  if (!displayUrl) {
    return null;
  }

  return {
    ...meta,
    displayUrl,
    originalUrl: meta.originalUrl || fallback || displayUrl,
    secureUrl: fallback || meta.secureUrl || displayUrl,
    thumbnailUrl: meta.thumbnailUrl || null,
    placeholderUrl: meta.placeholderUrl || null,
    publicId: meta.publicId || null,
    width: meta.width || null,
    height: meta.height || null,
    aspectRatio: meta.aspectRatio || null,
  };
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();

  const routeState = location.state || {};
  const statePostId = routeState.postId || routeState.id || null;
  const statePostSlug = routeState.postSlug || null;
  const queryPostIdRaw = searchParams.get("postId") || searchParams.get("id");
  const queryPostId = queryPostIdRaw ? queryPostIdRaw.trim() : null;
  const initialPostIdentifier = postId || statePostId || queryPostId || statePostSlug || null;

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [coverAsset, setCoverAsset] = useState(null);
  const [coverUploadState, setCoverUploadState] = useState({ loading: false, error: null });
  const [inlineUploadState, setInlineUploadState] = useState({ loading: false, error: null });
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [insertMode, setInsertMode] = useState(null); // 'image' | 'image-link' | 'video' | 'embed'
  const [urlInput, setUrlInput] = useState("");
  const [floatingMenuState, setFloatingMenuState] = useState({
    top: 0,
    left: 0,
    visible: false,
  });
  const [draftMeta, setDraftMeta] = useState(() => ({ id: initialPostIdentifier || null, slug: statePostSlug || null }));
  const [bootstrapLoading, setBootstrapLoading] = useState(Boolean(initialPostIdentifier));
  const [bootstrapError, setBootstrapError] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [sendEmailsPreference, setSendEmailsPreference] = useState(true);
  const [distributionMode, setDistributionMode] = useState(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [emailPromptVisible, setEmailPromptVisible] = useState(false);
  const [navigationPromptState, setNavigationPromptState] = useState(null);
  const [infoModal, setInfoModal] = useState(null);

  const handleBlockedNavigation = useCallback(({ tx, unblock }) => {
    setNavigationPromptState({ tx, unblock });
  }, []);

  useNavigationPrompt(!autoSaveEnabled && hasPendingChanges, handleBlockedNavigation);

  useEffect(() => {
    if (!(!autoSaveEnabled && hasPendingChanges)) {
      setNavigationPromptState(null);
    }
  }, [autoSaveEnabled, hasPendingChanges]);

  const dismissNavigationPrompt = useCallback(() => {
    setNavigationPromptState(null);
  }, []);

  const confirmNavigationPrompt = useCallback(() => {
    setNavigationPromptState((current) => {
      if (current) {
        current.unblock();
        current.tx.retry();
      }
      return null;
    });
  }, []);

  const openInfoModal = useCallback((config) => {
    setInfoModal({
      title: config.title,
      message: config.message,
      primaryLabel: config.primaryLabel || "OK",
      onPrimary: config.onPrimary || null,
    });
  }, []);

  const closeInfoModal = useCallback(() => {
    setInfoModal(null);
  }, []);

  const handleInfoModalPrimary = useCallback(() => {
    setInfoModal((current) => {
      if (current?.onPrimary) {
        current.onPrimary();
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!autoSaveEnabled || !hasPendingChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = NAVIGATION_WARNING_MESSAGE;
      return NAVIGATION_WARNING_MESSAGE;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [autoSaveEnabled, hasPendingChanges]);

  useEffect(() => {
    if (autoSaveEnabled) {
      setHasPendingChanges(false);
    }
  }, [autoSaveEnabled]);

  const coverInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const inlineImageInputRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const floatingMenuRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const bootstrappingRef = useRef(Boolean(initialPostIdentifier));
  const pendingDocRef = useRef(null);
  const pendingPublishRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const displayName = user?.name || user?.username || "Your workspace";

  const displayAvatar = useMemo(
    () =>
      user?.avatar || user?.profilePicture || buildFallbackAvatar(displayName),
    [user?.avatar, user?.profilePicture, displayName]
  );

  const buildPayload = useCallback(
    (overrides = {}) => {
      const editorInstance = editorRef.current;
      if (!editorInstance) {
        return null;
      }

      const documentJson = editorInstance.getJSON();
      const contentBlocks = transformDocToContent(documentJson);
      const plainText = editorInstance.getText();
      const wordCount = plainText
        ? plainText.trim().split(/\s+/).filter(Boolean).length
        : 0;
      const readingTime = wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : 0;

      const resolvedDistribution = (distributionMode || (sendEmailsPreference ? "AUTO_EMAIL" : "PROMPT"))
        .toString()
        .trim()
        .toUpperCase() === "PROMPT"
        ? "PROMPT"
        : "AUTO_EMAIL";

      return {
        title: title.trim(),
        subtitle: subtitle.trim(),
        tags,
        content: contentBlocks,
        coverImage:
          coverAsset?.displayUrl || coverAsset?.secureUrl || coverAsset?.originalUrl || null,
        coverImageMeta: coverAsset
          ? {
              displayUrl: coverAsset.displayUrl,
              originalUrl: coverAsset.originalUrl,
              thumbnailUrl: coverAsset.thumbnailUrl,
              placeholderUrl: coverAsset.placeholderUrl,
              publicId: coverAsset.publicId,
              width: coverAsset.width,
              height: coverAsset.height,
              aspectRatio: coverAsset.aspectRatio,
              format: coverAsset.format,
              bytes: coverAsset.bytes,
              uploadedAt: coverAsset.uploadedAt,
            }
          : null,
        wordCount,
        readingTime,
        distributionMode: resolvedDistribution,
        ...overrides,
      };
    },
  [title, subtitle, tags, coverAsset, distributionMode, sendEmailsPreference]
  );

  const sendPostPayload = useCallback(
    async (payload) => {
      if (!token) {
        throw new Error("Authentication required.");
      }

      const hasExistingDraft = Boolean(draftMeta?.id);
      const endpoint = hasExistingDraft
        ? `${API_BASE_URL}/api/posts/${draftMeta.id}`
        : `${API_BASE_URL}/api/posts`;
      const method = hasExistingDraft ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save post.");
      }

      const nextId = data.id || data._id || draftMeta?.id || null;
      const nextSlug = data.slug || draftMeta?.slug || null;

      setDraftMeta((previous) => ({
        id: nextId,
        slug: nextSlug || previous?.slug || null,
      }));

      if (Object.prototype.hasOwnProperty.call(data, "coverImageMeta")) {
        if (data.coverImageMeta) {
          setCoverAsset((previous) => {
            const displayUrl =
              data.coverImageMeta.displayUrl ||
              data.coverImage ||
              previous?.displayUrl ||
              data.coverImageMeta.originalUrl ||
              previous?.originalUrl ||
              null;

            return {
              ...previous,
              ...data.coverImageMeta,
              displayUrl,
              originalUrl:
                data.coverImageMeta.originalUrl ||
                previous?.originalUrl ||
                data.coverImage ||
                displayUrl ||
                null,
              secureUrl:
                data.coverImage ||
                data.coverImageMeta.secureUrl ||
                previous?.secureUrl ||
                displayUrl ||
                null,
            };
          });
        } else {
          setCoverAsset(null);
        }
      }

      return data;
    },
    [draftMeta, token]
  );

  const persistDraft = useCallback(async () => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !token) {
      setIsSaving(false);
      return;
    }

    if (bootstrappingRef.current) {
      setIsSaving(false);
      return;
    }

    if (saveInFlightRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    const payload = buildPayload({ isPublished: false });
    if (!payload) {
      setIsSaving(false);
      return;
    }

    const hasMeaningfulContent =
      payload.title ||
      payload.subtitle ||
      payload.coverImage ||
      (Array.isArray(payload.content) && payload.content.length > 0);

    if (!hasMeaningfulContent) {
      setIsSaving(false);
      return;
    }

    saveInFlightRef.current = true;
    setSaveError(null);

    try {
      await sendPostPayload(payload);
      setLastSavedAt(Date.now());
      setHasPendingChanges(false);
    } catch (error) {
      console.error(error);
      setSaveError(error.message || "Failed to save draft.");
      if (!autoSaveEnabled) {
        setHasPendingChanges(true);
      }
    } finally {
      saveInFlightRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        persistDraft();
        return;
      }
      setIsSaving(false);
    }
  }, [token, buildPayload, sendPostPayload, autoSaveEnabled]);

  const waitForActiveSave = useCallback(() => {
    if (!saveInFlightRef.current) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const check = () => {
        if (!saveInFlightRef.current) {
          resolve();
        } else {
          window.setTimeout(check, 120);
        }
      };

      check();
    });
  }, []);

  const handleSaveDraftFromPrompt = useCallback(async () => {
    await waitForActiveSave();
    await persistDraft();
    setNavigationPromptState(null);
  }, [persistDraft, waitForActiveSave]);

  const scheduleAutoSave = useCallback(() => {
    if (!editorRef.current || !token || bootstrappingRef.current) {
      return;
    }

    if (!autoSaveEnabled) {
      setHasPendingChanges(true);
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    setIsSaving(true);
    setHasPendingChanges(false);

    autoSaveTimer.current = window.setTimeout(() => {
      autoSaveTimer.current = null;
      persistDraft();
    }, 1200);
  }, [token, persistDraft, autoSaveEnabled]);

  const codeSyntaxLowlight = useMemo(() => createCodeLowlight(), []);

  const codeLanguageOptions = useMemo(
    () =>
      SUPPORTED_CODE_LANGUAGES.map((value) => ({
        value,
        label: getCodeLanguageLabel(value),
      })),
    []
  );

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
      EnhancedImage.configure({ inline: false }),
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

  const publishStory = useCallback(
    async ({ distributionMode: distributionModeOverride, shouldSendDistributionEmail }) => {
      if (!token) {
        setSaveError("Sign in to publish your story.");
        return;
      }

      const normalizedMode = (distributionModeOverride || distributionMode || (sendEmailsPreference ? "AUTO_EMAIL" : "PROMPT"))
        .toString()
        .trim()
        .toUpperCase() === "PROMPT"
        ? "PROMPT"
        : "AUTO_EMAIL";

      setDistributionMode(normalizedMode);
      setEmailPromptVisible(false);

      const payload = buildPayload({
        isPublished: true,
        distributionMode: normalizedMode,
        shouldSendDistributionEmail,
      });
      if (!payload) {
        return;
      }

      if (!payload.title) {
        openInfoModal({
          title: "Add a title",
          message:
            "Give your story a title before publishing so readers know what it's about.",
          primaryLabel: "Continue writing",
          onPrimary: () => {
            titleInputRef.current?.focus();
          },
        });
        return;
      }

      setIsPublishing(true);
      setSaveError(null);

      try {
        saveInFlightRef.current = true;
        const data = await sendPostPayload(payload);
        setLastSavedAt(Date.now());

        const targetSlug = data.slug || draftMeta?.slug;
        const targetId = data.id || data._id || draftMeta?.id;

        setHasPendingChanges(false);

        if (targetSlug) {
          navigate(`/post/${targetSlug}`);
        } else if (targetId) {
          navigate(`/post/${targetId}`);
        } else {
          navigate(-1);
        }
      } catch (error) {
        console.error(error);
        setSaveError(error.message || "Failed to publish your story.");
      } finally {
        saveInFlightRef.current = false;
        setIsPublishing(false);
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          persistDraft();
        }
      }
    },
    [
      token,
      distributionMode,
      sendEmailsPreference,
      buildPayload,
      sendPostPayload,
      draftMeta,
      navigate,
      persistDraft,
      openInfoModal,
    ]
  );

  const applyCodeBlockLanguageAttributes = useCallback(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance || editorInstance.isDestroyed) {
      return;
    }

    const { state, view } = editorInstance;
    if (!state || !view) {
      return;
    }

    state.doc.descendants((node, pos) => {
      if (node.type?.name !== "codeBlock") {
        return;
      }

      const dom = view.nodeDOM(pos);
      if (!dom || !(dom instanceof HTMLElement)) {
        return;
      }

      const normalizedLanguage =
        normalizeCodeLanguage(node.attrs?.language) || "plaintext";
      dom.setAttribute("data-language", normalizedLanguage);
    });
  }, []);

  useEffect(() => {
    editorRef.current = editor;

    return () => {
      if (editorRef.current === editor) {
        editorRef.current = null;
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!token) {
      setAutoSaveEnabled(true);
      setSendEmailsPreference(true);
      if (!initialPostIdentifier) {
        setDistributionMode((previous) => previous || "AUTO_EMAIL");
      }
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to load settings.");
        }

        if (cancelled) {
          return;
        }

        const nextAutoSave =
          typeof data.autoSave === "boolean" ? data.autoSave : true;
        const nextSendEmails =
          typeof data.sendEmails === "boolean" ? data.sendEmails : true;

        setAutoSaveEnabled(nextAutoSave);
        setSendEmailsPreference(nextSendEmails);

        if (!initialPostIdentifier) {
          setDistributionMode(nextSendEmails ? "AUTO_EMAIL" : "PROMPT");
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [token, initialPostIdentifier]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (pendingDocRef.current) {
      const doc = pendingDocRef.current;
      pendingDocRef.current = null;
      editor.commands.setContent(doc, false);
      editor.commands.focus("end");
      setIsEditorEmpty(editor.isEmpty);
      applyCodeBlockLanguageAttributes();
      setHasPendingChanges(false);
    }
  }, [editor, applyCodeBlockLanguageAttributes]);

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

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    const applyLanguageAttributes = () => {
      applyCodeBlockLanguageAttributes();
    };

    editor.on("create", applyLanguageAttributes);
    editor.on("update", applyLanguageAttributes);
    editor.on("selectionUpdate", applyLanguageAttributes);
    applyLanguageAttributes();

    return () => {
      editor.off("create", applyLanguageAttributes);
      editor.off("update", applyLanguageAttributes);
      editor.off("selectionUpdate", applyLanguageAttributes);
    };
  }, [editor, applyCodeBlockLanguageAttributes]);

  useEffect(() => {
    if (!initialPostIdentifier) {
      bootstrappingRef.current = false;
      setBootstrapLoading(false);
      setBootstrapError(null);
      return;
    }

    if (!token) {
      setBootstrapLoading(true);
      return;
    }

    let cancelled = false;

    const loadExistingPost = async () => {
      bootstrappingRef.current = true;
      setBootstrapLoading(true);
      setBootstrapError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${initialPostIdentifier}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to load story.");
        }

        if (cancelled) {
          return;
        }

        setTitle(data.title || "");
        setSubtitle(data.subtitle || "");
        setTags(Array.isArray(data.tags) ? data.tags : []);
        setTagInput("");
        setDraftMeta({
          id: data.id || data._id || initialPostIdentifier,
          slug: data.slug || statePostSlug || null,
        });

        setCoverAsset(normalizeCoverAssetFromPost(data));
        setCoverUploadState({ loading: false, error: null });

        if (data.settingsSnapshot && typeof data.settingsSnapshot.sendEmails === "boolean") {
          setSendEmailsPreference(data.settingsSnapshot.sendEmails);
        }

        if (data.distributionMode) {
          const normalizedDistribution = data.distributionMode
            .toString()
            .trim()
            .toUpperCase();
          setDistributionMode(normalizedDistribution === "PROMPT" ? "PROMPT" : "AUTO_EMAIL");
        }

        const doc = transformContentToDoc(data.content);
        const editorInstance = editorRef.current;
        if (editorInstance) {
          editorInstance.commands.setContent(doc, false);
          editorInstance.commands.focus("end");
          setIsEditorEmpty(editorInstance.isEmpty);
          applyCodeBlockLanguageAttributes();
        } else {
          pendingDocRef.current = doc;
        }

        setLastSavedAt(
          data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now()
        );
        setSaveError(null);
        setBootstrapError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootstrapError(error.message || "Failed to load story.");
      } finally {
        if (!cancelled) {
          bootstrappingRef.current = false;
          setBootstrapLoading(false);
          setIsSaving(false);
        }
      }
    };

    loadExistingPost();

    return () => {
      cancelled = true;
    };
  }, [initialPostIdentifier, statePostSlug, token, applyCodeBlockLanguageAttributes]);

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

  const handleCoverSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!token) {
      setCoverUploadState({ loading: false, error: "Sign in to upload images." });
      event.target.value = "";
      return;
    }

    setCoverUploadState({ loading: true, error: null });

    try {
      const asset = await uploadImage({ file, token, purpose: "cover" });
      setCoverAsset(asset);
      setCoverUploadState({ loading: false, error: null });
      scheduleAutoSave();
    } catch (error) {
      console.error(error);
      setCoverUploadState({
        loading: false,
        error: error.message || "Failed to upload cover image.",
      });
    } finally {
      // reset the input so the same file can be selected again if needed
      event.target.value = "";
    }
  };

  const handleCoverRemove = () => {
    setCoverAsset(null);
    scheduleAutoSave();
  };

  const handlePublish = useCallback(async () => {
    if (!token) {
      setSaveError("Sign in to publish your story.");
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    pendingSaveRef.current = false;
    await waitForActiveSave();

    const resolvedDistributionMode = (distributionMode || (sendEmailsPreference ? "AUTO_EMAIL" : "PROMPT"))
      .toString()
      .trim()
      .toUpperCase() === "PROMPT"
      ? "PROMPT"
      : "AUTO_EMAIL";

    setDistributionMode(resolvedDistributionMode);

    if (resolvedDistributionMode === "PROMPT") {
      pendingPublishRef.current = {
        distributionMode: resolvedDistributionMode,
      };
      setEmailPromptVisible(true);
      return;
    }

    publishStory({
      distributionMode: resolvedDistributionMode,
      shouldSendDistributionEmail: true,
    });
  }, [
    token,
    waitForActiveSave,
    publishStory,
    distributionMode,
    sendEmailsPreference,
  ]);

  const handleEmailPromptDecision = useCallback(
    (shouldSend) => {
      const pending = pendingPublishRef.current;
      pendingPublishRef.current = null;
      if (!pending) {
        setEmailPromptVisible(false);
        return;
      }

      publishStory({
        distributionMode: pending.distributionMode,
        shouldSendDistributionEmail: shouldSend,
      });
    },
    [publishStory]
  );

  const handleEmailPromptCancel = useCallback(() => {
    pendingPublishRef.current = null;
    setEmailPromptVisible(false);
  }, []);

  const handlePreviewClick = useCallback(() => {
    openInfoModal({
      title: "Preview coming soon",
      message:
        "We're building a polished preview experience. In the meantime, publish or save a draft to review your story.",
      primaryLabel: "Close",
    });
  }, [openInfoModal]);

  const headerStatus = useMemo(() => {
    if (bootstrapLoading) {
      return "Loading story…";
    }
    if (isSaving) {
      return "Saving…";
    }
    return formatRelativeTimestamp(lastSavedAt);
  }, [bootstrapLoading, isSaving, lastSavedAt]);

  const insertImageAsset = useCallback(
    async (asset) => {
      if (!editor || !asset) {
        return;
      }

      const displayUrl = asset.displayUrl || asset.secureUrl || asset.originalUrl;
      if (!displayUrl) {
        return;
      }

      const widthCandidate = Number(asset.width);
      const heightCandidate = Number(asset.height);
      const width = Number.isFinite(widthCandidate) && widthCandidate > 0 ? widthCandidate : null;
      const height = Number.isFinite(heightCandidate) && heightCandidate > 0 ? heightCandidate : null;

      const aspectRatioCandidate = Number(asset.aspectRatio);
      const aspectRatio =
        (Number.isFinite(aspectRatioCandidate) && aspectRatioCandidate > 0
          ? aspectRatioCandidate
          : width && height
          ? Number((width / height).toFixed(4))
          : null);

      const attributes = {
        src: displayUrl,
        alt: asset.alt || "",
        title: asset.caption || "",
        width: width || null,
        height: height || null,
        publicId: asset.publicId || null,
        displayUrl,
        originalUrl: asset.originalUrl || displayUrl,
        thumbnailUrl: asset.thumbnailUrl || null,
        placeholderUrl: asset.placeholderUrl || null,
        aspectRatio,
      };

      editor.chain().focus().setImage(attributes).run();
      setInsertMode(null);
      setUrlInput("");
      setIsInsertMenuOpen(false);
      scheduleAutoSave();
    },
    [editor, scheduleAutoSave]
  );

  const insertImage = useCallback(() => {
    setInsertMode("image");
    setUrlInput("");
    setInlineUploadState({ loading: false, error: null });
  }, []);

  const handleInlineUploadClick = useCallback(() => {
    inlineImageInputRef.current?.click();
  }, []);

  const handleInlineFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (!token) {
        setInlineUploadState({ loading: false, error: "Sign in to upload images." });
        event.target.value = "";
        return;
      }

      setInlineUploadState({ loading: true, error: null });

      try {
        const asset = await uploadImage({ file, token, purpose: "inline" });
        await insertImageAsset(asset);
        setInlineUploadState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setInlineUploadState({
          loading: false,
          error: error.message || "Failed to upload image.",
        });
      } finally {
        event.target.value = "";
      }
    },
    [insertImageAsset, token]
  );

  const handleImageUrlSubmit = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) {
      return;
    }

    setInlineUploadState({ loading: false, error: null });

    try {
      await insertImageAsset({
        displayUrl: url,
        originalUrl: url,
      });
    } catch (error) {
      console.error(error);
      setInlineUploadState({
        loading: false,
        error: "Unable to insert image from that URL.",
      });
    }
  }, [insertImageAsset, urlInput]);

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

  const bubbleMenuShouldShow = useCallback(({ editor: activeEditor, view }) => {
    if (!activeEditor || activeEditor.isDestroyed) {
      return false;
    }

    const editorView = view || activeEditor.view;
    if (!editorView || !editorView.dom) {
      return false;
    }

    if (!editorView.docView || typeof editorView.docView.domFromPos !== "function") {
      return false;
    }

    const { state } = activeEditor;
    if (!state || !state.selection) {
      return false;
    }

    const { from, to } = state.selection;
    if (from === to) {
      return false;
    }

    const docSize = state.doc?.content?.size ?? 0;
    if (docSize <= 0 || from < 0 || to < 0 || from > docSize || to > docSize) {
      return false;
    }

    return typeof editorView.hasFocus === "function" ? editorView.hasFocus() : true;
  }, []);

  return (
    <div className="write-page">
      {emailPromptVisible && (
        <div className="write-modal" role="dialog" aria-modal="true" aria-labelledby="emailPromptTitle">
          <div className="write-modal__backdrop" onClick={handleEmailPromptCancel} />
          <div
            className="write-modal__content"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="emailPromptTitle">Notify your followers?</h2>
            <p>
              Would you like us to email your followers about this newly published story?
              You can always skip this step if you'd rather share manually.
            </p>
            <div className="write-modal__actions">
              <button type="button" className="write-modal__btn write-modal__btn--primary" onClick={() => handleEmailPromptDecision(true)}>
                Notify followers
              </button>
              <button type="button" className="write-modal__btn" onClick={() => handleEmailPromptDecision(false)}>
                Skip email
              </button>
              <button type="button" className="write-modal__close" onClick={handleEmailPromptCancel} aria-label="Cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {infoModal && (
        <div className="write-modal" role="dialog" aria-modal="true" aria-labelledby="infoModalTitle">
          <div className="write-modal__backdrop" onClick={closeInfoModal} />
          <div
            className="write-modal__content"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="infoModalTitle">{infoModal.title}</h2>
            <p>{infoModal.message}</p>
            <div className="write-modal__actions">
              <button
                type="button"
                className="write-modal__btn write-modal__btn--primary"
                onClick={handleInfoModalPrimary}
              >
                {infoModal.primaryLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {navigationPromptState && (
        <div className="write-modal" role="dialog" aria-modal="true" aria-labelledby="navigationPromptTitle">
          <div className="write-modal__backdrop" onClick={dismissNavigationPrompt} />
          <div
            className="write-modal__content"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="navigationPromptTitle">Save draft before leaving?</h2>
            <p>
              Autosave is turned off and you have unsaved changes. Save your draft or stay on this page to keep writing.
            </p>
            <div className="write-modal__actions">
              <button type="button" className="write-modal__btn" onClick={dismissNavigationPrompt}>
                Stay and continue writing
              </button>
              <button type="button" className="write-modal__btn" onClick={handleSaveDraftFromPrompt}>
                Save draft
              </button>
              <button
                type="button"
                className="write-modal__btn write-modal__btn--primary"
                onClick={confirmNavigationPrompt}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
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
            <span>
              Draft in {displayName} — {headerStatus}
            </span>
            {bootstrapError && (
              <span className="write-header__state-message" role="alert">
                {bootstrapError}
              </span>
            )}
            {saveError && (
              <span className="write-header__state-message" role="alert">
                {saveError}
              </span>
            )}
          </div>
        </div>
        <div className="write-header__right">
          <button
            type="button"
            className="write-header__btn"
            onClick={handlePreviewClick}
          >
            Preview
          </button>
          <button
            type="button"
            className="write-header__btn write-header__btn--primary"
            onClick={handlePublish}
            disabled={isPublishing || bootstrapLoading}
          >
            {isPublishing ? "Publishing…" : "Publish"}
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
            className={`write-cover${coverAsset ? " write-cover--filled" : ""}${
              coverUploadState.loading ? " write-cover--loading" : ""
            }`}
          >
            {coverAsset ? (
              <>
                <img
                  src={
                    coverAsset.displayUrl ||
                    coverAsset.secureUrl ||
                    coverAsset.originalUrl
                  }
                  alt={coverAsset.alt || "Cover"}
                />
                {(coverAsset.width || coverAsset.height || coverAsset.aspectRatio) && (
                  <div className="write-cover__meta">
                    {(coverAsset.width || coverAsset.height) && (
                      <span>{`${coverAsset.width ? `${coverAsset.width}px` : "?"} × ${coverAsset.height ? `${coverAsset.height}px` : "?"}`}</span>
                    )}
                    {typeof coverAsset.aspectRatio === "number" && (
                      <span>{` • ${coverAsset.aspectRatio.toFixed(2)}`}</span>
                    )}
                  </div>
                )}
                <div className="write-cover__actions">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploadState.loading}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleCoverRemove}
                    disabled={coverUploadState.loading}
                  >
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
                  disabled={coverUploadState.loading}
                >
                  {coverUploadState.loading ? "Uploading…" : "Upload"}
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
            {coverUploadState.error && (
              <p className="write-cover__status write-cover__status--error">
                {coverUploadState.error}
              </p>
            )}
          </div>

          <div className="write-fields">
            <textarea
              ref={titleInputRef}
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
                    setInlineUploadState({ loading: false, error: null });
                    setIsInsertMenuOpen((prev) => !prev);
                  }}
                  aria-expanded={isInsertMenuOpen}
                  aria-label="Insert options"
                >
                  {isInsertMenuOpen ? "×" : "+"}
                </button>
                {isInsertMenuOpen && (
                  <>
                    <div className="write-plus__options">
                    {insertMode === "image-link" ? (
                      <div className="write-plus__url">
                        <input
                          className="write-plus__url-input"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleImageUrlSubmit();
                            }
                            if (e.key === "Escape") {
                              setInsertMode("image");
                            }
                          }}
                          placeholder="Paste image URL"
                        />
                        <button
                          type="button"
                          className="write-plus__url-confirm"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={handleImageUrlSubmit}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="write-plus__url-cancel"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setUrlInput("");
                            setInlineUploadState({ loading: false, error: null });
                            setInsertMode("image");
                          }}
                          aria-label="Cancel"
                        >
                          ×
                        </button>
                      </div>
                    ) : insertMode === "video" ? (
                      <div className="write-plus__url">
                        <input
                          className="write-plus__url-input"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const url = urlInput.trim();
                              if (!url) return;
                              editor.chain().focus().setYoutubeVideo({ src: url }).run();
                              setInsertMode(null);
                              setUrlInput("");
                              setIsInsertMenuOpen(false);
                            }
                            if (e.key === "Escape") {
                              setInsertMode(null);
                            }
                          }}
                          placeholder="Paste video URL"
                        />
                        <button
                          type="button"
                          className="write-plus__url-confirm"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const url = urlInput.trim();
                            if (!url) return;
                            editor.chain().focus().setYoutubeVideo({ src: url }).run();
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
                    ) : insertMode === "embed" ? (
                      <div className="write-plus__url">
                        <input
                          className="write-plus__url-input"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const url = urlInput.trim();
                              if (!url) return;
                              editor
                                .chain()
                                .focus()
                                .insertContent({
                                  type: "blockquote",
                                  content: [{ type: "text", text: url }],
                                })
                                .run();
                              setInsertMode(null);
                              setUrlInput("");
                              setIsInsertMenuOpen(false);
                            }
                            if (e.key === "Escape") {
                              setInsertMode(null);
                            }
                          }}
                          placeholder="Paste link to embed"
                        />
                        <button
                          type="button"
                          className="write-plus__url-confirm"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const url = urlInput.trim();
                            if (!url) return;
                            editor
                              .chain()
                              .focus()
                              .insertContent({
                                type: "blockquote",
                                content: [{ type: "text", text: url }],
                              })
                              .run();
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
                    ) : insertMode === "image" ? (
                      <div className="write-plus__image-options">
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={handleInlineUploadClick}
                          aria-label="Upload image"
                          disabled={inlineUploadState.loading}
                        >
                          {inlineUploadState.loading ? "Uploading…" : "Upload image"}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setInlineUploadState({ loading: false, error: null });
                            setUrlInput("");
                            setInsertMode("image-link");
                          }}
                          aria-label="Paste image URL"
                        >
                          Paste image URL
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
                    {inlineUploadState.error && (
                      <p className="write-plus__status write-plus__status--error">
                        {inlineUploadState.error}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <input
              ref={inlineImageInputRef}
              type="file"
              accept="image/*"
              className="write-inline-image-input"
              onChange={handleInlineFileChange}
              aria-hidden="true"
            />

            {editor && !editor.isDestroyed && editor.view && editor.view.docView &&
              typeof editor.view.docView.domFromPos === "function" &&
              bubbleMenuItems.length > 0 && (
              <BubbleMenu
                editor={editor}
                shouldShow={bubbleMenuShouldShow}
                tippyOptions={{ duration: 120 }}
              >
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
                  {editor.isActive("codeBlock") &&
                    (() => {
                      const activeCodeLanguage =
                        normalizeCodeLanguage(
                          editor.getAttributes("codeBlock").language
                        ) || "plaintext";

                      return (
                        <div className="write-code-toolbar">
                          <select
                            className="write-code-lang"
                            value={activeCodeLanguage}
                            onChange={(event) => {
                              const nextLanguage =
                                normalizeCodeLanguage(event.target.value) ||
                                "plaintext";
                              editor
                                .chain()
                                .focus()
                                .updateAttributes("codeBlock", {
                                  language: nextLanguage,
                                })
                                .run();
                              scheduleAutoSave();
                            }}
                          >
                            {codeLanguageOptions.map((lang) => (
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
                      );
                    })()}
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
