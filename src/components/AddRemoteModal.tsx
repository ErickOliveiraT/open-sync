import { useEffect, useState } from 'react'
import driveLogo    from '../assets/providers/drive.svg'
import dropboxLogo  from '../assets/providers/dropbox.svg'
import boxLogo      from '../assets/providers/box.svg'
import pcloudLogo   from '../assets/providers/pcloud.svg'
import yandexLogo   from '../assets/providers/yandex.svg'
import s3Logo       from '../assets/providers/s3.svg'
import b2Logo       from '../assets/providers/b2.svg'
import azureLogo    from '../assets/providers/azureblob.svg'
import sftpLogo     from '../assets/providers/sftp.svg'
import ftpLogo      from '../assets/providers/ftp.svg'
import webdavLogo   from '../assets/providers/webdav.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type RemoteType =
  | 'drive' | 'dropbox' | 'box' | 'pcloud' | 'yandex'
  | 's3' | 'b2' | 'azureblob' | 'sftp' | 'ftp' | 'webdav'

type S3Provider = 'AWS' | 'Cloudflare' | 'Wasabi' | 'Minio' | 'Other'

type OauthStatus = 'idle' | 'pending' | 'success' | 'error'

type Step = 'type-select' | 'oauth-flow' | 'form-fields'

interface FieldDef {
  key: string
  label: string
  placeholder?: string
  inputType?: 'text' | 'password'
  default?: string
  options?: string[]
}

// ─── Static config ─────────────────────────────────────────────────────────────

const OAUTH_TYPES = new Set<RemoteType>(['drive', 'dropbox', 'box', 'pcloud', 'yandex'])

const REMOTE_META: Record<RemoteType, { label: string; logo: string }> = {
  drive:    { label: 'Google Drive',  logo: driveLogo   },
  dropbox:  { label: 'Dropbox',       logo: dropboxLogo },
  box:      { label: 'Box',           logo: boxLogo     },
  pcloud:   { label: 'pCloud',        logo: pcloudLogo  },
  yandex:   { label: 'Yandex Disk',   logo: yandexLogo  },
  s3:       { label: 'Amazon S3',     logo: s3Logo      },
  b2:       { label: 'Backblaze B2',  logo: b2Logo      },
  azureblob:{ label: 'Azure Blob',    logo: azureLogo   },
  sftp:     { label: 'SFTP',          logo: sftpLogo    },
  ftp:      { label: 'FTP',           logo: ftpLogo     },
  webdav:   { label: 'WebDAV',        logo: webdavLogo  },
}

const S3_ENDPOINTS: Partial<Record<S3Provider, string>> = {
  Cloudflare: '', // filled dynamically from account_id
  Wasabi:     's3.wasabisys.com',
}

const FORM_FIELDS: Partial<Record<RemoteType, FieldDef[]>> = {
  b2: [
    { key: 'account', label: 'Account ID', placeholder: 'your-account-id' },
    { key: 'key', label: 'Application Key', inputType: 'password', placeholder: '••••••••' },
  ],
  azureblob: [
    { key: 'account', label: 'Storage Account Name', placeholder: 'mystorageaccount' },
    { key: 'key', label: 'Storage Account Key', inputType: 'password', placeholder: '••••••••' },
  ],
  sftp: [
    { key: 'host', label: 'Host', placeholder: 'sftp.example.com' },
    { key: 'user', label: 'Username', placeholder: 'myuser' },
    { key: 'pass', label: 'Password', inputType: 'password' },
    { key: 'port', label: 'Port', placeholder: '22', default: '22' },
  ],
  ftp: [
    { key: 'host', label: 'Host', placeholder: 'ftp.example.com' },
    { key: 'user', label: 'Username', placeholder: 'myuser' },
    { key: 'pass', label: 'Password', inputType: 'password' },
    { key: 'port', label: 'Port', placeholder: '21', default: '21' },
  ],
  webdav: [
    { key: 'url', label: 'URL', placeholder: 'https://your.server.com/remote.php/dav/files/user' },
    { key: 'vendor', label: 'Vendor', options: ['nextcloud', 'owncloud', 'other'] },
    { key: 'user', label: 'Username', placeholder: 'myuser' },
    { key: 'pass', label: 'Password', inputType: 'password' },
  ],
}

