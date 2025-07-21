export const EditableImage = ({ 
  src = '', 
  onChange 
}: { 
  src?: string; 
  onChange?: (src: string) => void; 
}) => {
  return (
    <div className="relative group h-48 w-full bg-gray-100 flex justify-center items-center rounded-lg">
      {src ? (
        <img src={src} alt="Block" className="object-cover h-full w-full rounded-lg" />
      ) : (
        <span className="text-gray-500">No Image</span>
      )}
      <label className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 group-hover:opacity-100 cursor-pointer rounded-lg">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => onChange?.(reader.result as string);
              reader.readAsDataURL(file);
            }
          }}
          className="hidden"
        />
        Change
      </label>
    </div>
  );
};