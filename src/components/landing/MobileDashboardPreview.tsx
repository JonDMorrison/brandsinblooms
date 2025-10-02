import React from 'react';
import { Sparkles, Share2, Mail, BarChart3, Globe, Palette } from 'lucide-react';

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

      {/* Feature Cards */}
      <div className="p-4 space-y-3 pb-6">
        {/* Plan My Marketing */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#68BEB9] to-[#68BEB9]/80 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Plan My Marketing</h3>
              <p className="text-sm text-gray-600">AI-powered campaigns ready in minutes</p>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3E5A6B] to-[#3E5A6B]/80 flex items-center justify-center">
              <Share2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Post Content</h3>
              <p className="text-sm text-gray-600">Schedule across all your social platforms</p>
            </div>
          </div>
        </div>

        {/* Write A Newsletter */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#68BEB9] to-[#68BEB9]/80 flex items-center justify-center">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Write A Newsletter</h3>
              <p className="text-sm text-gray-600">Engaging emails that drive sales</p>
            </div>
          </div>
        </div>

        {/* Track Performance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3E5A6B] to-[#3E5A6B]/80 flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Track Performance</h3>
              <p className="text-sm text-gray-600">See what's working in real-time</p>
            </div>
          </div>
        </div>

        {/* Build And Manage My Website */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#68BEB9] to-[#68BEB9]/80 flex items-center justify-center">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Build And Manage My Website</h3>
              <p className="text-sm text-gray-600">Professional sites without the hassle</p>
            </div>
          </div>
        </div>

        {/* Manage My Brand */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3E5A6B] to-[#3E5A6B]/80 flex items-center justify-center">
              <Palette className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Manage My Brand</h3>
              <p className="text-sm text-gray-600">Keep your message consistent everywhere</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
