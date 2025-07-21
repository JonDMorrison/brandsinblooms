import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { EditableText } from './EditableText';
import { MediaSelectorImage } from './MediaSelectorImage';

interface LayoutTemplateProps {
  block: ContentBlock;
  className?: string;
  editable?: boolean;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
}

export const Layout1: React.FC<LayoutTemplateProps> = ({ block, className = '', editable = false, onUpdate }) => (
  <div className={`layout-1 flex items-start gap-6 ${className}`}>
    <div className="w-1/2">
      {editable ? (
        <MediaSelectorImage 
          src={block.imageUrl} 
          onChange={(src, metadata) => onUpdate?.({ 
            imageUrl: src,
            ...(metadata?.alt_text && { title: metadata.alt_text })
          })}
          contentContext={block.title || block.content}
        />
      ) : (
        block.imageUrl ? (
          <img 
            src={block.imageUrl} 
            alt={block.title || 'Image'} 
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
            Image
          </div>
        )
      )}
    </div>
    <div className="w-1/2 space-y-2">
      {editable ? (
        <>
          <EditableText 
            value={block.title || 'Heading'} 
            className="text-lg font-semibold text-gray-800" 
            onChange={(title) => onUpdate?.({ title })} 
          />
          <EditableText 
            value={block.content || 'This is a text block next to an image on the left.'} 
            className="text-gray-600 leading-relaxed" 
            onChange={(content) => onUpdate?.({ content })} 
          />
          {(block.ctaText || block.ctaUrl) && (
            <EditableText 
              value={block.ctaText || 'Call to Action'} 
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors" 
              onChange={(ctaText) => onUpdate?.({ ctaText })} 
            />
          )}
        </>
      ) : (
        <>
          {block.title && (
            <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
          )}
          {block.content && (
            <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
          )}
          {block.ctaText && block.ctaUrl && (
            <a 
              href={block.ctaUrl}
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {block.ctaText}
            </a>
          )}
        </>
      )}
    </div>
  </div>
);

export const Layout2: React.FC<LayoutTemplateProps> = ({ block, className = '', editable = false, onUpdate }) => (
  <div className={`layout-2 flex items-start gap-6 ${className}`}>
    <div className="w-1/2 space-y-2">
      {editable ? (
        <>
          <EditableText 
            value={block.title || 'Heading'} 
            className="text-lg font-semibold text-gray-800" 
            onChange={(title) => onUpdate?.({ title })} 
          />
          <EditableText 
            value={block.content || 'This is a text block next to an image on the right.'} 
            className="text-gray-600 leading-relaxed" 
            onChange={(content) => onUpdate?.({ content })} 
          />
          {(block.ctaText || block.ctaUrl) && (
            <EditableText 
              value={block.ctaText || 'Call to Action'} 
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors" 
              onChange={(ctaText) => onUpdate?.({ ctaText })} 
            />
          )}
        </>
      ) : (
        <>
          {block.title && (
            <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
          )}
          {block.content && (
            <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
          )}
          {block.ctaText && block.ctaUrl && (
            <a 
              href={block.ctaUrl}
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {block.ctaText}
            </a>
          )}
        </>
      )}
    </div>
    <div className="w-1/2">
      {editable ? (
        <MediaSelectorImage 
          src={block.imageUrl} 
          onChange={(src, metadata) => onUpdate?.({ 
            imageUrl: src,
            ...(metadata?.alt_text && { title: metadata.alt_text })
          })}
          contentContext={block.title || block.content}
        />
      ) : (
        block.imageUrl ? (
          <img 
            src={block.imageUrl} 
            alt={block.title || 'Image'} 
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
            Image
          </div>
        )
      )}
    </div>
  </div>
);

export const Layout3: React.FC<LayoutTemplateProps> = ({ block, className = '', editable = false, onUpdate }) => (
  <div className={`layout-3 flex gap-6 items-start ${className}`}>
    <div className="w-1/4">
      {editable ? (
        <MediaSelectorImage 
          src={block.imageUrl} 
          onChange={(src, metadata) => onUpdate?.({ 
            imageUrl: src,
            ...(metadata?.alt_text && { title: metadata.alt_text })
          })}
          contentContext={block.title || block.content}
        />
      ) : (
        block.imageUrl ? (
          <img 
            src={block.imageUrl} 
            alt={block.title || 'Image'} 
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
            Image
          </div>
        )
      )}
    </div>
    <div className="w-3/4 space-y-2">
      {editable ? (
        <>
          <EditableText 
            value={block.title || 'Heading'} 
            className="text-lg font-semibold text-gray-800" 
            onChange={(title) => onUpdate?.({ title })} 
          />
          <EditableText 
            value={block.content || 'Tall image on the left with wide text content on the right.'} 
            className="text-gray-600 leading-relaxed" 
            onChange={(content) => onUpdate?.({ content })} 
          />
          {(block.ctaText || block.ctaUrl) && (
            <EditableText 
              value={block.ctaText || 'Call to Action'} 
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors" 
              onChange={(ctaText) => onUpdate?.({ ctaText })} 
            />
          )}
        </>
      ) : (
        <>
          {block.title && (
            <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
          )}
          {block.content && (
            <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
          )}
          {block.ctaText && block.ctaUrl && (
            <a 
              href={block.ctaUrl}
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {block.ctaText}
            </a>
          )}
        </>
      )}
    </div>
  </div>
);

