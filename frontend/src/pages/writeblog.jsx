import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import html from "highlight.js/lib/languages/xml";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Blockquote from "@tiptap/extension-blockquote";
// import BubbleMenuExtension from "@tiptap/extension-bubble-menu"; // REMOVE THIS LINE
import "./writeblog.css";

export default function WriteBlog() {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState([]);
  const [coverImage, setCoverImage] = useState(null);

  const lowlight = createLowlight();
  lowlight.register("html", html);
  lowlight.register("js", javascript);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Image,
      Youtube.configure({
        width: 640,
        height: 360,
      }),
      Link.configure({
        openOnClick: true,
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({
        placeholder: "Tell your story...",
      }),
      HorizontalRule,
      Blockquote,
      // BubbleMenuExtension, // REMOVE THIS LINE
    ],
    content: "",
  });

  const handlePublish = () => {
    const content = editor?.getHTML();
    console.log({
      title,
      tags,
      content,
      coverImage,
    });
    // TODO: send to backend API here
  };

  const handleAddImage = () => {
    const url = prompt("Enter image URL:");
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  const handleAddVideo = () => {
    const url = prompt("Enter YouTube video URL:");
    if (url) editor?.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  return (
    <div className="writeblog-container">
      <div className="writeblog-header">
        <span className="writeblog-draft">Draft in Bilal Qamar</span>
        <button className="writeblog-publish-btn" onClick={handlePublish}>
          Publish
        </button>
      </div>

      <div className="writeblog-main">
        <input
          type="text"
          className="writeblog-title-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="writeblog-toolbar">
          <button onClick={handleAddImage}>🖼️ Image</button>
          <button onClick={handleAddVideo}>🎥 Video</button>
          <button
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            ― Divider
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            {"</>"} Code
          </button>
        </div>

        <div className="writeblog-editor-wrapper">
          {editor && (
            <BubbleMenu editor={editor} className="bubble-menu">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive("bold") ? "is-active" : ""}
              >
                B
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive("italic") ? "is-active" : ""}
              >
                I
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive("blockquote") ? "is-active" : ""}
              >
                “”
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive("bulletList") ? "is-active" : ""}
              >
                ••
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive("orderedList") ? "is-active" : ""}
              >
                1.
              </button>
            </BubbleMenu>
          )}

          <EditorContent editor={editor} className="writeblog-editor-content" />
        </div>
      </div>
    </div>
  );
}