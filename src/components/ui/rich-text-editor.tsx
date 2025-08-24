import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Indent,
  Outdent
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  showToolbar?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  onChange,
  placeholder = 'Start writing...',
  className = '',
  editorClassName = '',
  showToolbar = true,
  onFocus,
  onBlur,
  autoFocus = false
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable underline from StarterKit to avoid conflicts
        underline: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      }),
      Underline,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl max-w-none focus:outline-none',
          'min-h-[100px] p-3 text-sm',
          editorClassName
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && autoFocus) {
      editor.commands.focus();
    }
  }, [editor, autoFocus]);

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    tooltip, 
    children, 
    className: buttonClassName = '' 
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    tooltip: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn("h-8 w-8 p-0", buttonClassName)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );

  if (!editor) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("border border-input rounded-md bg-background", className)}>
        {showToolbar && (
          <div className="border-b border-border p-2 flex flex-wrap gap-1">
            {/* Text Formatting */}
            <div className="flex gap-1 border-r border-border pr-2 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                tooltip="Bold (Ctrl+B)"
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                tooltip="Italic (Ctrl+I)"
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                tooltip="Underline (Ctrl+U)"
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarButton>
            </div>

            {/* Lists */}
            <div className="flex gap-1 border-r border-border pr-2 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                tooltip="Bullet List"
              >
                <List className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                tooltip="Numbered List"
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
            </div>

            {/* Indentation */}
            <div className="flex gap-1 border-r border-border pr-2 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().liftListItem('listItem').run()}
                tooltip="Outdent"
                disabled={!editor.can().liftListItem('listItem')}
              >
                <Outdent className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
                tooltip="Indent"
                disabled={!editor.can().sinkListItem('listItem')}
              >
                <Indent className="h-4 w-4" />
              </ToolbarButton>
            </div>

            {/* Text Alignment */}
            <div className="flex gap-1 border-r border-border pr-2 mr-2">
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                tooltip="Align Left"
              >
                <AlignLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                tooltip="Align Center"
              >
                <AlignCenter className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                tooltip="Align Right"
              >
                <AlignRight className="h-4 w-4" />
              </ToolbarButton>
            </div>

            {/* Undo/Redo */}
            <div className="flex gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                tooltip="Undo (Ctrl+Z)"
              >
                <Undo className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                tooltip="Redo (Ctrl+Y)"
              >
                <Redo className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </div>
        )}
        <EditorContent 
          editor={editor} 
          className={cn("min-h-[100px]", !showToolbar && "p-3")}
        />
        {!content && (
          <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};