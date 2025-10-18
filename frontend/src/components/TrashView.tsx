import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { getTrash, decryptTrashContent, decryptTrashFile } from "../lib/apis";

interface TrashData {
  id: string;
  slug: string;
  type: string;
  content: string;
  encryption_meta: any;
  encrypted: boolean;
  views: number;
  expires_at: string | null;
  size: number;
  created_at: string;
  encryptedFiles?: Array<{
    meta: {
      iv: string;
      algorithm: string;
      fileName: string;
      fileSize: number;
      fileType: string;
    };
    messageId: string;
    encryptedContent?: string;
  }>;
}

export default function TrashView() {
  const { id } = useParams<{ id: string }>();
  const [trashData, setTrashData] = useState<TrashData | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string>("");
  const [decryptedFiles, setDecryptedFiles] = useState<File[]>([]);
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTrashData();
    }
  }, [id]);

  const fetchTrashData = async () => {
    try {
      setIsLoading(true);
      const response = await getTrash(id!);

      if (response.success) {
        setTrashData(response.data);
        if (!response.data.encrypted) {
          if (response.data.type === "text") {
            const decryptedContent = await decryptTrashContent(
              response.data.content,
              response.data.encryption_meta,
              "0000"
            );

            if (decryptedContent.success) {
              setDecryptedContent(decryptedContent.content || "");
            } else {
              setError(decryptedContent.error || "Failed to decrypt");
            }
          } else if (response.data.type === "file") {
            // Handle unencrypted files (though this should be rare)
            await handleFileDecryption(response.data, "0000");
          }
        } else {
          setNeedsPasscode(true);
        }
      } else {
        setError(response.message || "Failed to load trash");
      }
    } catch (err) {
      setError("Failed to load trash");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileDecryption = async (data: TrashData, passcode: string) => {
    if (!data.encryptedFiles) return;

    const decryptedFilesList: File[] = [];

    for (const encryptedFile of data.encryptedFiles) {
      if (encryptedFile.encryptedContent) {
        try {
          const result = await decryptTrashFile(
            encryptedFile.encryptedContent,
            encryptedFile.meta,
            passcode
          );

          if (result.success && result.file) {
            decryptedFilesList.push(result.file);
          }
        } catch (error) {
          console.error("Failed to decrypt file:", error);
        }
      }
    }

    setDecryptedFiles(decryptedFilesList);
  };

  const handleDecrypt = async () => {
    if (!trashData || !passcode) return;

    setIsDecrypting(true);
    setError("");

    try {
      if (trashData.type === "text") {
        const result = await decryptTrashContent(
          trashData.content,
          trashData.encryption_meta,
          passcode
        );

        if (result.success) {
          setDecryptedContent(result.content || "");
          setNeedsPasscode(false);
        } else {
          setError(result.error || "Failed to decrypt");
        }
      } else if (trashData.type === "file") {
        await handleFileDecryption(trashData, passcode);
        setNeedsPasscode(false);
      }
    } catch (err) {
      setError("Invalid passcode or corrupted data");
    } finally {
      setIsDecrypting(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("URL copied to clipboard!");
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("URL copied to clipboard!");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${file.name}`);
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith("image/");
  };

  const FileDisplay = ({ file }: { file: File }) => {
    const [imageUrl, setImageUrl] = useState<string>("");

    useEffect(() => {
      if (isImageFile(file)) {
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    }, [file]);

    if (isImageFile(file)) {
      return (
        <div className="mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-800">{file.name}</h4>
              <button
                onClick={() => downloadFile(file)}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm"
              >
                <span>📥</span>
                <span>Download</span>
              </button>
            </div>
            <img
              src={imageUrl}
              alt={file.name}
              className="max-w-full h-auto rounded-lg border border-gray-200"
              style={{ maxHeight: "500px" }}
            />
            <p className="text-xs text-gray-500 mt-2">
              {formatSize(file.size)} • {file.type}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">📄</div>
              <div>
                <h4 className="font-medium text-gray-800">{file.name}</h4>
                <p className="text-sm text-gray-500">
                  {formatSize(file.size)} • {file.type || "Unknown type"}
                </p>
              </div>
            </div>
            <button
              onClick={() => downloadFile(file)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
            >
              <span>📥</span>
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !trashData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🗑️</div>
          <h1 className="text-2xl font-light text-gray-800 mb-4">Not Found</h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
          >
            ← Create New Trash
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div /*className="min-h-screen bg-white"*/  >
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            ← Back to tsbin
          </Link>

          <button
            onClick={copyToClipboard}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
          >
            <span className="text-sm">📋</span>
            <span className="text-sm font-medium">Copy URL</span>
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          {needsPasscode ? (
            <div className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-xl font-medium text-gray-800 mb-4">
                  This content is encrypted
                </h2>
                <p className="text-gray-600 mb-6">
                  Enter the passcode to view the content
                </p>

                <div className="space-y-4">
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => e.key === "Enter" && handleDecrypt()}
                  />

                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <button
                    onClick={handleDecrypt}
                    disabled={!passcode || isDecrypting}
                    className={`w-full py-3 rounded-lg font-medium transition-colors duration-200 ${
                      passcode && !isDecrypting
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {isDecrypting ? "Decrypting..." : "Decrypt"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8">
              {trashData?.type === "text" ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <pre className="whitespace-pre-wrap text-gray-800 text-base leading-relaxed font-mono">
                    {decryptedContent}
                  </pre>
                </div>
              ) : trashData?.type === "file" ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">
                    Files ({decryptedFiles.length})
                  </h3>
                  {decryptedFiles.length > 0 ? (
                    decryptedFiles.map((file, index) => (
                      <FileDisplay key={index} file={file} />
                    ))
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                      <div className="text-4xl mb-4">📁</div>
                      <p className="text-gray-600">
                        No files available to display
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-4">❓</div>
                    <p className="text-gray-600">Unknown content type</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {trashData && (
          <div className="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">ID:</span>
                <span className="ml-2 font-mono text-gray-800">
                  {trashData.slug}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 text-gray-800 capitalize">
                  {trashData.type}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Size:</span>
                <span className="ml-2 text-gray-800">
                  {formatSize(trashData.size)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Views:</span>
                <span className="ml-2 text-gray-800">{trashData.views}</span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2 text-gray-800">
                  {formatDate(trashData.created_at)}
                </span>
              </div>
              {trashData.expires_at && (
                <div>
                  <span className="text-gray-500">Expires:</span>
                  <span className="ml-2 text-gray-800">
                    {formatDate(trashData.expires_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        
        {/*<footer className="text-center py-8 mt-16">
          <p className="text-xs text-gray-400">powered by tsbin</p>
        </footer>*/}
      </div>
    </div>
  );
}
