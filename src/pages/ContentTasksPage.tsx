
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  FileText, 
  ImageIcon, 
  Users, 
  TrendingUp,
  Star,
  MessageSquare,
  Camera,
  PenTool,
  BarChart3
} from 'lucide-react';

const ContentTasksPage = () => {
  const [activeTab, setActiveTab] = useState('active');

  // Mock data for content tasks
  const activeTasks = [
    {
      id: 1,
      title: 'Create Instagram posts for Mother\'s Day campaign',
      type: 'Social Media',
      priority: 'High',
      dueDate: '2024-05-05',
      status: 'In Progress',
      progress: 60,
      assignee: 'AI Assistant',
      description: 'Generate 5 Instagram posts featuring spring flowers and Mother\'s Day messaging',
      subtasks: [
        { id: 1, text: 'Research trending Mother\'s Day hashtags', completed: true },
        { id: 2, text: 'Generate post copy variations', completed: true },
        { id: 3, text: 'Create visual content concepts', completed: false },
        { id: 4, text: 'Schedule posts for optimal engagement', completed: false }
      ]
    },
    {
      id: 2,
      title: 'Weekly newsletter content creation',
      type: 'Email Marketing',
      priority: 'Medium',
      dueDate: '2024-04-30',
      status: 'Ready for Review',
      progress: 90,
      assignee: 'Content Team',
      description: 'Develop this week\'s newsletter featuring seasonal gardening tips and new product highlights',
      subtasks: [
        { id: 5, text: 'Draft main article content', completed: true },
        { id: 6, text: 'Design email template', completed: true },
        { id: 7, text: 'Add product showcase section', completed: true },
        { id: 8, text: 'Final proofread and approval', completed: false }
      ]
    },
    {
      id: 3,
      title: 'Blog post: "10 Spring Gardening Tips"',
      type: 'Blog Content',
      priority: 'Medium',
      dueDate: '2024-05-02',
      status: 'Draft',
      progress: 40,
      assignee: 'AI Assistant',
      description: 'Comprehensive guide covering essential spring gardening practices for beginners',
      subtasks: [
        { id: 9, text: 'Research trending spring topics', completed: true },
        { id: 10, text: 'Create detailed outline', completed: true },
        { id: 11, text: 'Write first draft', completed: false },
        { id: 12, text: 'Add relevant images and infographics', completed: false }
      ]
    }
  ];

  const completedTasks = [
    {
      id: 4,
      title: 'Easter promotion social media campaign',
      type: 'Social Media',
      completedDate: '2024-04-15',
      performance: { likes: 1240, shares: 67, comments: 89 }
    },
    {
      id: 5,
      title: 'March newsletter: "Spring Preparation Guide"',
      type: 'Email Marketing',
      completedDate: '2024-03-28',
      performance: { opens: 2340, clicks: 456, conversions: 23 }
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Ready for Review': return 'bg-purple-100 text-purple-800';
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Social Media': return <MessageSquare className="w-4 h-4" />;
      case 'Email Marketing': return <FileText className="w-4 h-4" />;
      case 'Blog Content': return <PenTool className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Content Tasks</h1>
          </div>
          <p className="text-xl text-gray-600 mb-6">
            Manage your content creation pipeline and track progress
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{activeTasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{completedTasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">This Week</p>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg. Rating</p>
                  <p className="text-2xl font-bold text-gray-900">4.8</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Management */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3">
            <TabsTrigger value="active">Active Tasks</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeTasks.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(task.type)}
                        <CardTitle className="text-lg">{task.title}</CardTitle>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority} Priority
                        </Badge>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Users className="w-4 h-4" />
                          {task.assignee}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-gray-500">{task.progress}%</span>
                      </div>
                      <Progress value={task.progress} className="h-2" />
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-2">Subtasks</h4>
                      <div className="space-y-2">
                        {task.subtasks.map((subtask) => (
                          <div key={subtask.id} className="flex items-center gap-2">
                            <CheckCircle2 
                              className={`w-4 h-4 ${subtask.completed ? 'text-green-600' : 'text-gray-300'}`} 
                            />
                            <span className={`text-sm ${subtask.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                              {subtask.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTasks.map((task) => (
              <Card key={task.id} className="bg-green-50 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(task.type)}
                        <h3 className="font-medium">{task.title}</h3>
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Completed on {new Date(task.completedDate).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        {task.performance.likes && (
                          <span>👍 {task.performance.likes} likes</span>
                        )}
                        {task.performance.opens && (
                          <span>📧 {task.performance.opens} opens</span>
                        )}
                        {task.performance.shares && (
                          <span>🔄 {task.performance.shares} shares</span>
                        )}
                      </div>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Task Completion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 mb-2">87%</div>
                  <p className="text-sm text-gray-600">+5% from last month</p>
                  <Progress value={87} className="mt-4" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Average Time to Complete</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600 mb-2">2.3 days</div>
                  <p className="text-sm text-gray-600">-0.5 days improvement</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Content Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 mb-2">94%</div>
                  <p className="text-sm text-gray-600">Quality score average</p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Content Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Social Media
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress value={45} className="w-20" />
                      <span className="text-sm">45%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Email Marketing
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress value={30} className="w-20" />
                      <span className="text-sm">30%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <PenTool className="w-4 h-4" />
                      Blog Content
                    </span>
                    <div className="flex items-center gap-2">
                      <Progress value={25} className="w-20" />
                      <span className="text-sm">25%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ContentTasksPage;
