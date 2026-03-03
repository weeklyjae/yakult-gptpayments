import React from 'react'
import { formatMonthLabel } from '../utils/billing'

function UploadSection({
  fileInputRef,
  selectedFile,
  uploading,
  hasPendingVerification,
  uploadError,
  uploadSuccess,
  billingSummary,
  monthsForNextUpload,
  onFileChange,
  onUpload,
}) {
  const targetMonths = billingSummary ? monthsForNextUpload() : []
  const visibleTargetMonths = targetMonths.slice(0, 2).map((m) => formatMonthLabel(m))
  const moreMonthsCount = Math.max(targetMonths.length - visibleTargetMonths.length, 0)

  return (
    <section className="upload-section">
      <div className="section-head-row">
        <h2 className="section-title">Upload</h2>
        <span className="mini-note">
          {hasPendingVerification ? 'Waiting verification' : 'Image only'}
        </span>
      </div>

      {!hasPendingVerification && (
        <div className="upload-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="file-input"
          />
          <button
            className="btn-primary"
            onClick={onUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      )}

      {hasPendingVerification && (
        <div className="upload-waiting">
          <span className="status-chip status-chip-verifying">verifying</span>
        </div>
      )}

      {selectedFile && <p className="status-helper">{selectedFile.name}</p>}

      {billingSummary && (
        <p className="status-helper">
          For {visibleTargetMonths.join(', ')}
          {moreMonthsCount > 0 ? ` +${moreMonthsCount} more` : ''}
        </p>
      )}

      {uploadError && (
        <div className="alert alert-error">
          <p>{uploadError}</p>
        </div>
      )}

      {uploadSuccess && (
        <div className="alert alert-success">
          <p>{uploadSuccess}</p>
        </div>
      )}
    </section>
  )
}

export default UploadSection
