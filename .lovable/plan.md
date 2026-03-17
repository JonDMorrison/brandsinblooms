

## Add Vimeo Video Section to Landing Page

### What will change
A new section will be added to the public landing/home page featuring an embedded Vimeo video and a headline about how BloomSuite helps garden centers thrive year-round.

### Where it will appear
The video section will be placed **after the Hero Section and before the Problem/Agitation Section**, giving visitors an immediate visual overview of the product right after the main headline.

### New file
**`src/components/landing/VideoShowcaseSection.tsx`**
- Headline: something like *"Built to Help Garden Centers Thrive All Year Long"*
- A supporting subtitle line for context
- Embedded Vimeo player (responsive iframe from `https://player.vimeo.com/video/1165759043`) with 16:9 aspect ratio
- Styled consistently with the existing landing page sections (same padding, max-width, background treatment)

### Updated file
**`src/components/landing/CompleteLandingPage.tsx`**
- Import the new `VideoShowcaseSection` component
- Insert it between `<HeroSection />` and `<ProblemAgitationSection />`

### Technical details

**VideoShowcaseSection component structure:**
```
Section container (py-24 px-6, matching other sections)
  max-w-5xl centered
    Headline (text-4xl font-bold, text-accent)
    Subtitle (text-xl, text-muted-foreground)
    Responsive video wrapper (aspect-video, rounded-2xl, shadow)
      Vimeo iframe (src="https://player.vimeo.com/video/1165759043")
```

**CompleteLandingPage order after change:**
1. LandingPageHeader
2. HeroSection
3. **VideoShowcaseSection** (new)
4. ProblemAgitationSection
5. GuideSection
6. BenefitsSection
7. DifferentiatorsSection
8. PricingPreviewSection
9. FinalCTASection

### Build error note
The existing build error (`npm:@supabase/supabase-js@2.7.1`) is unrelated to this change and affects edge functions only. This landing page update is purely frontend and will not be impacted by that error.
