import React from 'react';
import { Calendar, TrendingUp, Mail, Facebook, Instagram, CheckCircle2, BarChart3 } from 'lucide-react';

export const MobileDashboardPreview = () => {
  return (
    <div className="h-full bg-gradient-to-b from-gray-50 via-white to-gray-50 overflow-y-auto scrollbar-hide">
      {/* Status Bar */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm px-6 pt-3 pb-2 border-b border-gray-100">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="font-semibold text-gray-900">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 border border-gray-900 rounded-sm relative">
              <div className="absolute inset-0.5 bg-gray-900 rounded-sm" />
            </div>
          </div>
        </div>
        
        {/* App Header */}
        <div className="flex items-center gap-2 pb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#68BEB9] to-[#3E5A6B] flex items-center justify-center">
            <span className="text-white text-sm font-bold">B</span>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">BloomSuite</div>
            <div className="text-xs text-gray-500">Dashboard</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Weekly Campaign Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#68BEB9]" />
            <span className="text-sm font-semibold text-gray-900">This Week's Campaign</span>
          </div>
          <div className="bg-gradient-to-br from-[#68BEB9]/10 to-[#3E5A6B]/10 rounded-xl p-3 mb-3">
            <div className="text-xs text-gray-600 mb-1">Spring Garden Sale</div>
            <div className="text-lg font-bold text-gray-900">Ready to Launch</div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500">Posts</div>
              <div className="text-sm font-bold text-gray-900">12</div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500">Emails</div>
              <div className="text-sm font-bold text-gray-900">3</div>
            </div>
          </div>
        </div>

        {/* Content Tasks */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Today's Content</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <Facebook className="w-4 h-4 text-blue-600" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">Spring planting tips</div>
                <div className="text-xs text-gray-500">Facebook Post</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#68BEB9]" />
            </div>
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <Instagram className="w-4 h-4 text-pink-600" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">Garden showcase</div>
                <div className="text-xs text-gray-500">Instagram Story</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <Mail className="w-4 h-4 text-[#68BEB9]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">Weekly newsletter</div>
                <div className="text-xs text-gray-500">Email Campaign</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-gray-300" />
            </div>
          </div>
        </div>

        {/* Analytics Metrics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-[#68BEB9]" />
            <span className="text-sm font-semibold text-gray-900">This Month</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-[#68BEB9]/10 to-transparent rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Engagement</div>
              <div className="text-xl font-bold text-gray-900">2.4K</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="w-3 h-3" />
                <span>+18%</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#3E5A6B]/10 to-transparent rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Reach</div>
              <div className="text-xl font-bold text-gray-900">8.2K</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="w-3 h-3" />
                <span>+24%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 pb-4">
          <button className="bg-gradient-to-r from-[#68BEB9] to-[#3E5A6B] text-white rounded-xl p-3 text-xs font-semibold shadow-sm">
            Create Post
          </button>
          <button className="bg-white border border-gray-200 text-gray-900 rounded-xl p-3 text-xs font-semibold">
            View Analytics
          </button>
        </div>
      </div>
    </div>
  );
};
