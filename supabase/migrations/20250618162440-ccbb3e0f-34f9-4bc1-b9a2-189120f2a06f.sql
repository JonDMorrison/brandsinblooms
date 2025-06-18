
-- First, let's clear any existing sample data and update the schema
DELETE FROM public.holidays;

-- Update the holidays table structure to ensure it matches our needs
ALTER TABLE public.holidays 
DROP COLUMN IF EXISTS garden_relevance;

ALTER TABLE public.holidays 
ADD COLUMN IF NOT EXISTS garden_relevance TEXT;

-- Insert comprehensive 2025 holiday data for garden centers
INSERT INTO public.holidays (holiday_name, holiday_date, description, category, garden_relevance, is_active) VALUES

-- January 2025
('New Year''s Day', '2025-01-01', 'Start of the new year', 'Day', 'New year, new garden resolutions! Perfect time to promote planning tools, garden journals, and early seed starting supplies', true),
('National Bird Feeding Month', '2025-01-01', 'Month dedicated to feeding wild birds', 'Month', 'Promote bird feeders, bird seed, suet, and winter bird houses. Great opportunity for wildlife-friendly garden education', true),
('National House Plant Appreciation Day', '2025-01-10', 'Day to appreciate indoor plants', 'Day', 'Perfect for promoting houseplants, indoor planters, plant care supplies, and educational content about indoor gardening', true),

-- February 2025
('Valentine''s Day', '2025-02-14', 'Day of love and romance', 'Day', 'Promote romantic flowering plants like roses, flowering bulbs for spring, and gift plants for loved ones', true),
('President''s Day', '2025-02-17', 'Federal holiday honoring US presidents', 'Day', 'Long weekend perfect for garden planning and early spring preparation. Promote garden planning tools and early season supplies', true),

-- March 2025
('St. Patrick''s Day', '2025-03-17', 'Irish cultural celebration', 'Day', 'Promote green plants, shamrocks, Irish-themed planters, and green foliage plants for festive decorating', true),
('First Day of Spring', '2025-03-20', 'Spring equinox marking start of spring', 'Day', 'Major gardening season kickoff! Promote spring planting supplies, seeds, soil amendments, and garden tools', true),
('National Garden Month', '2025-04-01', 'Month celebrating gardening', 'Month', 'Peak promotion month for all gardening supplies, tools, plants, and educational workshops', true),

-- April 2025
('Easter Sunday', '2025-04-20', 'Christian holiday celebrating resurrection', 'Day', 'Promote spring flowers, Easter lily plants, colorful annuals, and plants for Easter decorating and gifts', true),
('Earth Day', '2025-04-22', 'Environmental awareness day', 'Day', 'Promote eco-friendly gardening practices, native plants, composting supplies, and sustainable gardening methods', true),
('Arbor Day', '2025-04-25', 'Tree planting and conservation day', 'Day', 'Major tree promotion day! Focus on tree sales, planting supplies, tree care products, and educational tree content', true),

-- May 2025
('May Day', '2025-05-01', 'Spring celebration and workers'' day', 'Day', 'Celebrate spring with flowering plants, hanging baskets, and colorful spring displays', true),
('National Garden Week', '2025-05-05', 'Week promoting gardening benefits', 'Week', 'Intensive week of garden promotion, workshops, demonstrations, and special garden center events', true),
('Mother''s Day', '2025-05-11', 'Day honoring mothers', 'Day', 'Major flower holiday! Promote beautiful flowering plants, hanging baskets, planters, and garden gifts for mom', true),
('World Bee Day', '2025-05-20', 'Day promoting bee conservation', 'Day', 'Promote bee-friendly plants, pollinator gardens, bee houses, and educational content about pollinator support', true),
('Memorial Day', '2025-05-26', 'Day honoring fallen military personnel', 'Day', 'Long weekend marking unofficial start of summer. Promote summer annuals, vegetable starts, and outdoor living plants', true),

-- June 2025
('World Environment Day', '2025-06-05', 'UN day promoting environmental action', 'Day', 'Promote native plants, water-wise gardening, composting, and environmentally sustainable garden practices', true),
('National Rose Month', '2025-06-01', 'Month celebrating roses', 'Month', 'Focus on rose sales, rose care products, rose companion plants, and rose gardening education', true),
('Father''s Day', '2025-06-15', 'Day honoring fathers', 'Day', 'Promote practical garden tools, vegetable gardening supplies, outdoor plants, and garden projects for dad', true),
('Summer Solstice', '2025-06-21', 'Longest day of the year', 'Day', 'Celebrate peak growing season with sun-loving plants, summer flowering displays, and outdoor garden events', true),

-- July 2025
('Independence Day', '2025-07-04', 'American independence celebration', 'Day', 'Promote red, white, and blue flower combinations, patriotic garden displays, and summer entertaining plants', true),
('National Ice Cream Month', '2025-07-01', 'Month celebrating ice cream', 'Month', 'Promote herbs for desserts, berry plants, mint, and plants that enhance summer entertaining', true),

-- August 2025
('National Farmers Market Week', '2025-08-03', 'Week promoting local agriculture', 'Week', 'Partner with local farmers, promote vegetable gardening, herb growing, and farm-to-table gardening', true),

-- September 2025
('Labor Day', '2025-09-01', 'Day honoring American workers', 'Day', 'End of summer transition - promote fall planting, cool season crops, and autumn garden preparation', true),
('National Honey Month', '2025-09-01', 'Month promoting honey and beekeeping', 'Month', 'Promote bee-friendly fall flowers, late-season pollinator plants, and honey bee supporting gardens', true),
('Autumnal Equinox', '2025-09-22', 'First day of fall', 'Day', 'Fall gardening season begins! Promote fall planting, autumn decorations, and winter garden preparation', true),

-- October 2025
('World Vegetarian Day', '2025-10-01', 'Day promoting vegetarian lifestyle', 'Day', 'Promote vegetable gardening, herb growing, and edible landscaping for healthy living', true),
('Columbus Day', '2025-10-13', 'Federal holiday', 'Day', 'Fall gardening weekend - promote fall planting, bulbs for spring, and autumn garden maintenance', true),
('Halloween', '2025-10-31', 'Traditional autumn holiday', 'Day', 'Promote pumpkins, gourds, fall decorations, autumn flowers, and spooky garden displays', true),

-- November 2025
('Thanksgiving', '2025-11-27', 'American harvest celebration', 'Day', 'Promote harvest decorations, fall centerpieces, gratitude gardens, and indoor plants for cozy autumn atmosphere', true),

-- December 2025
('Christmas', '2025-12-25', 'Christian holiday celebration', 'Day', 'Promote Christmas trees, holiday plants like poinsettias, winter decorations, and festive garden displays', true),
('Winter Solstice', '2025-12-21', 'Shortest day of the year', 'Day', 'Promote winter garden interest, evergreen plants, holiday decorations, and indoor gardening for winter', true),

-- Ongoing monthly observances
('National Indoor Plant Month', '2025-01-01', 'January focus on houseplants', 'Month', 'Dedicate January to promoting houseplants, indoor gardening supplies, plant care education, and winter indoor growing', true),
('National Bird Feeding Month', '2025-02-01', 'February focus on bird feeding', 'Month', 'Promote bird feeding supplies, winter bird houses, and creating wildlife-friendly winter gardens', true),
('National Flower Month', '2025-05-01', 'May celebration of flowers', 'Month', 'Peak flower promotion month - showcase flowering plants, cut flowers, and flower garden supplies', true);
