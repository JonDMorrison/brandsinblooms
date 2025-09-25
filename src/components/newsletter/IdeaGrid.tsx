import React, { useState } from 'react';
import { IdeaCard } from './IdeaCard';
import { NewsletterIdea } from '@/types/newsletter';
import { cn } from '@/lib/utils';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface IdeaGridProps {
  ideas: NewsletterIdea[];
  onSelectIdea: (idea: NewsletterIdea) => void;
  loading?: boolean;
  className?: string;
}

const IdeaCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-3xl aspect-[3/4] animate-pulse">
    {/* Gradient Background */}
    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 opacity-90" />
    
    {/* Content */}
    <div className="relative z-10 h-full flex flex-col justify-between p-6 text-white">
      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl animate-pulse"></div>
        <div className="space-y-2 w-full">
          <div className="h-6 w-3/4 bg-white/20 rounded mx-auto"></div>
          <div className="h-4 w-full bg-white/20 rounded"></div>
          <div className="h-4 w-2/3 bg-white/20 rounded mx-auto"></div>
        </div>
        <div className="h-10 w-32 bg-white/20 rounded-full"></div>
      </div>
      
      {/* Bottom accent */}
      <div className="flex justify-center mt-4">
        <div className="w-12 h-1 bg-white/30 rounded-full">
          <div className="w-6 h-1 bg-white rounded-full"></div>
        </div>
      </div>
    </div>
    
    {/* Labels */}
    <div className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
      <div className="w-12 h-3 bg-white/20 rounded"></div>
    </div>
  </div>
);

export const IdeaGrid: React.FC<IdeaGridProps> = ({ 
  ideas, 
  onSelectIdea, 
  loading = false, 
  className 
}) => {
  // Start with the first slide
  const initialSlide = 0;
  const [currentSlide, setCurrentSlide] = useState(initialSlide);

  if (loading) {
    return (
      <div className={cn("py-8", className)}>
        <Swiper
          modules={[Navigation, Pagination]}
          grabCursor={true}
          centeredSlides={true}
            slidesPerView={5.2}
            spaceBetween={16}
            initialSlide={0}
            pagination={{
              clickable: true,
              bulletClass: 'swiper-pagination-bullet',
              bulletActiveClass: 'swiper-pagination-bullet-active',
              dynamicBullets: true,
            }}
            breakpoints={{
              320: {
                slidesPerView: 2.2,
                spaceBetween: 12,
              },
              640: {
                slidesPerView: 3.2,
                spaceBetween: 14,
              },
              768: {
                slidesPerView: 4.2,
                spaceBetween: 16,
              },
              1024: {
                slidesPerView: 5.2,
                spaceBetween: 20,
              },
            }}
          className="!pb-16 newsletter-idea-slider"
          style={{
            '--swiper-pagination-color': '#22c55e',
            '--swiper-pagination-bullet-inactive-color': 'rgba(0, 0, 0, 0.3)',
            '--swiper-pagination-bullet-inactive-opacity': '1',
            '--swiper-pagination-bullet-size': '8px',
            '--swiper-pagination-bullet-horizontal-gap': '4px'
          } as React.CSSProperties}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <SwiperSlide key={index} className="!h-auto">
              <div className="scale-95 opacity-70">
                <IdeaCardSkeleton />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    );
  }

  if (ideas.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📧</div>
        <h3 className="text-lg font-medium mb-2">No ideas available</h3>
        <p className="text-sm text-muted-foreground">
          Try describing what kind of newsletter you'd like to create
        </p>
      </div>
    );
  }

  console.log('📧 IdeaGrid: Rendering with', ideas.length, 'ideas, initialSlide:', initialSlide);

  return (
    <div className={cn("py-8 relative", className)}>
      <div className="max-w-6xl mx-auto">
        <div className="h-full w-full relative">
          <Swiper
            modules={[Navigation, Pagination]}
            grabCursor={true}
            centeredSlides={true}
            slidesPerView={5.2}
            spaceBetween={16}
            initialSlide={initialSlide}
            pagination={{
              clickable: true,
              bulletClass: 'swiper-pagination-bullet',
              bulletActiveClass: 'swiper-pagination-bullet-active',
              dynamicBullets: true,
            }}
            onSlideChange={(swiper) => setCurrentSlide(swiper.activeIndex)}
            breakpoints={{
              320: {
                slidesPerView: 2.2,
                spaceBetween: 12,
              },
              640: {
                slidesPerView: 3.2,
                spaceBetween: 14,
              },
              768: {
                slidesPerView: 4.2,
                spaceBetween: 16,
              },
              1024: {
                slidesPerView: 5.2,
                spaceBetween: 20,
              },
            }}
            className="!pb-16 newsletter-idea-slider !h-[calc(100vh-120px)] !relative !z-40"
            style={{
              '--swiper-pagination-color': '#22c55e',
              '--swiper-pagination-bullet-inactive-color': 'rgba(255, 255, 255, 0.3)',
              '--swiper-pagination-bullet-inactive-opacity': '1',
              '--swiper-pagination-bullet-size': '8px',
              '--swiper-pagination-bullet-horizontal-gap': '4px'
            } as React.CSSProperties}
          >
            {ideas.map((idea, index) => {
              const isActive = index === currentSlide;
              return (
                <SwiperSlide key={idea.id} className="!h-auto !relative !z-50 !bg-transparent">
                  <div className="h-full w-full relative z-50 flex items-center justify-center">
                    <IdeaCard
                      idea={idea}
                      onSelect={onSelectIdea}
                      isActive={isActive}
                      slideIndex={index}
                      className="h-full w-full max-w-[280px]"
                    />
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
    </div>
  );
};