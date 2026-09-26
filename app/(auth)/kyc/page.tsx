"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Upload, Shield, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface KYCStatus {
  id?: string;
  status: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reason?: string;
}

export default function KYCPage() {
  const router = useRouter();
  const [status, setStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [files, setFiles] = useState<{ idFront: File | null; idBack: File | null; selfie: File | null }>({
    idFront: null,
    idBack: null,
    selfie: null,
  });
  const [previews, setPreviews] = useState<{ idFront: string | null; idBack: string | null; selfie: string | null }>({
    idFront: null,
    idBack: null,
    selfie: null,
  });

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/kyc/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch KYC status:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (field: "idFront" | "idBack" | "selfie", file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(`${field} must be an image file`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(`${field} must be less than 5MB`);
      return;
    }
    setFiles((prev) => ({ ...prev, [field]: file }));
    setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.idFront || !files.idBack || !files.selfie) {
      setError("Please upload all three documents");
      return;
    }

    setSubmitting(true);
    setError("");

    // In production, you would upload to a storage service (S3, Cloudinary, etc.)
    // and get URLs. For now, we'll use the object URLs as placeholders.
    // In a real implementation, you'd upload to your storage and get permanent URLs.

    try {
      // Simulate upload - in reality, upload to your storage and get URLs
      const formData = new FormData();
      formData.append("idFrontUrl", previews.idFront ?? "");
      formData.append("idBackUrl", previews.idBack ?? "");
      formData.append("selfieUrl", previews.selfie ?? "");

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idFrontUrl: previews.idFront,
          idBackUrl: previews.idBack,
          selfieUrl: previews.selfie,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");

      setSuccess("KYC documents submitted for review");
      fetchStatus();
    } catch (err: any) {
      setError(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "REJECTED":
        return <XCircle className="w-6 h-6 text-red-500" />;
      case "PENDING":
        return <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "Approved";
      case "REJECTED":
        return "Rejected";
      case "PENDING":
        return "Under Review";
      default:
        return "Not Submitted";
    }
  };

  const UploadField = ({ label, field, icon, accept = "image/*" }: { label: string; field: "idFront" | "idBack" | "selfie"; icon: React.ReactNode; accept?: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type="file"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && handleFileChange(field, e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            files[field]
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-muted hover:border-primary/50"
          }`}
        >
          {previews[field] ? (
            <div className="relative max-w-xs mx-auto">
              <img src={previews[field]} alt={label} className="rounded-lg max-h-40" />
              <button
                type="button"
                onClick={() => {
                  setFiles((prev) => ({ ...prev, [field]: null }));
                  setPreviews((prev) => ({ ...prev, [field]: null }));
                }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                {icon}
              </div>
              <p className="text-sm text-muted-foreground">Click or drag to upload</p>
              <p className="text-xs text-muted-foreground">JPG, PNG up to 5MB</p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">KYC Verification</h1>
          <p className="text-muted-foreground">Complete identity verification to unlock live trading features</p>
        </div>
      </div>

      {/* Current Status */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Current Status</h2>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : status ? (
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">{getStatusIcon(status.status)}</div>
            <div>
              <p className="font-medium text-lg capitalize">{getStatusLabel(status.status)}</p>
              {status.submittedAt && (
                <p className="text-sm text-muted-foreground">Submitted: {new Date(status.submittedAt).toLocaleDateString()}</p>
              )}
              {status.reviewedAt && (
                <p className="text-sm text-muted-foreground">Reviewed: {new Date(status.reviewedAt).toLocaleDateString()}</p>
              )}
              {status.reason && status.status === "REJECTED" && (
                <p className="text-sm text-red-500 mt-1">Reason: {status.reason}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <AlertCircle className="w-6 h-6 text-gray-500" />
            <p className="text-muted-foreground">KYC not submitted yet</p>
          </div>
        )}
      </div>

      {/* Upload Form */}
      {!status || status.status !== "APPROVED" ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-500 bg-red-50 p-4 text-red-600 text-sm" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-500 bg-green-50 p-4 text-green-600 text-sm" role="status">
              {success}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <UploadField
              label="Government ID (Front)"
              field="idFront"
              icon={<FileText className="w-6 h-6" />}
            />
            <UploadField
              label="Government ID (Back)"
              field="idBack"
              icon={<FileText className="w-6 h-6" />}
            />
            <UploadField
              label="Selfie with ID"
              field="selfie"
              icon={<Upload className="w-6 h-6" />}
            />
          </div>

          <div className="rounded-lg border border-muted bg-muted/50 p-4 text-sm">
            <h4 className="font-medium mb-2">Requirements</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Government-issued photo ID (passport, driver&apos;s license, national ID)</li>
              <li>• Both front and back of ID must be clearly visible</li>
              <li>• Selfie must show you holding the ID next to your face</li>
              <li>• All text and photos must be legible, no glare or blur</li>
              <li>• Maximum file size: 5MB per image</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={submitting || !files.idFront || !files.idBack || !files.selfie}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              "Submit for Review"
            )}
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-green-500 bg-green-50 p-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-green-700">KYC Approved!</h3>
          <p className="text-green-600 mt-1">You can now deposit and trade on your LIVE account.</p>
          <Link href="/wallet" className="mt-4 inline-block text-primary hover:underline">
            Go to Wallet →
          </Link>
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}