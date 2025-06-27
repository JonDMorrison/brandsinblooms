
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Facebook, Instagram, Send, AlertCircle } from 'lucide-react';
import { PostToSocialButton } from './PostToSocialButton';
import { NewPostModal } from './NewPostModal';
import { SocialErrorBoundary } from './SocialErrorBoundary';

// Mock data for development
const mockConnections = [
  {
    id: 'mock-fb-1',
    platform: 'facebook',
    platform_account_name: 'Test Facebook Page',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-ig-1', 
    platform: 'instagram',
    platform_account_name: '@test_instagram',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

const mockTasks = [
  {
    id: 'task-1',
    ai_output: 'This is a sample Facebook post about gardening tips. Perfect for engaging with your audience about seasonal planting and garden maintenance. #Gardening #PlantCare #GreenThumb',
    status: 'approved',
    post_type: 'facebook',
    title: 'Spring Gardening Tips'
  },
  {
    id: 'task-2', 
    ai_output: 'Beautiful spring flowers are blooming! 🌸 Here are some tips for keeping your garden vibrant this season. Check out our latest blog post for more detailed advice. #SpringGarden #FlowerPower #GardenLife',
    status: 'approved',
    post_type: 'instagram',
    title: 'Spring Flower Care'
  },
  {
    id: 'task-3',
    ai_output: 'Draft content that needs approval before posting to social media platforms.',
    status: 'draft',
    post_type: 'facebook',
    title: 'Draft Post Example'
  }
];

export const DevSocialPage = () => {
  console.log('🚀 DevSocialPage: Component rendering');
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);

  const handlePostSuccess = () => {
    console.log('✅ Post successful!');
  };

  return (
    <SocialErrorBoundary>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Debug Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Development Mode Active</h3>
          </div>
          <p className="text-blue-700 text-sm">
            This is the development social media interface with mock data. 
            Mock connections: {mockConnections.length}, Mock tasks: {mockTasks.length}
          </p>
        </div>

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Social Media Development Interface</h1>
          <p className="text-gray-600">Development version with mock data to test social posting features</p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connected Accounts (Mock Data)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {mockConnections.map((connection) => (
                <div key={connection.id} className="flex items-center gap-3 p-4 border rounded-lg bg-white">
                  {connection.platform === 'facebook' ? 
                    <Facebook className="h-5 w-5 text-blue-600" /> : 
                    <Instagram className="h-5 w-5 text-pink-500" />
                  }
                  <div>
                    <p className="font-medium capitalize">{connection.platform}</p>
                    <p className="text-sm text-gray-500">{connection.platform_account_name}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      Connected
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Post to Social Testing */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Test Social Media Posting</CardTitle>
              <p className="text-gray-600">Test the PostToSocialButton component with different states</p>
            </div>
            <Button 
              onClick={() => setIsNewPostModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Post
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mockTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600 capitalize">
                        Status: <span className="font-medium">{task.status}</span> | 
                        Type: <span className="font-medium">{task.post_type}</span>
                      </p>
                    </div>
                    <div className="ml-4">
                      <PostToSocialButton
                        task={task}
                        onSuccess={handlePostSuccess}
                        variant="default"
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-sm">
                    <p className="text-gray-700">{task.ai_output}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Component State Testing */}
        <Card>
          <CardHeader>
            <CardTitle>Component State Testing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-3 border rounded bg-white">
                <span className="text-sm font-medium w-32">Approved Content:</span>
                <PostToSocialButton
                  task={mockTasks[0]}
                  onSuccess={handlePostSuccess}
                  variant="default"
                  size="sm"
                />
                <span className="text-xs text-gray-500">Should show posting dialog</span>
              </div>
              
              <div className="flex items-center gap-4 p-3 border rounded bg-white">
                <span className="text-sm font-medium w-32">Draft Content:</span>
                <PostToSocialButton
                  task={mockTasks[2]}
                  onSuccess={handlePostSuccess}
                  variant="default"
                  size="sm"
                />
                <span className="text-xs text-gray-500">Should be disabled with tooltip</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New Post Modal */}
        <NewPostModal
          isOpen={isNewPostModalOpen}
          onClose={() => setIsNewPostModalOpen(false)}
          onSuccess={() => {
            setIsNewPostModalOpen(false);
            console.log('✅ New post created!');
          }}
          connections={mockConnections}
        />
      </div>
    </SocialErrorBoundary>
  );
};
