-- First, clear existing master templates
DELETE FROM master_campaign_templates;

-- Insert 52 weeks of unique, seasonally appropriate themes
INSERT INTO master_campaign_templates (week_number, title, theme, seasonal_focus, content_ideas, target_audience_notes) VALUES
(1, 'New Year Garden Planning', 'Fresh Start: Planning Your Garden Year', 'Winter planning and goal setting', 'Share garden planning worksheets, seed catalogs, and yearly garden goals. Focus on inspiration and preparation for the growing season ahead.', 'Gardeners excited about planning their best year yet'),
(2, 'Indoor Seed Starting Setup', 'Winter Seed Starting Success', 'Indoor growing preparation', 'Show seed starting setups, grow lights, and early varieties. Share tips for successful germination and creating the perfect indoor growing environment.', 'Both beginners and experienced gardeners preparing for spring'),
(3, 'Tool Maintenance & Organization', 'Winter Tool Care & Garden Organization', 'Equipment preparation and storage', 'Feature tool cleaning, sharpening, and organization systems. Show proper storage techniques and tool inventory checklists.', 'All gardeners looking to maintain their equipment'),
(4, 'Houseplant Care in Winter', 'Indoor Garden Winter Wellness', 'Indoor plant care during cold months', 'Focus on houseplant care, humidity management, and dealing with winter plant stress. Share propagation techniques and plant care schedules.', 'Indoor plant enthusiasts and winter gardeners'),

-- February
(5, 'Seed Catalog Planning', 'Dream Big: Seed Selection Season', 'Late winter planning and ordering', 'Help customers choose the right varieties for their climate and space. Feature new and heirloom varieties, succession planting schedules.', 'Gardeners finalizing their growing plans'),
(6, 'Pruning Fundamentals', 'Late Winter Pruning Mastery', 'Dormant season tree and shrub care', 'Show proper pruning techniques for fruit trees, ornamentals, and shrubs. Emphasize timing and tool selection for healthy cuts.', 'Homeowners with established landscapes'),
(7, 'Greenhouse & Cold Frame Prep', 'Season Extension Strategies', 'Protected growing preparation', 'Feature greenhouse management, cold frame construction, and season extension techniques. Show temperature monitoring and ventilation.', 'Serious gardeners extending their season'),
(8, 'Soil Testing & Amendment', 'Foundation First: Healthy Soil Prep', 'Late winter soil preparation', 'Emphasize soil testing, organic amendments, and composting. Show how to interpret soil tests and create improvement plans.', 'Gardeners preparing for spring planting'),

-- March
(9, 'Early Spring Awakening', 'Spring Prep: Garden Emergence', 'Early spring garden preparation', 'Focus on garden cleanup, early pest monitoring, and preparing beds for planting. Show spring garden checklists and timing guides.', 'Eager gardeners ready to start the season'),
(10, 'Cool Season Crop Planting', 'Cool Weather Champions', 'Early spring planting opportunities', 'Feature cool-season vegetables like lettuce, peas, and radishes. Show succession planting and protection techniques for early crops.', 'Vegetable gardeners wanting early harvests'),
(11, 'Lawn Spring Startup', 'Lawn Renewal & Spring Care', 'Early lawn care and renovation', 'Cover spring lawn care, overseeding, fertilization, and early weed control. Show proper mowing height and equipment preparation.', 'Homeowners focused on lawn health'),
(12, 'Container Garden Planning', 'Portable Paradise: Container Success', 'Container gardening strategies', 'Feature container selection, soil mixes, and plant combinations. Show drainage, watering systems, and space-saving techniques.', 'Urban gardeners and those with limited space'),

-- April
(13, 'Spring Planting Festival', 'The Great Spring Planting', 'Main spring planting season', 'Celebrate the peak planting time with comprehensive planting guides, timing charts, and success strategies for spring crops.', 'All gardeners during peak planting season'),
(14, 'Pest Prevention & IPM', 'Smart Pest Management Starts Now', 'Early season pest and disease prevention', 'Focus on integrated pest management, beneficial insects, and early intervention strategies. Show monitoring techniques and organic controls.', 'Proactive gardeners preventing problems'),
(15, 'Water-Wise Garden Design', 'Drought-Smart Garden Planning', 'Water conservation and efficiency', 'Feature drought-tolerant plants, efficient irrigation, and water conservation techniques. Show xeriscaping and rain garden designs.', 'Environmentally conscious gardeners'),
(16, 'Native Plant Celebration', 'Going Native: Local Plant Power', 'Native plant gardening benefits', 'Highlight native plants for local ecosystems, wildlife support, and low maintenance. Show design ideas and establishment tips.', 'Eco-friendly gardeners and wildlife enthusiasts'),

