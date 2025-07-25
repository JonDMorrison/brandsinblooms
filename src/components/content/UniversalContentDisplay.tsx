import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Eye, Image as ImageIcon, Play, Mail, Calendar } from 'lucide-react';
import { ContentTask, ContentBlock } from '@/types/content';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface UniversalContentDisplayProps {
  task: ContentTask;
  className?: string;
  showMetadata?: boolean;
  onImageSelect?: (blockId: string, image: any) => void;
  editMode?: boolean;
}

export const UniversalContentDisplay: React.FC<UniversalContentDisplayProps> = ({
  task,
  className = '',
  showMetadata = true,
  onImageSelect,
  editMode = false
}) => {
  const { blocks = [], metadata, extra_content_ideas = [] } = task;

  // If no blocks available, show fallback content
  if (!blocks.length) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-muted-foreground">
          <div className="mb-4">
            {React.createElement(getContentIcon(task.post_type), { className: "w-12 h-12 mx-auto opacity-50" })}
          </div>
          <p className="text-lg font-medium mb-2">Content Preview</p>
          <p className="text-sm">This content hasn't been processed into blocks yet.</p>
          {task.ai_output && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg text-left">
              <p className="text-sm whitespace-pre-wrap">{task.ai_output}</p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  const contentIcon = getContentIcon(task.post_type);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with metadata */}
      {showMetadata && (
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {React.createElement(contentIcon, { className: "w-6 h-6 text-primary" })}
              <div>
                <h3 className="font-semibold capitalize">{task.post_type} Content</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  {metadata?.reading_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{metadata.reading_time}</span>
                    </div>
                  )}
                  {metadata?.theme && (
                    <Badge variant="secondary" className="text-xs">
                      {metadata.theme}
                    </Badge>
                  )}
                  {blocks.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{blocks.length} section{blocks.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {metadata?.structured_format && (
              <Badge variant="outline" className="text-xs">
                Structured
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Content blocks */}
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <ContentBlockDisplay
            key={block.id || index}
            block={block}
            index={index}
            task={task}
            onImageSelect={onImageSelect}
            editMode={editMode}
          />
        ))}
      </div>

      {/* Extra content ideas */}
      {extra_content_ideas.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Related Content Ideas</h4>
          <div className="grid gap-2">
            {extra_content_ideas.map((idea, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{idea.title}</p>
                  <p className="text-xs text-muted-foreground">{idea.quick_desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

interface ContentBlockDisplayProps {
  block: ContentBlock;
  index: number;
  task: ContentTask;
  onImageSelect?: (blockId: string, image: any) => void;
  editMode?: boolean;
}

const ContentBlockDisplay: React.FC<ContentBlockDisplayProps> = ({
  block,
  index,
  task,
  onImageSelect,
  editMode
}) => {
  const handleImageSelect = (image: any) => {
    if (onImageSelect && block.id) {
      onImageSelect(block.id, image);
    }
  };

  const getBlockIcon = () => {
    switch (block.block_type) {
      case 'header': return <h1 className="w-4 h-4" />;
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'video_scene': return <Play className="w-4 h-4" />;
      case 'event_item': return <Calendar className="w-4 h-4" />;
      default: return <div className="w-4 h-4 bg-muted rounded" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Block header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getBlockIcon()}
            <h4 className="font-semibold">{block.title}</h4>
            {block.metadata?.scene_type && (
              <Badge variant="outline" className="text-xs">
                {block.metadata.scene_type}
              </Badge>
            )}
          </div>
          {index === 0 && task.post_type === 'video' && block.metadata?.duration && (
            <Badge variant="secondary" className="text-xs">
              {block.metadata.duration}
            </Badge>
          )}
        </div>

        {/* Block content */}
        <div className="prose prose-sm max-w-none">
          <div 
            className="text-sm leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ 
              __html: block.body.replace(/\n/g, '<br/>') 
            }}
          />
        </div>

        {/* Image section */}
        {block.image_prompt && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Suggested Image</span>
            </div>
            
            {editMode ? (
              <MediaSelectorImage
                src=""
                onChange={handleImageSelect}
                contentContext={block.image_prompt || ''}
                className="w-full max-w-md"
              />
            ) : (
              <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Prompt:</strong> {block.image_prompt}
                </p>
                {block.alt_text && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Alt text:</strong> {block.alt_text}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Call-to-action */}
        {block.cta && (
          <div className="pt-4 border-t">
            <Button variant="outline" size="sm" className="text-xs">
              {block.cta}
            </Button>
          </div>
        )}

        {/* Special metadata for different content types */}
        {block.metadata?.hashtags && (
          <div className="pt-2 text-xs text-muted-foreground">
            {block.metadata.hashtags}
          </div>
        )}
      </div>
    </Card>
  );
};

function getContentIcon(postType?: string) {
  switch (postType) {
    case 'instagram':
    case 'facebook':
      return ImageIcon;
    case 'video':
      return Play;
    case 'email':
    case 'newsletter':
      return Mail;
    case 'event':
      return Calendar;
    default:
      return Eye;
  }
}