import React from 'react'
import { MONTHLY_PRICE_PHP, formatMonthLabel } from '../utils/billing'

function UploadSection({
  fileInputRef,
  selectedFile,
  uploading,
  uploadError,
  uploadSuccess,
  billingSummary,
  monthsForNextUpload,
  onFileChange,
  onUpload,
}) {
  return (
    <section className="upload-section">
      <h2 className="section-title">Upload receipt</h2>
      <p className="section-caption">
        Attach a clear screenshot or PDF of your payment. We will mark the
        oldest unpaid months first.
      </p>

      <div className="upload-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={onFileChange}
          className="file-input"
        />
        <button
          className="btn-primary"
          onClick={onUpload}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload receipt'}
        </button>
      </div>

      {billingSummary && (
        <p className="status-helper">
          This upload will apply to:{' '}
          {monthsForNextUpload()
            .map((m) => formatMonthLabel(m))
            .join(', ')}
          .
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

