import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import type { DragEvent, ChangeEvent } from "react";
import { sendTrash } from "../lib/apis";
interface MainBinProps {}

interface FilePreview {
  file: File;
  id: string;
  type: "text" | "image" | "video" | "audio" | "other";
  preview?: string;
}

export default function MainBin({}: MainBinProps) {
  const navigate = useNavigate();
  const [textContent, setTextContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<{
    passcode?: string;
    expireAt?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validatePasscode = (value: string) => {
    if (value && (value.length < 4 || value.length > 32)) {
      return "Passcode must be between 4 and 32 characters";
    }
    return "";
  };

  const validateExpireAt = (value: string) => {
    if (value && new Date(value) <= new Date()) {
      return "Expiration date must be in the future";
    }
    return "";
  };

  const handlePasscodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPasscode(value);
    setErrors((prev) => ({ ...prev, passcode: validatePasscode(value) }));
  };

  const handleExpireAtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setExpireAt(value);
    setErrors((prev) => ({ ...prev, expireAt: validateExpireAt(value) }));
  };

  const getFileType = (file: File): FilePreview["type"] => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("text/")) return "text";
    return "other";
  };

  const createFilePreview = (file: File): FilePreview => {
    const fileType = getFileType(file);
    const filePreview: FilePreview = {
      file,
      id: Math.random().toString(36).substr(2, 9),
      type: fileType,
    };

    // Create preview for images
    if (fileType === "image") {
      filePreview.preview = URL.createObjectURL(file);
    }

    return filePreview;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    // Support up to 3 files for better stability
    if (selectedFiles.length + files.length > 3) {
      toast.error("You can upload up to 3 files at a time.");
      return;
    }

    // Check individual file size limit (20MB per file)
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(
          `File "${file.name}" is too large. Maximum size is 20MB per file.`
        );
        return;
      }
    }

    // Support up to 30MB total
    const totalSize =
      selectedFiles.reduce((acc, f) => acc + f.file.size, 0) +
      Array.from(files).reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 30 * 1024 * 1024) {
      toast.error("Total file size cannot exceed 30MB.");
      return;
    }

    // support extensions: images, and text for now
    for (const file of files) {
      const fileType = getFileType(file);
      if (!["image", "text", "video", "audio", "other"].includes(fileType)) {
        toast.error(
          `File type not supported: ${file.name}. Only images, text, video, audio, and other files are allowed.`
        );
        return;
      }
    }

    const newFiles = Array.from(files).map(createFilePreview);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      // Clean up object URLs to prevent memory leaks
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!textContent.trim() && selectedFiles.length === 0) {
      toast.error("Please enter some text or select files to upload.");
      return;
    }

    if (passcode && (passcode.length < 4 || passcode.length > 32)) {
      toast.error("Passcode must be between 4 and 32 characters.");
      return;
    }

    if (expireAt && new Date(expireAt) <= new Date()) {
      toast.error("Expiration date must be in the future.");
      return;
    }

    setIsSubmitting(true);

    // Show loading toast
    const loadingToast = toast.loading("Creating your trash...");

    try {
      const hasText = textContent.trim().length > 0;
      const hasFiles = selectedFiles.length > 0;

      let result;

      if (hasFiles) {
        result = await sendTrash({
          type: "file",
          textContent: hasText ? textContent : undefined,
          files: selectedFiles.map((f) => f.file),
          passcode: passcode || undefined,
          expireAt: expireAt ? new Date(expireAt) : undefined,
        });
      } else if (hasText) {
        result = await sendTrash({
          type: "text",
          textContent,
          passcode: passcode || undefined,
          expireAt: expireAt ? new Date(expireAt) : undefined,
        });
      }

      toast.dismiss(loadingToast);

      if (result?.success && result?.data) {
        toast.success("Trash created successfully! Redirecting...");

        setTextContent("");
        setSelectedFiles([]);
        setPasscode("");
        setExpireAt("");

        setTimeout(() => {
          navigate(`/t/${result.data}`);
        }, 1000);
      } else {
        toast.error(
          result?.message || "Failed to create trash. Please try again."
        );
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error submitting trash:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div /*className="min-h-screen bg-white"*/>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-light text-gray-800 mb-4">
            tsbin
          </h1>
          <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
            A simple place to store and share your text, files, and media.
            <br /> No signup required. Upload up to 3 files (20MB each, 30MB
            total).
          </p>

          {/* Open Source Banner */}
          <div className="mt-6 inline-flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <span>⭐</span>
              <span>Open Source</span>
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span className="flex items-center space-x-1">
              <span>🔒</span>
              <span>End-to-End Encrypted</span>
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span className="flex items-center space-x-1">
              <span>🚀</span>
              <span>No Registration</span>
            </span>
          </div>
        </div>

        <div className="mb-8">
          <div
            className={`relative bg-gray-50 border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out ${
              isDragOver
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste your text here, or drag and drop files..."
              className="w-full h-64 bg-transparent border-none outline-none resize-none text-gray-800 placeholder-gray-400 text-base leading-relaxed"
            />

            {isDragOver && (
              <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-400 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-blue-600 font-medium">
                    Drop your files here
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={openFileDialog}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Or click to select files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
          </div>
        </div>

        <div className="mb-8">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors duration-200"
          >
            <span className="mr-2">{showAdvanced ? "−" : "+"}</span>
            Advanced Options (Optional)
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label
                  htmlFor="passcode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Passcode (for extra security)
                </label>
                <input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={handlePasscodeChange}
                  minLength={4}
                  maxLength={32}
                  placeholder="Leave empty for default (0000)"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    errors.passcode
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-blue-500"
                  }`}
                />
                {errors.passcode && (
                  <p className="mt-1 text-xs text-red-500">{errors.passcode}</p>
                )}
                {!errors.passcode && (
                  <p className="mt-1 text-xs text-gray-500">
                    Used to encrypt your content. Default is "0000" if left
                    empty.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="expireAt"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Expiration Date
                </label>
                <input
                  id="expireAt"
                  type="datetime-local"
                  value={expireAt}
                  onChange={handleExpireAtChange}
                  min={new Date().toISOString().slice(0, 16)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors duration-200 ${
                    errors.expireAt
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  }`}
                />
                {errors.expireAt && (
                  <p className="mt-1 text-xs text-red-500">{errors.expireAt}</p>
                )}
                {!errors.expireAt && (
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty for no expiration. Content will be automatically
                    deleted after this date.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Selected Files ({selectedFiles.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedFiles.map((filePreview) => (
                <div
                  key={filePreview.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {filePreview.type === "image" && filePreview.preview && (
                        <img
                          src={filePreview.preview}
                          alt={filePreview.file.name}
                          className="w-full h-32 object-cover rounded-md mb-3"
                        />
                      )}
                      <h4 className="text-sm font-medium text-gray-800 truncate">
                        {filePreview.file.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex items-center mt-2">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">
                          {filePreview.type}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(filePreview.id)}
                      className="ml-2 text-gray-400 hover:text-red-500 transition-colors duration-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleSubmit}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={
              (!textContent.trim() && selectedFiles.length === 0) ||
              isSubmitting
            }
            className={`inline-flex items-center px-8 py-3 text-base font-medium rounded-lg shadow-sm transition-all duration-200 ease-in-out transform ${
              (textContent.trim() || selectedFiles.length > 0) && !isSubmitting
                ? isHovered
                  ? "bg-blue-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-gray-50 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <span className="mr-2">🗑️</span>
                Add to Trashbin
              </>
            )}
          </button>
        </div>
      </div>

      {/* Roadmap & Contribution Section */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-light text-gray-800 mb-4">
              🚀 Roadmap & Open Source
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              tsbin is actively being developed with exciting features planned.
              Join our community and help shape the future!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Current Features */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <span className="mr-2">✅</span>
                Current Features
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  End-to-end encryption (AES-GCM)
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Text and file sharing
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Custom passcode protection
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Expiration dates
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Image preview & file downloads
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                  Rate limiting & security
                </li>
              </ul>
            </div>

            {/* Upcoming Features */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🔮</span>
                Coming Soon
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  Larger file support (chunked uploads)
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  Video/audio preview players
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  Batch file operations
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  API endpoints for developers
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  Mobile app (React Native)
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  Self-hosting guide
                </li>
              </ul>
            </div>
          </div>

          {/* Contribution Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                💻 Open Source & Community
              </h3>
              <p className="text-gray-600 mb-4 max-w-2xl mx-auto">
                tsbin is completely open source! We welcome contributions, bug
                reports, and feature requests from the community.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <a
                  href="https://github.com/PriyanshuPz/tsbin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors duration-200 text-sm font-medium"
                >
                  <span className="mr-2">⭐</span>
                  Star on GitHub
                </a>

                <a
                  href="https://github.com/PriyanshuPz/tsbin/fork"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
                >
                  <span className="mr-2">🍴</span>
                  Fork & Contribute
                </a>

                <a
                  href="https://github.com/PriyanshuPz/tsbin/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200 text-sm font-medium"
                >
                  <span className="mr-2">🐛</span>
                  Report Issues
                </a>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                <p>Built with ❤️ using React, NestJS, and modern encryption</p>
              </div>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="mt-8 text-center">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Tech Stack
            </h4>
            <div className="flex flex-wrap justify-center items-center space-x-6 text-xs text-gray-500">
              <span className="flex items-center space-x-1">
                <img
                  src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black"
                  alt="React"
                />
              </span>
              <span className="flex items-center space-x-1">
                <img
                  src="https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white"
                  alt="NestJS"
                />
              </span>
              <span className="flex items-center space-x-1">
                <img
                  src="https://img.shields.io/badge/Telegram-26A5E4?style=flat&logo=telegram&logoColor=white"
                  alt="Telegram"
                />
              </span>
              <span className="flex items-center space-x-1">
                <img
                  src="https://img.shields.io/badge/AppWrite-E0234E?style=flat&logo=AppWrite&logoColor=white"
                  alt="Appwrite"
                />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/*<footer className="text-center py-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">powered by tsbin</p>
      </footer>*/}
    </div>
  );
}