const PASSWORD_KEYS = new Set(['pass', 'key'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidName(name: string) {
  return /^[a-zA-Z0-9_-]+$/.test(name)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export default function AddRemoteModal({ onSuccess, onCancel }: Props) {
  // Step 1
  const [remoteName, setRemoteName] = useState('')
  const [remoteType, setRemoteType] = useState<RemoteType>('drive')
  const [nameError, setNameError] = useState<string | null>(null)
  const [existingNames, setExistingNames] = useState<string[]>([])

  // Step routing
  const [step, setStep] = useState<Step>('type-select')

  // OAuth step
  const [oauthStatus, setOauthStatus] = useState<OauthStatus>('idle')
  const [oauthError, setOauthError] = useState<string | null>(null)

  // Form step — shared fields map + S3-specific state
  const [fields, setFields] = useState<Record<string, string>>({})
  const [s3Provider, setS3Provider] = useState<S3Provider>('AWS')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.listRemotes().then(setExistingNames).catch(() => {})
  }, [])

  // Seed default field values when entering form step
  useEffect(() => {
    if (step !== 'form-fields') return
    const defs = FORM_FIELDS[remoteType] ?? []
    const seed: Record<string, string> = {}
    for (const def of defs) {
      if (def.default) seed[def.key] = def.default
      if (def.options) seed[def.key] = def.options[0]
    }
    setFields(seed)
    setSubmitError(null)
  }, [step, remoteType])

  function handleNext() {
    const name = remoteName.trim()
    if (!name) { setNameError('Remote name is required.'); return }
    if (!isValidName(name)) { setNameError('Name may only contain letters, numbers, hyphens and underscores.'); return }
    setNameError(null)
    setStep(OAUTH_TYPES.has(remoteType) ? 'oauth-flow' : 'form-fields')
  }

  async function handleAuthorize() {
    setOauthStatus('pending')
    setOauthError(null)
    try {
      await window.electronAPI.authorizeRemote(remoteName.trim(), remoteType)
      setOauthStatus('success')
    } catch (e) {
      setOauthStatus('error')
      setOauthError(e instanceof Error ? e.message : 'Authorization failed')
    }
  }

  async function handleFormSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const params: Record<string, string> = {}

      if (remoteType === 's3') {
        params.provider = s3Provider === 'Other' ? '' : s3Provider
        params.access_key_id = fields.access_key_id ?? ''
        params.secret_access_key = fields.secret_access_key ?? ''
        if (s3Provider === 'AWS') {
          params.region = fields.region ?? ''
        } else if (s3Provider === 'Cloudflare') {
          const accountId = (fields.account_id ?? '').trim()
          params.endpoint = `https://${accountId}.r2.cloudflarestorage.com`
        } else if (s3Provider === 'Wasabi') {
          params.endpoint = 'https://s3.wasabisys.com'
        } else if (s3Provider === 'Minio' || s3Provider === 'Other') {
          params.endpoint = fields.endpoint ?? ''
        }
      } else {
        const defs = FORM_FIELDS[remoteType] ?? []
        for (const def of defs) {
          let val = fields[def.key] ?? def.default ?? ''
          if (!val) continue
          if (PASSWORD_KEYS.has(def.key) || def.inputType === 'password') {
            val = await window.electronAPI.obscurePassword(val)
          }
          params[def.key] = val
        }
      }

      await window.electronAPI.createRemote(remoteName.trim(), remoteType, params)
      onSuccess()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create remote')
    } finally {
      setSubmitting(false)
    }
  }

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const isPending = oauthStatus === 'pending'

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={isPending ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Step 1: Name + Type ── */}
        {step === 'type-select' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Add Remote</h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Remote name</label>
              <input
                type="text"
                value={remoteName}
                onChange={(e) => { setRemoteName(e.target.value); setNameError(null) }}
                placeholder="e.g. my-gdrive"
                className="input w-full"
                autoFocus
              />
              {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
              {!nameError && existingNames.includes(remoteName.trim()) && remoteName.trim() && (
                <p className="text-xs text-yellow-400 mt-1">A remote with this name already exists and will be overwritten.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Storage type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(REMOTE_META) as RemoteType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRemoteType(type)}
                    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      remoteType === type
                        ? 'border-blue-500 bg-blue-600/20 text-white'
                        : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <img
                      src={REMOTE_META[type].logo}
                      alt={REMOTE_META[type].label}
                      className={`w-7 h-7 object-contain invert ${remoteType === type ? 'opacity-100' : 'opacity-50'}`}
                    />
                    <span className="text-xs leading-tight text-center">{REMOTE_META[type].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2a: OAuth flow ── */}
        {step === 'oauth-flow' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <img src={REMOTE_META[remoteType].logo} alt={REMOTE_META[remoteType].label} className="w-8 h-8 object-contain invert" />
              <div>
                <h2 className="text-lg font-semibold text-white">{REMOTE_META[remoteType].label}</h2>
                <p className="text-xs text-slate-500">{remoteName}</p>
              </div>
            </div>

            {oauthStatus === 'idle' && (
              <>
                <p className="text-sm text-slate-400">
                  Clicking <strong className="text-slate-200">Authorize</strong> will open your browser.
                  Complete the sign-in there, then return to this window.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('type-select')}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleAuthorize}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                  >
                    Authorize
                  </button>
                </div>
              </>
            )}

            {oauthStatus === 'pending' && (
              <div className="flex flex-col items-center gap-4 py-4">
                <svg className="w-8 h-8 animate-spin text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm text-slate-400 text-center">
                  Authorizing…<br />
                  <span className="text-slate-500 text-xs">Complete the sign-in in your browser, then return here.</span>
                </p>
              </div>
            )}

            {oauthStatus === 'success' && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-10 h-10 rounded-full bg-green-700/40 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green-400">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm text-green-400 font-medium">Remote added successfully!</p>
                <button
                  type="button"
                  onClick={onSuccess}
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {oauthStatus === 'error' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
                  {oauthError}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('type-select')}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOauthStatus('idle'); setOauthError(null) }}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2b: Form fields ── */}
        {step === 'form-fields' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <img src={REMOTE_META[remoteType].logo} alt={REMOTE_META[remoteType].label} className="w-8 h-8 object-contain invert" />
              <div>
                <h2 className="text-lg font-semibold text-white">{REMOTE_META[remoteType].label}</h2>
                <p className="text-xs text-slate-500">{remoteName}</p>
              </div>
            </div>

            {/* S3-specific: provider selector + dynamic fields */}
            {remoteType === 's3' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Provider</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['AWS', 'Cloudflare', 'Wasabi', 'Minio', 'Other'] as S3Provider[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setS3Provider(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          s3Provider === p
                            ? 'border-blue-500 bg-blue-600/20 text-white'
                            : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p === 'Cloudflare' ? 'Cloudflare R2' : p === 'Other' ? 'Other (S3-compatible)' : p}
                      </button>
                    ))}
                  </div>
                </div>

                <S3Fields provider={s3Provider} fields={fields} setField={setField} />
              </div>
            )}

            {/* Generic form fields for all other types */}
            {remoteType !== 's3' && (
              <div className="space-y-4">
                {(FORM_FIELDS[remoteType] ?? []).map((def) => (
                  <div key={def.key}>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">{def.label}</label>
                    {def.options ? (
                      <select
                        value={fields[def.key] ?? def.options[0]}
                        onChange={(e) => setField(def.key, e.target.value)}
                        className="input w-full"
                      >
                        {def.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={def.inputType ?? 'text'}
                        value={fields[def.key] ?? ''}
                        onChange={(e) => setField(def.key, e.target.value)}
                        placeholder={def.placeholder}
                        className="input w-full"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {submitError && (
              <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-xs font-mono break-all">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep('type-select')}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 disabled:opacity-40 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Adding…' : 'Add Remote'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── S3 fields sub-component ──────────────────────────────────────────────────

function S3Fields({
  provider,
  fields,
  setField,
}: {
  provider: S3Provider
  fields: Record<string, string>
  setField: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Access Key ID</label>
        <input
          type="text"
          value={fields.access_key_id ?? ''}
          onChange={(e) => setField('access_key_id', e.target.value)}
          placeholder="AKIAIOSFODNN7EXAMPLE"
          className="input w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Secret Access Key</label>
        <input
          type="password"
          value={fields.secret_access_key ?? ''}
          onChange={(e) => setField('secret_access_key', e.target.value)}
          placeholder="••••••••"
          className="input w-full"
        />
      </div>
      {provider === 'AWS' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Region</label>
          <input
            type="text"
            value={fields.region ?? ''}
            onChange={(e) => setField('region', e.target.value)}
            placeholder="us-east-1"
            className="input w-full"
          />
        </div>
      )}
      {provider === 'Cloudflare' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Account ID</label>
          <input
            type="text"
            value={fields.account_id ?? ''}
            onChange={(e) => setField('account_id', e.target.value)}
            placeholder="your-cloudflare-account-id"
            className="input w-full"
          />
          <p className="text-xs text-slate-500 mt-1">
            Endpoint will be set to <code className="text-slate-400">{'<account-id>.r2.cloudflarestorage.com'}</code>
          </p>
        </div>
      )}
      {(provider === 'Minio' || provider === 'Other') && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Endpoint URL</label>
          <input
            type="text"
            value={fields.endpoint ?? ''}
            onChange={(e) => setField('endpoint', e.target.value)}
            placeholder="https://minio.example.com"
            className="input w-full"
          />
        </div>
      )}
    </div>
  )
}
