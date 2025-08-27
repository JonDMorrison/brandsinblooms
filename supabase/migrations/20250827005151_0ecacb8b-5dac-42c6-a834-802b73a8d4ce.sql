-- Insert new focused hydrangea care blocks to replace the overly long content

-- Block 2: pH and Color Management  
INSERT INTO campaign_blocks (campaign_id, block_type, content, order_index)
VALUES (
  'ca1ef432-ef5c-4057-b66c-99b94d082cba',
  'image-text',
  '{
    "headline": "Get the Perfect Hydrangea Colors",
    "body": "<p>Want blue or pink hydrangeas? The secret is in your soil! Acidic conditions (pH 5.0-5.5) produce stunning blue flowers, while alkaline soil (pH 6.0-7.0) creates beautiful pink blooms. A simple soil test helps you determine what amendments to add for your desired colors.</p>",
    "layout": "image-right",
    "textAlign": "left",
    "imageUrl": "https://images.unsplash.com/photo-1594736797933-d0401ba0c522?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NjY3NzZ8MHwxfHNlYXJjaHwyfHx8aHlkcmFuZ2VhJTIwYmx1ZSUyMHBpbmslMjBmbG93ZXJzfGVufDF8Mnx8fDE3NTYyNTU5MzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "altText": "Blue and pink hydrangea flowers showing soil pH effects"
  }',
  2
);

-- Block 3: Watering and Care Tips
INSERT INTO campaign_blocks (campaign_id, block_type, content, order_index)  
VALUES (
  'ca1ef432-ef5c-4057-b66c-99b94d082cba',
  'image-text', 
  '{
    "headline": "Essential August Watering & Care",
    "body": "<p>Water deeply but infrequently to encourage strong root development, especially during dry spells. Look for healthy signs: deep green leaves, sturdy stems, and abundant blooms. Watch for distress signals like wilting, discoloration, or pest activity.</p>",
    "layout": "image-left",
    "textAlign": "left", 
    "imageUrl": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NjY3NzZ8MHwxfHNlYXJjaHwzfHx8aHlkcmFuZ2VhJTIwd2F0ZXJpbmclMjBjYXJlfGVufDF8Mnx8fDE3NTYyNTU5MzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "altText": "Gardener watering hydrangea plants properly"
  }',
  3
);

-- Block 4: Varieties and Call-to-Action
INSERT INTO campaign_blocks (campaign_id, block_type, content, order_index)
VALUES (
  'ca1ef432-ef5c-4057-b66c-99b94d082cba',
  'image-text',
  '{
    "headline": "Expand Your Hydrangea Collection",  
    "body": "<p>August is perfect for planting new varieties! Try \"Endless Summer\" for continuous reblooming or \"Annabelle\" for stunning white globe flowers. Apply slow-release fertilizer now to boost their nutrient intake as they prepare for dormancy.</p><p><strong>Visit our center for expert advice and a wide selection of hydrangea varieties!</strong></p>",
    "layout": "image-right",
    "textAlign": "left",
    "imageUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NjY3NzZ8MHwxfHNlYXJjaHwxfHx8aHlkcmFuZ2VhJTIwdmFyaWV0aWVzJTIwZGlzcGxheXxlbnwxfDJ8fHwxNzU2MjU1OTM0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "altText": "Various hydrangea varieties displayed at garden center"
  }',
  4
);