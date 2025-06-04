
interface ContentMetadataProps {
  task: any;
}

export const ContentMetadata = ({ task }: ContentMetadataProps) => {
  return (
    <div className="space-y-4">
      {task?.hashtags && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Hashtags
          </label>
          <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded border">
            {task.hashtags}
          </div>
        </div>
      )}

      {task?.image_idea && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Image Idea
          </label>
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded border">
            💡 {task.image_idea}
          </div>
        </div>
      )}

      {task?.notes && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Notes
          </label>
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
            {task.notes}
          </div>
        </div>
      )}
    </div>
  );
};
