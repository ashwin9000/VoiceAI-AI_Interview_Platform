import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import InferenceLoader from '../components/InferenceLoader';
import { interviewAPI } from '../services/api';
import { ROLES } from '../utils/constants';
import toast from 'react-hot-toast';
import {
  CloudUpload, FileText, Trash2, Lock, Globe, Settings2,
  ChevronLeft, CheckCircle2, ChevronDown, Briefcase
} from 'lucide-react';

const LOADING_STEPS_ROLE = [
  'Uploading document...',
  'Extracting text from resume...',
  'Inferencing locally with on-device AI...',
  'Parsing skills, experience & projects...',
  'Generating first interview question...',
  'Preparing interview environment...',
];

const LOADING_STEPS_JD = [
  'Uploading documents...',
  'Extracting text from resume...',
  'Analyzing job description...',
  'Inferencing locally with on-device AI...',
  'Matching skills to job requirements...',
  'Parsing experience & projects...',
  'Generating first interview question...',
  'Preparing interview environment...',
];

const StartInterviewPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleFromQuery = searchParams.get('role') || '';

  const [setupMode, setSetupMode] = useState('role');
  const [file, setFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [selectedRole, setSelectedRole] = useState(roleFromQuery);
  const [dragOver, setDragOver] = useState(false);
  const [jdDragOver, setJdDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const fileInputRef = useRef(null);
  const jdFileInputRef = useRef(null);

  const validDocTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (!validDocTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or DOCX file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setFile(selectedFile);
  };

  const handleJdFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (!validDocTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or DOCX file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setJdFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleJdDrop = (e) => {
    e.preventDefault();
    setJdDragOver(false);
    handleJdFileSelect(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleJdDragOver = (e) => { e.preventDefault(); setJdDragOver(true); };
  const handleJdDragLeave = (e) => { e.preventDefault(); setJdDragOver(false); };

  const handleBrowse = () => { fileInputRef.current?.click(); };
  const handleJdBrowse = () => { jdFileInputRef.current?.click(); };

  const handleRemoveFile = () => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleRemoveJdFile = () => { setJdFile(null); if (jdFileInputRef.current) jdFileInputRef.current.value = ''; };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatRoleName = (id) => id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const isFormValid = setupMode === 'jd'
    ? file && jdFile && selectedRole
    : file && selectedRole;

  const activeLoadingSteps = setupMode === 'jd' ? LOADING_STEPS_JD : LOADING_STEPS_ROLE;

  const handleSubmit = async () => {
    if (!file) { toast.error('Please upload a resume first'); return; }
    if (setupMode === 'jd' && !jdFile) { toast.error('Please upload a job description'); return; }
    if (!selectedRole) { toast.error('Please select a role first'); return; }

    setLoading(true);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => prev < activeLoadingSteps.length - 1 ? prev + 1 : prev);
    }, 3000);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('role', selectedRole);

      if (setupMode === 'jd' && jdFile) {
        formData.append('jobDescription', jdFile);
      }

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

  /* ── Staged File Card (reusable) ── */
  const StagedFile = ({ stagedFile, onRemove, label }) => (
    <div className="mt-5">
      <p className="text-xs font-semibold text-[#767683] uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        {label || 'Document Staged'}
      </p>
      <div className="card-flat p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#191c1e] truncate">{stagedFile.name}</p>
          <p className="text-xs text-[#767683]">
            {formatFileSize(stagedFile.size)} • 100% Uploaded
          </p>
        </div>
        <button
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-red-50 text-[#767683] hover:text-red-500 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-2 w-full h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
        <div className="h-full bg-[#4e45d5] rounded-full w-full transition-all duration-500" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        <Sidebar />
        <div className="page-enter flex">
          <main className="md:ml-[220px] flex-1">
            <InferenceLoader steps={activeLoadingSteps} currentStep={loadingStep} />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="page-enter min-h-screen bg-[#f7f9fb] flex">
        <main className="md:ml-[220px] flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
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

        {/* ── Tab Switcher ── */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#f0f0f5] border border-[#e5e7eb]">
            <button
              type="button"
              onClick={() => setSetupMode('role')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                setupMode === 'role'
                  ? 'bg-[#000666] text-white shadow-sm'
                  : 'bg-transparent text-[#767683] hover:text-[#191c1e]'
              }`}
            >
              Select Role
            </button>
            <button
              type="button"
              onClick={() => setSetupMode('jd')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                setupMode === 'jd'
                  ? 'bg-[#000666] text-white shadow-sm'
                  : 'bg-transparent text-[#767683] hover:text-[#191c1e]'
              }`}
            >
              Upload Job Description
            </button>
          </div>
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

        {/* ── Upload Section ── */}
        {setupMode === 'jd' ? (
          /* JD Mode: two upload zones side by side on desktop, stacked on mobile */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Resume Upload */}
            <div className="card p-6">
              <div
                className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowse}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#eef2ff] flex items-center justify-center">
                    <CloudUpload className="w-7 h-7 text-[#000666]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#191c1e] mb-1">Drag & Drop Resume</h3>
                    <p className="text-xs text-[#454652]">
                      PDF or DOCX, up to 10MB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline text-xs"
                    onClick={(e) => { e.stopPropagation(); handleBrowse(); }}
                  >
                    Browse Files
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />

              {file && (
                <StagedFile stagedFile={file} onRemove={handleRemoveFile} label="Resume Staged" />
              )}
            </div>

            {/* Job Description Upload */}
            <div className="card p-6">
              <div
                className={`drop-zone ${jdDragOver ? 'drag-over' : ''}`}
                onDragOver={handleJdDragOver}
                onDragLeave={handleJdDragLeave}
                onDrop={handleJdDrop}
                onClick={handleJdBrowse}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
                    <Briefcase className="w-7 h-7 text-[#000666]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#191c1e] mb-1">Drag & Drop Job Description</h3>
                    <p className="text-xs text-[#454652]">
                      PDF or DOCX, up to 10MB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline text-xs"
                    onClick={(e) => { e.stopPropagation(); handleJdBrowse(); }}
                  >
                    Browse Files
                  </button>
                </div>
              </div>

              <input
                ref={jdFileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleJdFileSelect(e.target.files[0])}
              />

              {jdFile && (
                <StagedFile stagedFile={jdFile} onRemove={handleRemoveJdFile} label="Job Description Staged" />
              )}
            </div>
          </div>
        ) : (
          /* Role Mode: single resume upload (original layout) */
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
              <StagedFile stagedFile={file} onRemove={handleRemoveFile} />
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="btn-outline flex items-center gap-2">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`btn-primary rounded-full ${!isFormValid ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    </main>
      </div>
    </>
  );
};

export default StartInterviewPage;