-- May
(17, 'Mother\'s Day Garden Gifts', 'Blooming Gifts for Garden Lovers', 'Gift-giving and garden appreciation', 'Feature garden gift ideas, beautiful plant arrangements, and ways to share the gardening passion with loved ones.', 'Gift-givers and garden enthusiasts'),
(18, 'Warm Season Transition', 'Heat Lovers: Warm Season Setup', 'Transition to warm season crops', 'Focus on warm-season vegetables, flower transplants, and heat protection strategies. Show timing for tender crops and summer annuals.', 'Gardeners expanding into summer crops'),
(19, 'Mulching Mastery', 'Mulch Magic: Soil Protection', 'Mulching techniques and benefits', 'Show different mulch types, application techniques, and benefits for soil health, moisture retention, and weed suppression.', 'All gardeners looking to improve soil health'),
(20, 'Companion Planting', 'Garden Partnerships That Work', 'Strategic plant combinations', 'Feature beneficial plant combinations, succession planting, and maximizing garden space through smart partnerships.', 'Vegetable gardeners optimizing their space'),

-- June
(21, 'Summer Garden Establishment', 'Summer Strong: Heat Season Prep', 'Early summer garden management', 'Focus on summer care routines, heat protection, and maintaining healthy growth during warming weather.', 'Gardeners adapting to summer conditions'),
(22, 'Father\'s Day Garden Projects', 'DIY Garden Projects for Dad', 'Garden construction and projects', 'Feature tool reviews, garden structures, and hands-on projects that appeal to the builder mentality.', 'DIY enthusiasts and practical gardeners'),
(23, 'Peak Growing Season Care', 'Garden at Its Prime', 'Mid-season maintenance and care', 'Show ongoing care techniques, pruning, feeding, and maintaining productive gardens during peak growing time.', 'Active gardeners maintaining their plots'),
(24, 'Harvest & Preservation Prep', 'Getting Ready for Garden Bounty', 'Early harvest preparation', 'Prepare for upcoming harvests with preservation techniques, storage solutions, and processing equipment recommendations.', 'Gardeners anticipating their first harvests'),

-- July
(25, 'Mid-Summer Harvest Festival', 'Garden Bounty Celebration', 'Peak harvest season', 'Celebrate the abundance of mid-summer harvests, share recipes, preservation techniques, and ways to enjoy the garden\'s productivity.', 'Gardeners enjoying their harvest success'),
(26, 'Heat Stress Management', 'Beating the Summer Heat', 'Hot weather plant protection', 'Focus on protecting plants from heat stress, efficient watering, shade solutions, and maintaining plant health in extreme heat.', 'Gardeners dealing with summer heat challenges'),
(27, 'Water Management Systems', 'Smart Watering for Summer Success', 'Irrigation and water efficiency', 'Feature drip irrigation, soaker hoses, watering schedules, and drought management strategies for summer gardens.', 'Water-conscious gardeners in hot climates'),
(28, 'Summer Flower Power', 'Blooms That Beat the Heat', 'Heat-tolerant flowering plants', 'Showcase summer-blooming flowers, heat-tolerant varieties, and maintaining colorful displays through the hottest months.', 'Gardeners wanting continuous summer color'),

-- August
(29, 'Late Summer Succession', 'Extending the Growing Season', 'Late summer planting opportunities', 'Focus on fall crop planting, succession planting techniques, and extending productive seasons into autumn.', 'Strategic gardeners planning ahead'),
(30, 'Preservation & Storage', 'Capturing Summer\'s Abundance', 'Food preservation and storage', 'Share canning, freezing, dehydrating, and root cellar storage techniques for preserving the summer harvest.', 'Self-sufficient gardeners preserving their bounty'),
(31, 'Pest & Disease Mid-Season', 'Mid-Season Garden Health Check', 'Summer pest and disease management', 'Address common summer problems, organic treatment options, and maintaining plant health during stress periods.', 'Gardeners maintaining healthy crops'),
(32, 'Seed Saving Fundamentals', 'Saving Seeds for Next Year', 'Seed collection and preservation', 'Show seed saving techniques, proper drying and storage, and selecting the best plants for seed collection.', 'Self-reliant gardeners building seed stocks'),

-- September
(33, 'Fall Garden Transition', 'Autumn Awakening: Fall Garden Prep', 'Transition to fall growing', 'Focus on fall garden preparation, cool-season crop establishment, and adapting gardens for autumn productivity.', 'Gardeners extending their growing season'),
(34, 'School Garden Education', 'Learning Gardens: Education Through Growing', 'Educational gardening and family involvement', 'Feature school gardens, teaching kids to garden, and educational aspects of growing food and flowers.', 'Parents, teachers, and educational gardeners'),
(35, 'Autumn Color Planning', 'Fall Foliage & Seasonal Interest', 'Ornamental fall garden design', 'Showcase fall-blooming plants, autumn foliage, and creating seasonal interest through the changing seasons.', 'Ornamental gardeners planning fall displays'),
(36, 'Fall Planting Season', 'Autumn Planting Advantages', 'Fall establishment benefits', 'Explain benefits of fall planting for trees, shrubs, and perennials. Show proper techniques and timing for fall establishment.', 'Landscapers and long-term garden planners'),

