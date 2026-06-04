import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { interviewAPI } from '../services/api';
import { ROLES } from '../utils/constants';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CloudUpload, FileText, Trash2, Lock, Globe, Settings2,
  ChevronLeft, CheckCircle2, ChevronDown
} from 'lucide-react';

const LOADING_STEPS = [
  'Uploading document...',
  'Analyzing resume content...',
  'Generating tailored questions...',
  'Preparing interview environment...',
];

const StartInterviewPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleFromQuery = searchParams.get('role') || '';

  const [file, setFile] = useState(null);
  const [selectedRole, setSelectedRole] = useState(roleFromQuery);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or DOCX file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleBrowse = () => { fileInputRef.current?.click(); };
  const handleRemoveFile = () => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatRoleName = (id) => id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const handleSubmit = async () => {
    if (!file) { toast.error('Please upload a resume first'); return; }
    if (!selectedRole) { toast.error('Please select a role first'); return; }

    setLoading(true);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => prev < LOADING_STEPS.length - 1 ? prev + 1 : prev);
    }, 2500);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('role', selectedRole);

      const res = await interviewAPI.start(formData);
      const interviewData = res.data.data;
      const interviewId = interviewData?.interview?.id || interviewData?.interview?._id || interviewData?._id || interviewData?.id;

      clearInterval(stepInterval);
      toast.success('Interview initialized successfully!');
      navigate(`/interview/${interviewId}`);
    } catch (err) {
      clearInterval(stepInterval);
      toast.error(err.response?.data?.error || 'Failed to start interview');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-enter min-h-screen bg-[#f7f9fb] flex"><Sidebar /><main className="md:ml-[220px] flex-1 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="xl" className="mb-6" />
          <div className="space-y-3 max-w-xs mx-auto">
            {LOADING_STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 text-sm transition-all duration-300 ${
                  i <= loadingStep ? 'text-[#000666] opacity-100' : 'text-[#c6c5d4] opacity-50'
                }`}
              >
                {i < loadingStep ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : i === loadingStep ? (
                  <div className="w-4 h-4 border-2 border-[#000666] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-[#c6c5d4] shrink-0" />
                )}
                <span className="font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </main></div>
    );
  }

  return (
    <div className="page-enter min-h-screen bg-[#f7f9fb] flex">
      <Sidebar /><main className="md:ml-[220px] flex-1">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#191c1e] font-display mb-3">
            Initialize Protocol
          </h1>
          <p className="text-[#454652] text-sm max-w-lg mx-auto leading-relaxed">
            Upload your professional resume to prime our analytical intelligence engine. The system will
            parse your experience to dynamically tailor the evaluation parameters and scenario questions.
          </p>
        </div>

        {/* Role Selector */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-[#191c1e] mb-2 block">Target Role</label>
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="input-field appearance-none cursor-pointer pr-10"
            >
              <option value="">Select a role...</option>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
              <option value="custom">Custom Role...</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#767683] pointer-events-none" />
          </div>
          {selectedRole && selectedRole !== 'custom' && (
            <p className="text-xs text-[#4e45d5] mt-1.5 font-medium">
              ✓ {formatRoleName(selectedRole)} selected
            </p>
          )}
        </div>

        {/* Upload Card */}
        <div className="card p-6 mb-6">
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowse}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#eef2ff] flex items-center justify-center">
                <CloudUpload className="w-8 h-8 text-[#000666]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#191c1e] mb-1">Drag & Drop Resume</h3>
                <p className="text-sm text-[#454652]">
                  Drop your PDF or DOCX file here, or click to browse your local repository.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline text-sm"
                onClick={(e) => { e.stopPropagation(); handleBrowse(); }}
              >
                Browse Files
              </button>
              <p className="text-xs text-[#767683]">
                Secure parsing active. Max file size: 10MB.
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />

          {/* Staged File */}
          {file && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-[#767683] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Document Staged
              </p>
              <div className="card-flat p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#191c1e] truncate">{file.name}</p>
                  <p className="text-xs text-[#767683]">
                    {formatFileSize(file.size)} • 100% Uploaded
                  </p>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="p-2 rounded-lg hover:bg-red-50 text-[#767683] hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 w-full h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                <div className="h-full bg-[#4e45d5] rounded-full w-full transition-all duration-500" />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="btn-outline flex items-center gap-2">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || !selectedRole}
            className={`btn-primary rounded-full ${(!file || !selectedRole) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Settings2 className="w-4 h-4" />
            Initialize Analysis
          </button>
        </div>

        {/* Footer Trust Badges */}
        <div className="flex items-center justify-center gap-4 text-xs text-[#767683]">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> End-to-End Encrypted
          </span>
          <span className="text-[#c6c5d4]">•</span>
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Data deleted post-interview
          </span>
        </div>
      </div>
    </main></div>
  );
};

export default StartInterviewPage;
