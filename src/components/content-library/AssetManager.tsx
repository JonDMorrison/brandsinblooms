
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, Download, Trash2, Image, Video, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Asset {
  id: string;
  name: string;
  type: string;
  size_bytes: number;
  dimensions?: string;
  duration?: string;
  created_at: string;
  tags: string[];
  url?: string;
}

interface AssetManagerProps {
  assets: Asset[];
  loading: boolean;
  onUpload: (files: FileList) => void;
  onDelete: (assetId: string) => void;
}

export const AssetManager = ({ assets, loading, onUpload, onDelete }: AssetManagerProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const assetTypes = [
    { id: "all", label: "All Assets", count: assets.length },
    { id: "image", label: "Images", count: assets.filter(a => a.type === "image").length },
    { id: "video", label: "Videos", count: assets.filter(a => a.type === "video").length },
    { id: "document", label: "Documents", count: assets.filter(a => a.type === "document").length }
  ];

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === "all" || asset.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      onUpload(files);
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (asset.url) {
      const link = document.createElement('a');
      link.href = asset.url;
      link.download = asset.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Library</CardTitle>
          <CardDescription>Manage your images, videos, and documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="aspect-square w-full mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Library</CardTitle>
        <CardDescription>Manage your images, videos, and documents</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 text-center hover:border-blue-400 transition-colors">
          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
          <input
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <Button asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              Choose Files
            </label>
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {assetTypes.map(type => (
              <Button
                key={type.id}
                variant={selectedType === type.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type.id)}
                className="flex items-center gap-1"
              >
                {type.label}
                <Badge variant="secondary" className="ml-1">
                  {type.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        {/* Assets Grid */}
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No assets found</p>
            <p className="text-gray-400">Upload some files to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                      {asset.type === "image" ? (
                        <img 
                          src={asset.url} 
                          alt={asset.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-gray-400">
                          {getAssetIcon(asset.type)}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm line-clamp-1">{asset.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(asset.size_bytes)}</p>
                      {asset.dimensions && (
                        <p className="text-xs text-gray-500">{asset.dimensions}</p>
                      )}
                      {asset.duration && (
                        <p className="text-xs text-gray-500">{asset.duration}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleDownload(asset)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onDelete(asset.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
