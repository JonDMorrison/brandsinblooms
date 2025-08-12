import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
import { supabase } from '@/integrations/supabase/client';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

interface NewsletterBlock {
  title: string;
  body: string;
  cta?: string;
  link?: string;
  image_prompt?: string;
  alt_text?: string;
}

interface NewsletterEditorProps {
  yamlContent: string;
  onSave: (updatedYaml: string) => void;
  onCancel: () => void;
}

export const NewsletterEditor: React.FC<NewsletterEditorProps> = ({
  yamlContent,
  onSave,
  onCancel
}) => {
  const [header, setHeader] = useState('');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<NewsletterBlock[]>([]);
  const [theme, setTheme] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('#');

  // Fetch company website from profile
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('company_profiles')
            .select('location_info')
            .eq('user_id', user.id)
            .single();
          
          if (profile?.location_info) {
            // Try to extract website from location_info or use a default pattern
            const websiteMatch = profile.location_info.match(/https?:\/\/[^\s]+/);
            if (websiteMatch) {
              setCompanyWebsite(websiteMatch[0]);
            } else if (profile.location_info.includes('.com') || profile.location_info.includes('.ca')) {
              // Simple fallback for domain names
              const domain = profile.location_info.trim();
              setCompanyWebsite(domain.startsWith('http') ? domain : `https://${domain}`);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching company profile:', error);
      }
    };

    fetchCompanyProfile();
  }, []);

  useEffect(() => {
    // Parse the YAML content to extract editable fields
    try {
      const processed = processNewsletterContent(yamlContent);
      
      if (processed.isStructured && processed.blocks.length > 0) {
        // Extract title and header from newsletter_md
        const lines = processed.newsletter_md.split('\n');
        const titleLine = lines.find(line => line.trim().startsWith('#'));
        const headerText = lines.slice(1).join('\n').trim();
        
        setTitle(titleLine ? titleLine.replace(/^#+\s*/, '').trim() : '');
        setHeader(headerText);
        setBlocks(processed.blocks);
        setTheme(processed.meta.theme);
      } else {
        // Handle unstructured content by creating initial structure
        const lines = yamlContent.split('\n');
        const titleLine = lines.find(line => line.trim().startsWith('#'));
        const bodyText = lines.filter(line => !line.trim().startsWith('#')).join('\n').trim();
        
        setTitle(titleLine ? titleLine.replace(/^#+\s*/, '').trim() : 'Newsletter Title');
        setHeader(bodyText);
        setBlocks([
          {
            title: 'Welcome',
            body: 'Welcome to our newsletter...',
            cta: 'Learn More',
            link: companyWebsite,
            image_prompt: 'garden newsletter welcome',
            alt_text: 'Welcome image'
          }
        ]);
        setTheme('Garden Newsletter');
      }
    } catch (error) {
      console.error('Error parsing newsletter content:', error);
      // Set default values
      setTitle('Newsletter Title');
      setHeader('Welcome to our newsletter...');
      setBlocks([
        {
          title: 'Welcome',
          body: 'Welcome to our newsletter...',
          cta: 'Learn More',
          link: companyWebsite,
          image_prompt: 'garden newsletter welcome',
          alt_text: 'Welcome image'
        }
      ]);
      setTheme('Garden Newsletter');
    }
  }, [yamlContent]);

  const updateBlock = (index: number, field: keyof NewsletterBlock, value: string) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], [field]: value };
    setBlocks(updated);
  };

  const addBlock = () => {
    const newBlock: NewsletterBlock = {
      title: 'New Section',
      body: 'Add your content here...',
      cta: 'Learn More',
      link: companyWebsite,
      image_prompt: `garden ${theme.toLowerCase()}`,
      alt_text: 'Section image'
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    if (blocks.length > 1) {
      setBlocks(blocks.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    // Reconstruct the YAML structure
    const newsletterMd = `# ${title}\n\n${header}`;
    
    const yamlStructure = {
      newsletter_md: newsletterMd,
      blocks: blocks.map(block => ({
        type: 'text',
        title: block.title,
        body: block.body,
        cta: block.cta || 'Learn More',
        link: block.link || companyWebsite,
        image_prompt: block.image_prompt || `garden ${block.title.toLowerCase()}`,
        alt_text: block.alt_text || `Image for ${block.title}`
      })),
      meta: {
        reading_time: `${Math.max(1, Math.ceil((newsletterMd + blocks.map(b => b.body).join(' ')).split(' ').length / 200))} min`,
        theme: theme || 'Garden Newsletter',
        week_focus: title
      },
      extra_content_ideas: [
        "Seasonal gardening tips",
        "Plant care reminders",
        "New product features"
      ]
    };

    // Convert to YAML string format that matches the expected structure
    const yamlString = `newsletter_md: |
  ${newsletterMd.split('\n').map(line => `  ${line}`).join('\n')}

blocks:
${yamlStructure.blocks.map(block => `  - type: ${block.type}
    title: "${block.title}"
    body: |
      ${block.body.split('\n').map(line => `      ${line}`).join('\n')}
    cta: "${block.cta}"
    link: "${block.link}"
    image_prompt: "${block.image_prompt}"
    alt_text: "${block.alt_text}"`).join('\n')}

meta:
  reading_time: "${yamlStructure.meta.reading_time}"
  theme: "${yamlStructure.meta.theme}"
  week_focus: "${yamlStructure.meta.week_focus}"

extra_content_ideas:
${yamlStructure.extra_content_ideas.map(idea => `  - "${idea}"`).join('\n')}`;

    onSave(yamlString);
  };

  return (
    <div className="space-y-6">
      {/* Newsletter Header */}
      <Card>
        <CardHeader>
          <CardTitle>Newsletter Header</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Newsletter Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter newsletter title..."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="theme">Theme</Label>
            <Input
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Newsletter theme..."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="header">Introduction</Label>
            <RichTextEditor
              content={header}
              onChange={setHeader}
              placeholder="Write your newsletter introduction..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Newsletter Blocks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Content Sections</h3>
          <Button onClick={addBlock} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
        </div>

        {blocks.map((block, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Section {index + 1}</CardTitle>
                {blocks.length > 1 && (
                  <Button
                    onClick={() => removeBlock(index)}
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`title-${index}`}>Section Title</Label>
                <Input
                  id={`title-${index}`}
                  value={block.title}
                  onChange={(e) => updateBlock(index, 'title', e.target.value)}
                  placeholder="Section title..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`body-${index}`}>Content</Label>
                <RichTextEditor
                  content={block.body}
                  onChange={(val) => updateBlock(index, 'body', val)}
                  placeholder="Section content..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`cta-${index}`}>Call-to-Action Text (Optional)</Label>
                  <Input
                    id={`cta-${index}`}
                    value={block.cta || ''}
                    onChange={(e) => updateBlock(index, 'cta', e.target.value)}
                    placeholder="e.g., Learn More, Get Started (leave blank for text-only)"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`link-${index}`}>Link URL (Optional)</Label>
                  <Input
                    id={`link-${index}`}
                    value={block.link || ''}
                    onChange={(e) => updateBlock(index, 'link', e.target.value)}
                    placeholder={`e.g., ${companyWebsite} (leave blank for no link)`}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                💡 Call-to-Action text and links can be left blank if you don't want clickable buttons. When left blank, content will display as text-only sections.
              </p>
              <div>
                <Label htmlFor={`image-${index}`}>Image Description</Label>
                <Input
                  id={`image-${index}`}
                  value={block.image_prompt || ''}
                  onChange={(e) => updateBlock(index, 'image_prompt', e.target.value)}
                  placeholder="Describe the image for this section..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save/Cancel Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
          Save Newsletter
        </Button>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
};