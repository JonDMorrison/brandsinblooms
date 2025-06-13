
export const getFallbackThemes = () => {
  const currentWeek = Math.ceil(
    ((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  );
  
  const month = new Date().getMonth() + 1;
  let seasonalThemes;
  
  if (month >= 3 && month <= 5) {
    // Spring themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Spring Growth Strategy - Week ${currentWeek}`,
        description: 'Harness the energy of spring renewal to drive customer engagement with fresh marketing approaches, new product launches, and revitalized brand messaging.',
        content_ideas: [
          'Fresh marketing strategy rollouts',
          'New product or service launches',
          'Brand refresh and messaging updates',
          'Customer engagement campaigns'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Innovation & Renewal Campaign`,
        description: 'Focus on innovation and business renewal with forward-thinking strategies that capture the spirit of growth and new beginnings.',
        content_ideas: [
          'Innovation showcase content',
          'Process improvement highlights',
          'Team development spotlights',
          'Future vision communications'
        ]
      }
    ];
  } else if (month >= 6 && month <= 8) {
    // Summer themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Summer Success Campaign - Week ${currentWeek}`,
        description: 'Maximize peak season opportunities with high-energy marketing, customer retention strategies, and community engagement that captures summer enthusiasm.',
        content_ideas: [
          'Peak performance strategies',
          'Customer success stories',
          'Community engagement activities',
          'High-energy promotional content'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Peak Performance Focus`,
        description: 'Emphasize peak performance and results-driven content that showcases your business at its best during the high-activity summer season.',
        content_ideas: [
          'Performance metric highlights',
          'Success milestone celebrations',
          'Customer testimonials',
          'Results-driven case studies'
        ]
      }
    ];
  } else if (month >= 9 && month <= 11) {
    // Autumn themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Autumn Achievement Focus - Week ${currentWeek}`,
        description: 'Celebrate accomplishments and prepare for year-end success with strategic campaigns that showcase results and build momentum for the future.',
        content_ideas: [
          'Achievement celebrations',
          'Year-end goal tracking',
          'Strategic planning content',
          'Future preparation activities'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Strategic Planning Season`,
        description: 'Focus on strategic planning and preparation with content that positions your business for continued success and growth.',
        content_ideas: [
          'Strategic planning insights',
          'Goal setting frameworks',
          'Business planning resources',
          'Growth strategy development'
        ]
      }
    ];
  } else {
    // Winter themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Winter Planning & Vision - Week ${currentWeek}`,
        description: 'Transform quiet season into strategic advantage with forward-thinking content, planning resources, and vision-setting activities that prepare for future growth.',
        content_ideas: [
          'Strategic vision development',
          'Planning and preparation focus',
          'Reflection and goal setting',
          'Future opportunity identification'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Vision & Planning Campaign`,
        description: 'Emphasize vision setting and strategic planning with content that prepares your audience for upcoming opportunities and growth.',
        content_ideas: [
          'Vision setting activities',
          'Strategic planning tools',
          'Future growth preparation',
          'Opportunity identification'
        ]
      }
    ];
  }
  
  return seasonalThemes;
};
