
import React from 'react';

interface ParsedMarkdownProps {
  content: string;
}

export const ParsedMarkdown = ({ content }: ParsedMarkdownProps) => {
  // Simple markdown parsing for newsletter content
  const parseMarkdown = (text: string) => {
    // Convert markdown headers to HTML
    let parsed = text
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags if not already wrapped
    if (!parsed.startsWith('<h') && !parsed.startsWith('<p>')) {
      parsed = '<p>' + parsed + '</p>';
    }
    
    return parsed;
  };

  return (
    <div 
      className="prose-content"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} 
    />
  );
};
