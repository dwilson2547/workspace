import { useRef, useEffect, useCallback } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { attachmentsAPI } from '../services/api';

export default function MarkdownEditor({ 
  wikiId, 
  pageId, 
  initialValue = '', 
  onChange,
  height = '500px',
  placeholder = 'Start writing...'
}) {
  const editorRef = useRef(null);

  // Handle image upload (drag-drop or button)
  const handleImageUpload = useCallback(async (blob, callback) => {
    if (!wikiId || !pageId) {
      console.error('Wiki ID and Page ID required for image upload');
      callback('', 'Upload failed');
      return;
    }

    try {
      const response = await attachmentsAPI.uploadImage(wikiId, pageId, blob);
      const { url } = response.data;
      callback(url, blob.name || 'uploaded image');
    } catch (error) {
      console.error('Image upload failed:', error);
      callback('', 'Upload failed');
    }
  }, [wikiId, pageId]);

  // Handle clipboard paste for images
  useEffect(() => {
    const editorInstance = editorRef.current?.getInstance();
    if (!editorInstance) return;

    const editorEl = editorInstance.getEditorElements().mdEditor;
    if (!editorEl) return;

    const handlePaste = async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          
          const file = item.getAsFile();
          if (!file) continue;

          if (!wikiId || !pageId) {
            console.error('Wiki ID and Page ID required for image paste');
            return;
          }

          try {
            // Show loading placeholder
            const placeholder = `![Uploading ${file.name}...]()`;
            editorInstance.insertText(placeholder);

            const response = await attachmentsAPI.uploadImage(wikiId, pageId, file);
            const { url } = response.data;

            // Replace placeholder with actual image
            const markdown = editorInstance.getMarkdown();
            const newMarkdown = markdown.replace(placeholder, `![${file.name}](${url})`);
            editorInstance.setMarkdown(newMarkdown);
          } catch (error) {
            console.error('Paste image upload failed:', error);
            // Remove the placeholder on error
            const markdown = editorInstance.getMarkdown();
            const newMarkdown = markdown.replace(`![Uploading ${file.name}...]()`, '');
            editorInstance.setMarkdown(newMarkdown);
          }
          
          return;
        }
      }
    };

    editorEl.addEventListener('paste', handlePaste);
    
    return () => {
      editorEl.removeEventListener('paste', handlePaste);
    };
  }, [wikiId, pageId]);

  // Handle content changes
  const handleChange = useCallback(() => {
    const editorInstance = editorRef.current?.getInstance();
    if (editorInstance && onChange) {
      const markdown = editorInstance.getMarkdown();
      onChange(markdown);
    }
  }, [onChange]);

  // Get markdown content
  const getMarkdown = useCallback(() => {
    const editorInstance = editorRef.current?.getInstance();
    return editorInstance ? editorInstance.getMarkdown() : '';
  }, []);

  // Set markdown content
  const setMarkdown = useCallback((markdown) => {
    const editorInstance = editorRef.current?.getInstance();
    if (editorInstance) {
      editorInstance.setMarkdown(markdown);
    }
  }, []);

  // Expose methods via ref
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.getMarkdown = getMarkdown;
      editorRef.current.setMarkdown = setMarkdown;
    }
  }, [getMarkdown, setMarkdown]);

  return (
    <Editor
      ref={editorRef}
      initialValue={initialValue}
      previewStyle="vertical"
      height={height}
      initialEditType="markdown"
      useCommandShortcut={true}
      placeholder={placeholder}
      onChange={handleChange}
      hooks={{
        addImageBlobHook: handleImageUpload
      }}
      toolbarItems={[
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task', 'indent', 'outdent'],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
        ['scrollSync'],
      ]}
    />
  );
}
