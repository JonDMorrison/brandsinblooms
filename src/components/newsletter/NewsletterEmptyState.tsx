import React, { useState, useEffect } from 'react';
import { useTypingEffect } from '@/hooks/useTypingEffect';
import { DisplayMedium, BodyMedium } from '@/components/ui/typography';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import { Sparkles, Calendar, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NewsletterIdea } from '@/types/newsletter';
import { Button } from '@/components/ui/button';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';

interface NewsletterEmptyStateProps {
  onPromptClick?: (prompt: string) => void;
  onSelectIdea?: (idea: NewsletterIdea) => void;
}

export const NewsletterEmptyState: React.FC<NewsletterEmptyStateProps> = ({ onPromptClick, onSelectIdea }) => {
  const { user } = useAuth();
  const [weeklyThemes, setWeeklyThemes] = useState<NewsletterIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch 52 weekly themes from campaigns table
  useEffect(() => {
    const fetchWeeklyThemes = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('📋 Fetching 52 weekly themes for empty state...');
        
        const { data: campaigns, error } = await supabase
          .from('campaigns')
          .select('week_number, title, theme, description, prompt')
          .not('week_number', 'is', null)
          .gte('week_number', 1)
          .lte('week_number', 52)
          .order('week_number', { ascending: true });

        if (error) throw error;

        if (campaigns && campaigns.length > 0) {
          const themes: NewsletterIdea[] = campaigns.map((campaign) => ({
            id: `weekly-theme-${campaign.week_number}`,
            title: campaign.theme || campaign.title || `Week ${campaign.week_number}`,
            description: campaign.description || campaign.prompt || `Weekly theme for week ${campaign.week_number}`,
            category: 'weekly' as const,
            badge: `Week ${campaign.week_number}`,
            weekNumber: campaign.week_number,
            templateBlocks: [
              { 
                type: 'header', 
                title: campaign.theme || campaign.title || `Week ${campaign.week_number}` 
              },
              { 
                type: 'text', 
                content: campaign.description || campaign.prompt || 'Weekly themed content for your newsletter.' 
              }
            ],
            heroQuery: (campaign.theme || campaign.title || 'weekly newsletter')
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ''),
            estimatedReadTime: '5 min'
          }));
          
          setWeeklyThemes(themes);
          console.log(`✅ Loaded ${themes.length} weekly themes in empty state`);
        }
      } catch (err) {
        console.error('Error fetching weekly themes:', err);
        setError(err instanceof Error ? err.message : 'Failed to load weekly themes');
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyThemes();
  }, [user]);

  const handleThemeSelect = (theme: NewsletterIdea) => {
    if (onSelectIdea) {
      onSelectIdea(theme);
    }
  };

  const handleAIPromptClick = (prompt: string) => {
    if (onPromptClick) {
      onPromptClick(prompt);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] px-8 text-center space-y-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-teal"></div>
        <div className="space-y-2">
          <DisplayMedium className="text-brand-teal">Loading Weekly Themes</DisplayMedium>
          <p className="text-muted-foreground">Preparing 52 curated newsletter ideas...</p>
        </div>
      </div>
    );
  }

  if (error || weeklyThemes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] px-8 text-center space-y-8">
        <div className="space-y-2">
          <DisplayMedium className="text-brand-teal">Create Custom Newsletter Ideas</DisplayMedium>
          <p className="text-muted-foreground">Tell us what kind of newsletter you'd like to create</p>
        </div>
        
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <input
              type="text"
              placeholder="E.g., Weekly tech updates for developers..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  if (target.value.trim()) {
                    handleAIPromptClick(target.value);
                    target.value = '';
                  }
                }
              }}
            />
            <Button 
              className="w-full"
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement;
                if (input?.value.trim()) {
                  handleAIPromptClick(input.value);
                  input.value = '';
                }
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Ideas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-8 text-center space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <DisplayMedium className="text-brand-teal leading-tight">
          52 Weekly Themes
        </DisplayMedium>
        <p className="text-muted-foreground text-lg">
          Choose from professionally curated newsletter themes for every week of the year
        </p>
      </div>

      {/* Weekly Themes Grid */}
      <div className="w-full max-w-6xl">
        <Swiper
          modules={[Navigation, Autoplay]}
          spaceBetween={20}
          slidesPerView="auto"
          grabCursor={true}
          centeredSlides={false}
          navigation={{
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
          }}
          autoplay={{
            delay: 4000,
            disableOnInteraction: true,
            pauseOnMouseEnter: true
          }}
          className="weekly-themes-slider !pb-12 !pt-8 [&_.swiper-button-next]:!bg-white [&_.swiper-button-prev]:!bg-white [&_.swiper-button-next]:!text-brand-teal [&_.swiper-button-prev]:!text-brand-teal [&_.swiper-button-next]:!w-12 [&_.swiper-button-prev]:!w-12 [&_.swiper-button-next]:!h-12 [&_.swiper-button-prev]:!h-12 [&_.swiper-button-next]:!rounded-full [&_.swiper-button-prev]:!rounded-full [&_.swiper-button-next]:!shadow-lg [&_.swiper-button-prev]:!shadow-lg [&_.swiper-button-next]:!border [&_.swiper-button-prev]:!border [&_.swiper-button-next]:!border-gray-200 [&_.swiper-button-prev]:!border-gray-200"
          breakpoints={{
            320: {
              slidesPerView: 1,
              spaceBetween: 16,
            },
            640: {
              slidesPerView: 2,
              spaceBetween: 18,
            },
            768: {
              slidesPerView: 3,
              spaceBetween: 20,
            },
            1024: {
              slidesPerView: 4,
              spaceBetween: 24,
            },
          }}
        >
          {weeklyThemes.map((theme, index) => (
            <SwiperSlide key={theme.id} className="!h-auto !w-80">
              <div 
                className="group cursor-pointer h-full"
                onClick={() => handleThemeSelect(theme)}
              >
                <div className="bg-white border border-gray-200 rounded-xl p-6 h-full flex flex-col shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand-teal/50 hover:-translate-y-1 group-hover:bg-gradient-to-br group-hover:from-brand-teal/5 group-hover:to-brand-teal/10">
                  {/* Week Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-brand-teal/10 text-brand-teal px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Week {theme.weekNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">{theme.estimatedReadTime}</div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold text-gray-900 leading-tight group-hover:text-brand-teal transition-colors">
                      {theme.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                      {theme.description}
                    </p>
                  </div>
                  
                  {/* Action */}
                  <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-xs text-brand-teal font-medium flex items-center gap-2">
                      <span>Use this theme</span>
                      <div className="w-4 h-4 rounded-full bg-brand-teal/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-brand-teal rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Custom AI Option */}
      <div className="w-full max-w-md">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-600">Need something custom?</p>
          <input
            type="text"
            placeholder="Describe your newsletter idea..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement;
                if (target.value.trim()) {
                  handleAIPromptClick(target.value);
                  target.value = '';
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};