
import { useState } from "react";
import { toast } from "sonner";
import { generatePersonalizedContent } from "../TaskGenerationUtils";
import { useAuth } from "@/contexts/AuthContext";

interface ContentType {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  bgColor: string;
}

export const useUpcomingContentModal = (week: any, onTaskUpdate?: () => void) => {
  const { user } = useAuth();
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [generatingContent, setGeneratingContent] = useState<Record<string, boolean>>({});
  const [approvedContent, setApprovedContent] = useState<Record<string, boolean>>({});
  const [editingContent, setEditingContent] = useState<Record<string, boolean>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [socialMediaModal, setSocialMediaModal] = useState<{ 
    isOpen: boolean; 
    platform: 'facebook' | 'instagram' | null; 
    content: string 
  }>({
    isOpen: false,
    platform: null,
    content: ''
  });

  const handleGenerateContent = async (contentType: ContentType) => {
    if (!week || !user) return;
    
    setGeneratingContent(prev => ({ ...prev, [contentType.id]: true }));
    
    try {
      console.log(`Generating ${contentType.name} for theme: ${week.theme}, description: ${week.description}`);
      
      const content = await generatePersonalizedContent(
        contentType.id,
        week.theme,
        user.id,
        week.description
      );
      
      console.log(`Generated content for ${contentType.name}:`, content);
      
      setGeneratedContent(prev => ({ 
        ...prev, 
        [contentType.id]: content 
      }));
      
      toast.success(`${contentType.name} content generated successfully!`);
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error(`Failed to generate ${contentType.name} content. Please try again.`);
    } finally {
      setGeneratingContent(prev => ({ ...prev, [contentType.id]: false }));
    }
  };

  const handleEditContent = (contentType: ContentType) => {
    setEditingContent(prev => ({ ...prev, [contentType.id]: true }));
    setEditedContent(prev => ({
      ...prev,
      [contentType.id]: generatedContent[contentType.id] || ''
    }));
  };

  const handleSaveEdit = (contentType: ContentType) => {
    const newContent = editedContent[contentType.id];
    if (newContent) {
      setGeneratedContent(prev => ({
        ...prev,
        [contentType.id]: newContent
      }));
      setEditingContent(prev => ({ ...prev, [contentType.id]: false }));
      toast.success(`${contentType.name} content updated!`);
    }
  };

  const handleCancelEdit = (contentType: ContentType) => {
    setEditingContent(prev => ({ ...prev, [contentType.id]: false }));
    setEditedContent(prev => ({
      ...prev,
      [contentType.id]: generatedContent[contentType.id] || ''
    }));
  };

  const handleCopyContent = (contentType: ContentType) => {
    const content = generatedContent[contentType.id];
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success(`${contentType.name} copied to clipboard!`);
    }
  };

  const handleApproveContent = (contentType: ContentType) => {
    setApprovedContent(prev => ({ ...prev, [contentType.id]: true }));
    toast.success(`${contentType.name} approved!`);
  };

  const handleSocialMediaPost = (contentType: ContentType) => {
    const content = generatedContent[contentType.id];
    if (!content) return;

    setSocialMediaModal({
      isOpen: true,
      platform: contentType.id as 'facebook' | 'instagram',
      content: content
    });
  };

  const handleEditedContentChange = (contentTypeId: string, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [contentTypeId]: value
    }));
  };

  const closeSocialMediaModal = () => {
    setSocialMediaModal({ isOpen: false, platform: null, content: '' });
  };

  return {
    generatedContent,
    generatingContent,
    approvedContent,
    editingContent,
    editedContent,
    socialMediaModal,
    handleGenerateContent,
    handleEditContent,
    handleSaveEdit,
    handleCancelEdit,
    handleCopyContent,
    handleApproveContent,
    handleSocialMediaPost,
    handleEditedContentChange,
    closeSocialMediaModal
  };
};