export const Layout4: React.FC<LayoutTemplateProps> = ({ block, className = '', editable = false, onUpdate }) => (
  <div className={`layout-4 flex gap-6 items-start ${className}`}>
    <div className="w-3/4 space-y-2">
      {editable ? (
        <>
          <EditableText 
            value={block.title || 'Heading'} 
            className="text-lg font-semibold text-gray-800" 
            onChange={(title) => onUpdate?.({ title })} 
          />
          <EditableText 
            value={block.content || 'Tall image on the right with wide text content on the left.'} 
            className="text-gray-600 leading-relaxed" 
            onChange={(content) => onUpdate?.({ content })} 
          />
          {(block.ctaText || block.ctaUrl) && (
            <EditableText 
              value={block.ctaText || 'Call to Action'} 
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors" 
              onChange={(ctaText) => onUpdate?.({ ctaText })} 
            />
          )}
        </>
      ) : (
        <>
          {block.title && (
            <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
          )}
          {block.content && (
            <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
          )}
          {block.ctaText && block.ctaUrl && (
            <a 
              href={block.ctaUrl}
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {block.ctaText}
            </a>
          )}
        </>
      )}
    </div>
    <div className="w-1/4">
      {editable ? (
        <MediaSelectorImage 
          src={block.imageUrl} 
          onChange={(src, metadata) => onUpdate?.({ 
            imageUrl: src,
            ...(metadata?.alt_text && { title: metadata.alt_text })
          })}
          contentContext={block.title || block.content}
        />
      ) : (
        block.imageUrl ? (
          <img 
            src={block.imageUrl} 
            alt={block.title || 'Image'} 
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
            Image
          </div>
        )
      )}
    </div>
  </div>
);

export const Layout6: React.FC<LayoutTemplateProps> = ({ block, className = '', editable = false, onUpdate }) => (
  <div className={`layout-6 text-center ${className}`}>
    {editable ? (
      <div className="space-y-2">
        <EditableText 
          value={block.title || 'Main Title'} 
          className="text-xl font-semibold text-gray-800" 
          onChange={(title) => onUpdate?.({ title })} 
        />
        <EditableText 
          value={block.content || 'Supporting paragraph content below the title.'} 
          className="text-gray-600 leading-relaxed max-w-2xl mx-auto" 
          onChange={(content) => onUpdate?.({ content })} 
        />
        {(block.ctaText || block.ctaUrl) && (
          <EditableText 
            value={block.ctaText || 'Call to Action'} 
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors" 
            onChange={(ctaText) => onUpdate?.({ ctaText })} 
          />
        )}
      </div>
    ) : (
      <>
        {block.title && (
          <h3 className="text-xl font-semibold mb-2 text-gray-800">{block.title}</h3>
        )}
        {block.content && (
          <p className="text-gray-600 mb-4 leading-relaxed max-w-2xl mx-auto">{block.content}</p>
        )}
        {block.ctaText && block.ctaUrl && (
          <a 
            href={block.ctaUrl}
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors"
          >
            {block.ctaText}
          </a>
        )}
      </>
    )}
  </div>
);

export const Layout7: React.FC<LayoutTemplateProps> = ({ block, className = '', editable = false, onUpdate }) => (
  <div className={`layout-7 text-center ${className}`}>
    {editable ? (
      <div className="space-y-2">
        <EditableText 
          value={block.title || 'Main Title'} 
          className="text-xl font-semibold text-gray-800" 
          onChange={(title) => onUpdate?.({ title })} 
        />
        <EditableText 
          value={block.content || 'Supporting paragraph one.\nSupporting paragraph two.'} 
          className="text-gray-600 leading-relaxed max-w-2xl mx-auto" 
          onChange={(content) => onUpdate?.({ content })} 
        />
        {(block.ctaText || block.ctaUrl) && (
          <EditableText 
            value={block.ctaText || 'Call to Action'} 
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors" 
            onChange={(ctaText) => onUpdate?.({ ctaText })} 
          />
        )}
      </div>
    ) : (
      <>
        {block.title && (
          <h3 className="text-xl font-semibold mb-3 text-gray-800">{block.title}</h3>
        )}
        {block.content && (
          <div className="space-y-2 mb-4">
            {block.content.split('\n').filter(line => line.trim()).map((line, index) => (
              <p key={index} className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
                {line.trim()}
              </p>
            ))}
          </div>
        )}
        {block.ctaText && block.ctaUrl && (
          <a 
            href={block.ctaUrl}
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors"
          >
            {block.ctaText}
          </a>
        )}
      </>
    )}
  </div>
);
