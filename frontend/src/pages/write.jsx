import React, { useState } from 'react';
// import api from '../api'; // Adjust path as needed
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import './write.css';


export default function Write({ postId, authorId }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const editor = useEditor({
  extensions: [StarterKit],
  content: '',
});


  const handleCoverUpload = async (e) => {
    // const file = e.target.files[0];
    // if (!file) return;
    // const form = new FormData();
    // form.append('file', file);
    // try {
    //   const res = await api.post('/posts/upload', form);
    //   setCoverImageUrl(res.data.url);
    //   return res.data.url;
    // } catch (err) {
    //   console.error(err);
    // }
  };

  const handlePublish = async () => {
    // if (!editor) return;
    // const content = editor.getJSON();
    // const payload = {
    //   id: postId,
    //   title,
    //   subtitle,
    //   content,
    //   tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
    //   coverImage: coverImageUrl,
    //   authorId,
    // };
    // try {
    //   await api.post('/posts/publish', payload);
    //   alert('Published!');
    // } catch (err) {
    //   console.error(err);
    //   alert('Publish failed');
    // }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="text-4xl font-bold w-full"
        />
        <button
          onClick={handlePublish}
          className="ml-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Publish
        </button>
      </div>

      <input
        value={subtitle}
        onChange={e => setSubtitle(e.target.value)}
        placeholder="Subtitle"
        className="w-full mb-2"
      />

      <div className="mb-4">
        <input type="file" onChange={handleCoverUpload} />
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt="cover"
            className="mt-2 max-h-52 w-full object-cover"
          />
        )}
      </div>

      <input
        placeholder="tags (comma separated)"
        value={tagsText}
        onChange={e => setTagsText(e.target.value)}
        className="w-full mb-4"
      />

      <div className="border p-4 min-h-[300px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}