-- October
(37, 'Halloween Garden Magic', 'Spooky Season Garden Fun', 'Halloween and autumn celebration', 'Feature pumpkins, gourds, autumn decorations, and creating festive fall displays from garden produce.', 'Families and decorative gardeners'),
(38, 'Harvest Festival Celebration', 'Celebrating the Garden Harvest', 'Peak autumn harvest time', 'Celebrate the fall harvest with storage crops, winter squash, and techniques for enjoying autumn\'s abundance.', 'Gardeners celebrating their autumn success'),
(39, 'Winter Prep Checklist', 'Garden Winterization Essentials', 'Preparing gardens for winter', 'Comprehensive winterization checklists, plant protection, tool storage, and preparing gardens for dormant season.', 'All gardeners preparing for winter'),
(40, 'Leaf Management & Composting', 'Fall Leaves: Garden Gold', 'Utilizing autumn leaves', 'Show leaf composting, mulching techniques, and turning autumn cleanup into garden resources for next year.', 'Environmentally conscious gardeners'),

-- November
(41, 'Thanksgiving Garden Gratitude', 'Grateful for Garden Abundance', 'Thanksgiving and garden appreciation', 'Reflect on the gardening year, share gratitude practices, and celebrate the journey from seed to harvest.', 'Reflective gardeners appreciating their efforts'),
(42, 'Late Fall Cleanup', 'Final Fall Garden Tasks', 'End-of-season garden maintenance', 'Focus on final cleanup tasks, disease prevention, and setting gardens up for healthy spring emergence.', 'Thorough gardeners finishing the season well'),
(43, 'Winter Protection Strategies', 'Shielding Plants from Winter', 'Plant protection and winter care', 'Show winter protection techniques for tender plants, proper mulching, and ensuring plant survival through cold weather.', 'Gardeners in cold climates protecting investments'),
(44, 'Planning Next Year\'s Garden', 'Dreaming and Planning Ahead', 'Garden planning and reflection', 'Encourage garden journaling, evaluating the current year, and beginning plans for an even better next season.', 'Forward-thinking gardeners planning improvements'),

-- December
(45, 'Holiday Garden Decorations', 'Festive Garden & Home Decor', 'Holiday decorating with natural materials', 'Feature natural holiday decorations, evergreen arrangements, and bringing garden elements into holiday celebrations.', 'Creative gardeners decorating for holidays'),
(46, 'Winter Solstice Garden Reflection', 'Longest Night, Shortest Day', 'Winter solstice and garden rest', 'Reflect on the garden\'s dormant period, plan for increasing light, and celebrate the turning point toward spring.', 'Contemplative gardeners connecting with seasons'),
(47, 'Holiday Gifts for Gardeners', 'Perfect Presents for Plant Lovers', 'Holiday gift ideas and garden tools', 'Feature the best garden tools, books, and gifts for gardening enthusiasts during the holiday gift-giving season.', 'Gift-givers shopping for garden lovers'),
(48, 'Year-End Garden Review', 'Celebrating Garden Successes', 'Annual garden evaluation', 'Encourage documenting successes, learning from challenges, and celebrating the completed growing season.', 'Gardeners reflecting on their growing year'),

-- Late December/Early January buffer weeks
(49, 'Winter Garden Maintenance', 'Quiet Season Garden Care', 'Dormant season care and planning', 'Focus on winter garden care, protecting plants, and using the quiet season for tool maintenance and planning.', 'Dedicated gardeners maintaining through winter'),
(50, 'Greenhouse & Indoor Growing', 'Winter Growing Under Cover', 'Protected growing during winter', 'Feature greenhouse management, indoor growing systems, and maintaining productivity during the coldest months.', 'Year-round growers and greenhouse enthusiasts'),
(51, 'Seed Catalog Season Returns', 'New Year Seed Dreams', 'Planning with fresh catalogs', 'Return to seed catalog browsing with fresh perspective, incorporating lessons learned from the completed growing season.', 'Gardeners planning with experience'),
(52, 'Garden Goals & Resolutions', 'Setting Garden Intentions', 'New Year garden planning', 'Help gardeners set realistic goals, plan improvements, and approach the new growing season with purpose and excitement.', 'Goal-oriented gardeners planning their best year yet');

-- Now update existing campaigns to align with proper weekly themes
-- First, get campaigns that are on Mondays and update them to match the proper weekly themes
UPDATE campaigns 
SET 
  title = mct.title,
  theme = mct.theme,
  description = mct.content_ideas,
  prompt = COALESCE(mct.seasonal_focus, mct.content_ideas)
FROM master_campaign_templates mct
WHERE 
  campaigns.week_number = mct.week_number
  AND EXTRACT(DOW FROM campaigns.start_date) = 1  -- Monday
  AND campaigns.start_date >= CURRENT_DATE - INTERVAL '7 days'  -- Only update recent/upcoming campaigns
  AND campaigns.deleted_at IS NULL;