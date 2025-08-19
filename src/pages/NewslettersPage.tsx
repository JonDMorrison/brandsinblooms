import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Plus, FileText, Send } from "lucide-react";

export const NewslettersPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-8 h-8 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900">Newsletters</h1>
            </div>
            <p className="text-xl text-gray-600">
              Create and send beautiful email campaigns to your customers
            </p>
          </div>
          <Button 
            onClick={() => navigate('/newsletters/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Newsletter
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Plus className="w-6 h-6 text-green-600" />
                <CardTitle>New Newsletter</CardTitle>
              </div>
              <CardDescription>
                Create a fresh newsletter campaign from scratch
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/newsletters/new')}
                className="w-full"
              >
                Get Started
              </Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <CardTitle>Templates</CardTitle>
              </div>
              <CardDescription>
                Browse pre-designed newsletter templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                onClick={() => navigate('/templates?type=newsletter')}
                className="w-full"
              >
                Browse Templates
              </Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Send className="w-6 h-6 text-purple-600" />
                <CardTitle>Campaigns</CardTitle>
              </div>
              <CardDescription>
                View and manage your newsletter campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                onClick={() => navigate('/crm/campaigns')}
                className="w-full"
              >
                View Campaigns
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Newsletters</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No newsletters yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first newsletter campaign
            </p>
            <Button 
              onClick={() => navigate('/newsletters/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Newsletter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};