
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Blog Post: {slug}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Blog post content for "{slug}" coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlogPostPage;
