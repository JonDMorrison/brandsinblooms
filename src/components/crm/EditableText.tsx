import { useState } from 'react';

export const EditableText = ({ 
  value = 'Click to edit', 
  className = '', 
  onChange 
}: {
  value?: string;
  className?: string;
  onChange?: (val: string) => void;
}) => {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);

  return editing ? (
    <textarea
      className={`w-full border p-2 rounded ${className}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onChange?.(text);
      }}
      autoFocus
    />
  ) : (
    <div
      className={`cursor-pointer ${className}`}
      onClick={() => setEditing(true)}
    >
      {text}
    </div>
  );
};