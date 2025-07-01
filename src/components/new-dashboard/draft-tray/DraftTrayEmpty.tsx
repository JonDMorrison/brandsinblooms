
import React from 'react';
import { FileText } from 'lucide-react';

export const DraftTrayEmpty = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
        <FileText className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm">No drafts available</p>
      <p className="text-gray-400 text-xs mt-1">
        Generate content to see drafts here
      </p>
    </div>
  );
};
