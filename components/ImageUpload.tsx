import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Spinner } from './Spinner';

interface ImageUploadProps {
  onImageUpload: (file: File) => void;
  onSuggestionClick: (suggestion: string) => void;
}

interface AnalysisResult {
  analysis?: {
    type: string;
    suggestions: string[];
  };
  error?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, onSuggestionClick }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      if (file.size > 2 * 1024 * 1024) {
        setError('File size exceeds 2MB limit.');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setError('Unsupported file type. Please upload a JPEG, PNG, or GIF image.');
        return;
      }

      setIsLoading(true);
      onImageUpload(file);

      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch('/api/analyzeImage', {
          method: 'POST',
          body: formData,
        });

        const result: AnalysisResult = await response.json();

        setIsLoading(false);
        if (result.error) {
          setError(result.error);
          setSuggestions([]);
        } else if (result.analysis && result.analysis.suggestions) {
          setError(null);
          setSuggestions(result.analysis.suggestions);
        } else {
          throw new Error('Unexpected response format from the server.');
        }
      } catch (error) {
        setIsLoading(false);
        setError('An error occurred while analyzing the image.');
        setSuggestions([]);
      }

      setUploadProgress(0);
    }
  }, [onImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    multiple: false
  });

  return (
    <div>
      <motion.div
        className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              <svg
                className="w-12 h-12 mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </>
          )}
        </div>
      </motion.div>
      {error && (
        <p className="mt-4 text-red-500">{error}</p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Suggestions:</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick(suggestion)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      {isLoading && (
        <p className="mt-4 text-blue-500">Analyzing image, please wait...</p>
      )}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{width: `${uploadProgress}%`}}
          ></div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;