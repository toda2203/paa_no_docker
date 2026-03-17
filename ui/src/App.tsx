
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'

// Typdefinitionen ...



type Template = {
  id: string
  name: string
  subject: string
  body: string
  createdAt: string
}

type Campaign = {
  id: string
  name: string
  status: string
  templateId: string
  templateName: string
  senderEmail?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  startedAt?: string | null
  recipientCount: number
}

type SenderOption = {
  email: string
  displayName?: string | null
}

type RecipientOption = {
  email: string
  displayName?: string | null
  department?: string | null
}

type CampaignClick = {
  id: string
  recipientEmail: string
  tenantName?: string | null
  ip?: string | null
  userAgent?: string | null
  createdAt: string
  clickCount: number
}

type ClickSummary = {
  items: CampaignClick[]
  byDay: Array<{ date: string; count: number }>
  stats: {
    totalClicks: number
    uniqueRecipients: number
    firstClickAt: string | null
    avgSeconds: number | null
    recipientTotal: number
  }
}

type CampaignSummary = {
  id: string
  name: string
  recipientTotal: number
  clickedRecipients: number
  firstClickAt: string | null
  avgSeconds: number | null
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
type View = 'home' | 'templates' | 'campaigns' | 'settings' | 'tracking'
type PreviewMode = 'draft' | 'saved'

function App() {
  // const [currentTenantId, setCurrentTenantId] = useState<string>('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [view, setView] = useState<View>('home')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('draft')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [senders, setSenders] = useState<SenderOption[]>([])
  const [recipients, setRecipients] = useState<RecipientOption[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [recipientMode, setRecipientMode] = useState<'single' | 'multiple' | 'department' | 'all'>(
    'single',
  )
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [recipientFilterDepartment, setRecipientFilterDepartment] = useState('')
  const [clicks, setClicks] = useState<CampaignClick[]>([])
  const [clickTimeline, setClickTimeline] = useState<Array<{ date: string; count: number }>>([])
  const [clickStats, setClickStats] = useState<ClickSummary['stats'] | null>(null)
  const [campaignSummaries, setCampaignSummaries] = useState<CampaignSummary[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: '<p>Hello,</p>\n<p>Please review this update.</p>\n<p><a href="{{tracking_url}}">Open message</a></p>',
  })
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    templateId: '',
    senderEmail: '',
    startDate: '',
    endDate: '',
    recipientsRaw: '',
  })
  const [status, setStatus] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [loading, setLoading] = useState({
    templates: false,
    campaigns: false,
    senders: false,
    recipients: false,
    departments: false,
    submitTemplate: false,
    submitCampaign: false,
    clicks: false,
  })
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)

  const templateCount = templates.length
  const campaignCount = campaigns.length
  const draftCount = campaigns.filter((campaign) => campaign.status === 'DRAFT').length
  const startedCount = campaigns.filter((campaign) => campaign.status === 'STARTED').length
  const selectedTemplate = selectedTemplateId
    ? templates.find((template) => template.id === selectedTemplateId)
    : null
  const previewTemplate = previewMode === 'saved' ? selectedTemplate : null
  const previewTitle = previewMode === 'saved'
    ? previewTemplate?.name || 'Select a template'
    : templateForm.name || 'Draft template'
  const previewSubject = previewMode === 'saved'
    ? previewTemplate?.subject || 'No subject'
    : templateForm.subject || 'No subject'
  const previewBody = previewMode === 'saved'
    ? previewTemplate?.body || '<p>No template selected yet.</p>'
    : templateForm.body
  const normalizedSearch = recipientSearch.trim().toLowerCase()
  const visibleRecipients = recipients
    .filter((recipient) => {
      if (recipientFilterDepartment && recipient.department !== recipientFilterDepartment) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      const haystack = `${recipient.displayName || ''} ${recipient.email}`.toLowerCase().trim()
      return haystack.includes(normalizedSearch)
    })
    .slice(0, 200)
  const selectedCount = selectedRecipients.size
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) || null
  const clickedCount = clickStats?.uniqueRecipients || 0
  const recipientTotal = clickStats?.recipientTotal || selectedCampaign?.recipientCount || 0
  const clickRate = recipientTotal > 0 ? Math.round((clickedCount / recipientTotal) * 100) : 0
  const unclickedCount = Math.max(recipientTotal - clickedCount, 0)
  const firstClickedLabel = clickStats?.firstClickAt
    ? formatDuration(clickStats.firstClickAt, selectedCampaign?.startedAt)
    : '—'
  const avgClickedLabel = clickStats?.avgSeconds
    ? formatSeconds(clickStats.avgSeconds)
    : '—'
  const summaryById = useMemo(() => {
    return new Map(campaignSummaries.map((summary) => [summary.id, summary]))
  }, [campaignSummaries])
  const startedCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => campaign.startedAt)
  }, [campaigns])
  const overallCampaigns = startedCampaigns.length
  const overallSends = startedCampaigns.reduce((total, campaign) => {
    const summary = summaryById.get(campaign.id)
    return total + (summary?.recipientTotal ?? campaign.recipientCount ?? 0)
  }, 0)
  const overallClicks = startedCampaigns.reduce((total, campaign) => {
    return total + (summaryById.get(campaign.id)?.clickedRecipients ?? 0)
  }, 0)
  const overallRisk = overallSends > 0 ? Math.round((overallClicks / overallSends) * 100) : 0
  const previewDoc = `<!doctype html><html><head><meta charset="utf-8" />` +
    `<style>body{font-family:Arial,sans-serif;padding:24px;color:#0f1f2e;}a{color:#ff7a00;}</style>` +
    `</head><body>${previewBody}</body></html>`

  const fetchTemplates = async () => {
    setLoading((prev) => ({ ...prev, templates: true }))
    try {
      const response = await fetch(`${apiBase}/api/templates`)
      if (!response.ok) {
        throw new Error('Failed to load templates')
      }
      const data = (await response.json()) as Template[]
      setTemplates(data)
      if (!campaignForm.templateId && data.length > 0) {
        setCampaignForm((prev) => ({ ...prev, templateId: data[0].id }))
      }
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, templates: false }))
    }
  }

  const fetchCampaigns = async () => {
    setLoading((prev) => ({ ...prev, campaigns: true }))
    try {
      const response = await fetch(`${apiBase}/api/campaigns`)
      if (!response.ok) {
        throw new Error('Failed to load campaigns')
      }
      const data = (await response.json()) as Campaign[]
      setCampaigns(data)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, campaigns: false }))
    }
  }

  const fetchClicks = async (campaignId: string) => {
    if (!campaignId) {
      return
    }
    setLoading((prev) => ({ ...prev, clicks: true }))
    try {
      const response = await fetch(`${apiBase}/api/campaigns/${campaignId}/clicks`)
      if (!response.ok) {
        throw new Error('Failed to load clicks')
      }
      const data = (await response.json()) as Partial<ClickSummary>
      setClicks(data.items ?? [])
      setClickTimeline(data.byDay ?? [])
      setClickStats(data.stats ?? null)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, clicks: false }))
    }
  }

  const fetchCampaignSummaries = async () => {
    setSummaryError(null)
    try {
      const response = await fetch(`${apiBase}/api/campaigns/summary`)
      if (!response.ok) {
        throw new Error('Failed to load campaign summary')
      }
      const data = (await response.json()) as CampaignSummary[]
      setCampaignSummaries(data)
    } catch (error) {
      setSummaryError('Campaign summary unavailable. Check backend /api/campaigns/summary.')
      setStatus((error as Error).message)
    }
  }

  const fetchSenders = async () => {
    setLoading((prev) => ({ ...prev, senders: true }))
    try {
      const response = await fetch(`${apiBase}/api/senders`)
      if (!response.ok) {
        throw new Error('Failed to load sender list')
      }
      const data = (await response.json()) as SenderOption[]
      setSenders(data)
      if (!campaignForm.senderEmail && data.length > 0) {
        setCampaignForm((prev) => ({ ...prev, senderEmail: data[0].email }))
      }
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, senders: false }))
    }
  }

  const fetchRecipients = async (department?: string) => {
    setLoading((prev) => ({ ...prev, recipients: true }))
    try {
      const query = department ? `?department=${encodeURIComponent(department)}` : ''
      const response = await fetch(`${apiBase}/api/recipients${query}`)
      if (!response.ok) {
        throw new Error('Failed to load recipient list')
      }
      const data = (await response.json()) as RecipientOption[]
      setRecipients(data)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, recipients: false }))
    }
  }

  const fetchDepartments = async () => {
    setLoading((prev) => ({ ...prev, departments: true }))
    try {
      const response = await fetch(`${apiBase}/api/departments`)
      if (!response.ok) {
        throw new Error('Failed to load departments')
      }
      const data = (await response.json()) as string[]
      setDepartments(data)
      if (!selectedDepartment && data.length > 0) {
        setSelectedDepartment(data[0])
      }
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, departments: false }))
    }
  }

  useEffect(() => {
    void fetchTemplates()
    void fetchCampaigns()
    void fetchCampaignSummaries()
    void fetchSenders()
    void fetchRecipients()
    void fetchDepartments()
  }, [])

  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id)
    }
  }, [campaigns, selectedCampaignId])

  function formatSeconds(seconds: number) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours}h ${minutes}m ${secs}s`
  }

  function formatDuration(clickedAt: string, startedAt?: string | null) {
    if (!startedAt) {
      return '—'
    }
    const diff = (new Date(clickedAt).getTime() - new Date(startedAt).getTime()) / 1000
    return formatSeconds(Math.max(diff, 0))
  }

  function formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString() : '—'
  }

  function getNextTableY(doc: jsPDF, fallback: number) {
    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
    return docWithTable.lastAutoTable?.finalY ? docWithTable.lastAutoTable.finalY + 8 : fallback
  }

  const exportOverallPdf = async () => {
    const doc = new jsPDF()
    const generatedAt = new Date().toLocaleString()
    doc.setFontSize(16)
    doc.text('Click overview - Overall', 14, 18)
    doc.setFontSize(10)
    doc.text(`Generated: ${generatedAt}`, 14, 24)

    autoTable(doc, {
      startY: 30,
      head: [['Campaigns', 'Sent', 'Clicks', 'Gefaehrdungsindex']],
      body: [[`${overallCampaigns}`, `${overallSends}`, `${overallClicks}`, `${overallRisk}%`]],
      theme: 'grid',
    })

    const summaryRows = startedCampaigns.map((campaign) => {
      const summary = summaryById.get(campaign.id)
      const total = summary?.recipientTotal ?? campaign.recipientCount ?? 0
      const clicked = summary?.clickedRecipients ?? 0
      const rate = total > 0 ? Math.round((clicked / total) * 100) : 0
      return [
        campaign.name,
        `${total}`,
        `${clicked}`,
        `${rate}%`,
        formatDateTime(summary?.firstClickAt),
        summary?.avgSeconds ? formatSeconds(summary.avgSeconds) : '—',
      ]
    })

    autoTable(doc, {
      startY: getNextTableY(doc, 40),
      head: [['Campaign', 'Recipients', 'Clicked', 'Click rate', 'First click', 'Avg. click']],
      body: summaryRows.length > 0 ? summaryRows : [['No started campaigns yet.', '', '', '', '', '']],
      theme: 'grid',
    })

    // Für jede Campaign die Click-Events laden und exportieren
    for (const campaign of startedCampaigns) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text(`Click Events - ${campaign.name}`, 14, 18)
      try {
        const response = await fetch(`${apiBase}/api/campaigns/${campaign.id}/clicks`)
        if (!response.ok) throw new Error('Failed to load clicks')
        const data = (await response.json()) as Partial<ClickSummary>
        const clickItems = data.items ?? []
        if (clickItems.length > 0) {
          autoTable(doc, {
            startY: 24,
            head: [['Recipient', 'Clicks', 'First click', 'Tenant', 'IP', 'User agent']],
            body: clickItems.map((item) => [
              item.recipientEmail,
              `${item.clickCount}`,
              formatDateTime(item.createdAt),
              item.tenantName || '—',
              item.ip || '—',
              item.userAgent || '—',
            ]),
            theme: 'grid',
          })
        } else {
          doc.text('No click events for this campaign.', 14, 30)
        }
      } catch (err) {
        doc.text('Error loading click events.', 14, 30)
      }
    }

    doc.save(`click-overview-overall-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const exportCampaignPdf = () => {
    if (!selectedCampaign) {
      setStatus('Select a campaign to export.')
      return
    }

    const doc = new jsPDF()
    const generatedAt = new Date().toLocaleString()
    const summary = summaryById.get(selectedCampaign.id)
    const total = summary?.recipientTotal ?? selectedCampaign.recipientCount ?? 0
    const clicked = summary?.clickedRecipients ?? clickStats?.uniqueRecipients ?? 0
    const rate = total > 0 ? Math.round((clicked / total) * 100) : 0
    const totalClicks = clickStats?.totalClicks ?? clicks.reduce((sum, item) => sum + item.clickCount, 0)

    doc.setFontSize(16)
    doc.text(`Click overview - ${selectedCampaign.name}`, 14, 18)
    doc.setFontSize(10)
    doc.text(`Generated: ${generatedAt}`, 14, 24)

    autoTable(doc, {
      startY: 30,
      head: [['Status', 'Sender', 'Started', 'Window', 'Recipients']],
      body: [[
        selectedCampaign.status,
        selectedCampaign.senderEmail || 'Env default',
        formatDateTime(selectedCampaign.startedAt),
        `${selectedCampaign.startDate ? new Date(selectedCampaign.startDate).toLocaleDateString() : 'Any'} - ${selectedCampaign.endDate ? new Date(selectedCampaign.endDate).toLocaleDateString() : 'Any'}`,
        `${total}`,
      ]],
      theme: 'grid',
    })

    autoTable(doc, {
      startY: getNextTableY(doc, 40),
      head: [['Clicked', 'Click rate', 'Total clicks', 'First click', 'Avg. click']],
      body: [[
        `${clicked}`,
        `${rate}%`,
        `${totalClicks}`,
        formatDateTime(clickStats?.firstClickAt || summary?.firstClickAt),
        clickStats?.avgSeconds ? formatSeconds(clickStats.avgSeconds) : summary?.avgSeconds ? formatSeconds(summary.avgSeconds) : '—',
      ]],
      theme: 'grid',
    })

    if (clickTimeline.length > 0) {
      autoTable(doc, {
        startY: getNextTableY(doc, 40),
        head: [['Date', 'Clicks']],
        body: clickTimeline.map((entry) => [entry.date, `${entry.count}`]),
        theme: 'grid',
      })
    } else {
      doc.text('No click activity yet.', 14, getNextTableY(doc, 40))
    }

    if (clicks.length > 0) {
      autoTable(doc, {
        startY: getNextTableY(doc, 60),
        head: [['Recipient', 'Clicks', 'First click', 'Tenant', 'IP', 'User agent']],
        body: clicks.map((item) => [
          item.recipientEmail,
          `${item.clickCount}`,
          formatDateTime(item.createdAt),
          item.tenantName || '—',
          item.ip || '—',
          item.userAgent || '—',
        ]),
        theme: 'grid',
      })
    }

    doc.save(`click-overview-${selectedCampaign.name}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  useEffect(() => {
    if (recipientMode === 'department') {
      if (selectedDepartment) {
        void fetchRecipients(selectedDepartment)
      }
      return
    }

    if (recipientFilterDepartment) {
      void fetchRecipients(recipientFilterDepartment)
      return
    }

    void fetchRecipients()
  }, [recipientMode, selectedDepartment, recipientFilterDepartment])

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      subject: '',
      body: '<p>Hello,</p>\n<p>Please review this update.</p>\n<p><a href="{{tracking_url}}">Open message</a></p>',
    })
    setEditingTemplateId(null)
  }

  const handleSubmitTemplate = async (event: FormEvent) => {
    event.preventDefault()
    setLoading((prev) => ({ ...prev, submitTemplate: true }))
    setStatus(null)
    try {
      const isEditing = Boolean(editingTemplateId)
      const url = isEditing
        ? `${apiBase}/api/templates/${editingTemplateId}`
        : `${apiBase}/api/templates`
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      })
      if (!response.ok) {
        throw new Error(isEditing ? 'Template update failed' : 'Template creation failed')
      }
      resetTemplateForm()
      await fetchTemplates()
      setStatus(isEditing ? 'Template updated.' : 'Template created.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, submitTemplate: false }))
    }
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id)
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
    })
    setPreviewMode('draft')
  }

  const handleDeleteTemplate = async (templateId: string) => {
    const confirmed = window.confirm('Delete this template? This cannot be undone.')
    if (!confirmed) {
      return
    }
    setDeletingTemplateId(templateId)
    setStatus(null)
    try {
      const response = await fetch(`${apiBase}/api/templates/${templateId}`, {
        method: 'DELETE',
      })
      if (response.status === 409) {
        throw new Error('Template is in use by a campaign.')
      }
      if (!response.ok) {
        throw new Error('Template deletion failed')
      }
      await fetchTemplates()
      setStatus('Template deleted.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setDeletingTemplateId(null)
    }
  }

  const handleCreateCampaign = async (event: FormEvent) => {
    event.preventDefault()
    setLoading((prev) => ({ ...prev, submitCampaign: true }))
    setStatus(null)
    try {
      let recipientsForCampaign = [] as Array<{ email: string }>
      if (recipientMode === 'single' || recipientMode === 'multiple') {
        recipientsForCampaign = Array.from(selectedRecipients).map((email) => ({ email }))
      } else if (recipientMode === 'department') {
        recipientsForCampaign = recipients.map((recipient) => ({ email: recipient.email }))
      } else if (recipientMode === 'all') {
        recipientsForCampaign = recipients.map((recipient) => ({ email: recipient.email }))
      }

      if (recipientsForCampaign.length === 0) {
        throw new Error('Please select at least one recipient.')
      }
      const payload = {
        name: campaignForm.name,
        templateId: campaignForm.templateId,
        senderEmail: campaignForm.senderEmail || undefined,
        startDate: campaignForm.startDate || undefined,
        endDate: campaignForm.endDate || undefined,
        recipients: recipientsForCampaign,
      }
      const response = await fetch(`${apiBase}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error('Campaign creation failed')
      }
      setCampaignForm((prev) => ({ ...prev, name: '', recipientsRaw: '' }))
      setSelectedRecipients(new Set())
      await fetchCampaigns()
      setStatus('Campaign created.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setLoading((prev) => ({ ...prev, submitCampaign: false }))
    }
  }

  const handleStartCampaign = async (campaignId: string) => {
    setStatus(null)
    try {
      const response = await fetch(`${apiBase}/api/campaigns/${campaignId}/start`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to start campaign')
      }
      await fetchCampaigns()
      setStatus('Campaign started.')
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    const confirmed = window.confirm('Delete this campaign and all recipients? This cannot be undone.')
    if (!confirmed) {
      return
    }
    setDeletingCampaignId(campaignId)
    setStatus(null)
    try {
      const response = await fetch(`${apiBase}/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Campaign deletion failed')
      }
      await fetchCampaigns()
      setStatus('Campaign deleted.')
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setDeletingCampaignId(null)
    }
  }


  // Login- und Settings-States

  // Login-States aus .env
  const envUser = import.meta.env.VITE_LOGIN_USER || ''
  const envPass = import.meta.env.VITE_LOGIN_PASS || ''
  const [user, setUser] = useState<string>(envUser)
  const [pass, setPass] = useState<string>(envPass)
  const [token, setToken] = useState<string>(() => localStorage.getItem('paa_token') || '')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // Login-Handler mit User/Pass
  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      if (!user || !pass) {
        setLoginError('Bitte Benutzer und Passwort eingeben.')
        return
      }
      // Dummy-Login: User/Pass prüfen gegen .env
      if (user === envUser && pass === envPass) {
        const fakeToken = btoa(`${user}:${pass}`)
        localStorage.setItem('paa_token', fakeToken)
        setToken(fakeToken)
        setLoginError(null)
      } else {
        setLoginError('Login fehlgeschlagen: falsche Daten.')
      }
    } catch (error) {
      setLoginError('Login fehlgeschlagen.')
    } finally {
      setLoginLoading(false)
    }
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('paa_token')
    setToken('')
  }

  // Login-Panel
  if (!token) {
    return (
      <div className="login-panel">
        <h2>Login erforderlich</h2>
        <form onSubmit={handleLogin} className="form">
          <label>
            Benutzer
            <input
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="Benutzer"
              required
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Passwort"
              required
            />
          </label>
          <button type="submit" disabled={loginLoading}>
            {loginLoading ? 'Einloggen...' : 'Login'}
          </button>
          {loginError ? <div className="status danger">{loginError}</div> : null}
        </form>
      </div>
    )
  }


  // Tenant Credentials State (aus LocalStorage oder leer)
  const [tenantId, setTenantId] = useState<string>(() => localStorage.getItem('tenant_id') || '')
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem('client_id') || '')
  const [clientSecret, setClientSecret] = useState<string>(() => localStorage.getItem('client_secret') || '')
  const [credStatus, setCredStatus] = useState<string | null>(null)

  // Speichern
  const handleSaveCreds = async (e: FormEvent) => {
    e.preventDefault()
    setCredStatus('Speichere...')
    try {
      const res = await fetch('/api/settings/azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          AZURE_TENANT_ID: tenantId,
          AZURE_CLIENT_ID: clientId,
          AZURE_CLIENT_SECRET: clientSecret,
        })
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      // Optional: auch weiterhin im LocalStorage speichern
      localStorage.setItem('tenant_id', tenantId)
      localStorage.setItem('client_id', clientId)
      localStorage.setItem('client_secret', clientSecret)
      setCredStatus('Gespeichert!')
    } catch (err) {
      setCredStatus('Fehler beim Speichern!')
    }
    setTimeout(() => setCredStatus(null), 2000)
  }

  // Dummy-Validierung (nur Format prüfen, keine API)
  const handleValidateCreds = () => {
    if (!tenantId || !clientId || !clientSecret) {
      setCredStatus('Bitte alle Felder ausfüllen.')
      return
    }
    if (tenantId.length < 10 || clientId.length < 10 || clientSecret.length < 10) {
      setCredStatus('Ungültiges Format.')
      return
    }
    setCredStatus('Validierung erfolgreich!')
    setTimeout(() => setCredStatus(null), 2000)
  }

  // Settings-Panel mit Eingabefeldern
  const SettingsPanel = () => (
    <div className="settings-panel">
      <h2>Tenant Credentials</h2>
      <form onSubmit={handleSaveCreds} className="form">
        <label>
          Tenant ID
          <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant ID" required />
        </label>
        <label>
          Client ID
          <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" required />
        </label>
        <label>
          Client Secret
          <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Client Secret" required />
        </label>
        <button type="submit">Speichern</button>
        <button type="button" className="ghost" style={{marginLeft:8}} onClick={handleValidateCreds}>Validieren</button>
        {credStatus ? <div className="status" style={{marginTop:8}}>{credStatus}</div> : null}
      </form>
    </div>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="kicker">Phishing Awareness Admin</p>
          <h1>Security campaigns command center.</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost"
            onClick={() => setView('home')}
            disabled={view === 'home'}
          >
            Menu
          </button>
          <button className="ghost" onClick={() => void fetchCampaigns()}>
            Refresh
          </button>
          <button className="ghost danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {status ? <div className="status">{status}</div> : null}

      {view === 'home' ? (
        <section className="menu-grid">
          <div className="menu-card" onClick={() => setView('templates')}>
            <div>
              <h2>Templates</h2>
              <p>Create HTML messages and define the tracking placeholder.</p>
            </div>
            <div className="menu-meta">
              <span>{templateCount} total</span>
              <span>Last updated now</span>
            </div>
          </div>
          <div className="menu-card" onClick={() => setView('campaigns')}>
            <div>
              <h2>Campaigns</h2>
              <p>Configure sender identity, recipients, and launch runs.</p>
            </div>
            <div className="menu-meta">
              <span>{campaignCount} total</span>
              <span>Drafts and active</span>
            </div>
          </div>
          <div className="menu-card" onClick={() => setView('tracking')}>
            <div>
              <h2>Tracking</h2>
              <p>Review campaign click reports and statistics.</p>
            </div>
            <div className="menu-meta">
              <span>Report</span>
              <span>Analytics</span>
            </div>
          </div>
          <div className="menu-card" onClick={() => setView('settings')}>
            <div>
              <h2>Settings</h2>
              <p>Manage Tenant Credentials (Azure).</p>
            </div>
            <div className="menu-meta">
              <span>Tenant</span>
              <span>Credentials</span>
            </div>
          </div>
          <div className="menu-card info">
            <div>
              <h2>Quick guide</h2>
              <ol>
                <li>Design a template with {'{{tracking_url}}'}.</li>
                <li>Create a campaign with recipients.</li>
                <li>Start the campaign and monitor clicks.</li>
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      {view === 'settings' ? (
        <section className="grid">
          <div className="panel">
            <button className="ghost" style={{float:'right'}} onClick={() => setView('home')}>Zurück</button>
            <SettingsPanel />
          </div>
        </section>
      ) : null}

      {view === 'tracking' ? (
        <section className="grid">
          <div className="panel analytics">
            <div className="analytics-header">
              <div>
                <h2>Click overview</h2>
                <p>Clear view of who clicked within the selected campaign.</p>
                {summaryError ? <div className="status warning">{summaryError}</div> : null}
              </div>
              <div className="analytics-actions">
                <button type="button" className="ghost" onClick={exportOverallPdf}>
                  Export overall PDF
                </button>
                <button type="button" onClick={exportCampaignPdf}>
                  Export campaign PDF
                </button>
              </div>
            </div>
            <div>
              <h3>Overall KPI (started campaigns)</h3>
              <div className="analytics-summary">
                <div>
                  <h3>Campaigns</h3>
                  <strong>{overallCampaigns}</strong>
                </div>
                <div>
                  <h3>Sent</h3>
                  <strong>{overallSends}</strong>
                </div>
                <div>
                  <h3>Clicks</h3>
                  <strong>{overallClicks}</strong>
                </div>
                <div>
                  <h3>Hazardsindex</h3>
                  <strong>{overallRisk}%</strong>
                </div>
              </div>
            </div>
            <div className="analytics-summary">
              <div>
                <h3>Recipients</h3>
                <strong>{recipientTotal}</strong>
              </div>
              <div>
                <h3>Clicked</h3>
                <strong>{clickedCount}</strong>
              </div>
              <div>
                <h3>Not clicked</h3>
                <strong>{unclickedCount}</strong>
              </div>
              <div>
                <h3>Click rate</h3>
                <strong>{clickRate}%</strong>
              </div>
            </div>
            <div className="analytics-chart">
              <h3>Clicked vs not clicked</h3>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#ff7a00 ${clickRate}%, #f0e6d8 ${clickRate}% 100%)`,
                  }}
                  aria-label={`Click rate ${clickRate} percent`}
                />
                <div className="donut-legend">
                  <div>
                    <span className="swatch clicked" /> Clicked
                  </div>
                  <div>
                    <span className="swatch pending" /> Not clicked
                  </div>
                </div>
              </div>
              <div className="analytics-footnote">
                {selectedCampaign
                  ? `Campaign: ${selectedCampaign.name}`
                  : 'Select a campaign to see results.'}
              </div>
            </div>
            <div className="analytics-chart">
              <h3>Clicks per day</h3>
              {clickTimeline.length === 0 ? (
                <div className="table-empty">No click activity yet.</div>
              ) : (
                clickTimeline.map((entry) => (
                  <div className="chart-row" key={entry.date}>
                    <span>{entry.date}</span>
                    <div className="chart-bar">
                      <div style={{ width: `${Math.min(100, entry.count * 10)}%` }} />
                    </div>
                    <strong>{entry.count}</strong>
                  </div>
                ))
              )}
            </div>
            <div className="analytics-chart">
              <h3>Click rate by campaign</h3>
              {campaignSummaries.length === 0 ? (
                <div className="table-empty">No campaign stats yet.</div>
              ) : (
                campaignSummaries.map((summary) => {
                  const rate = summary.recipientTotal
                    ? Math.round((summary.clickedRecipients / summary.recipientTotal) * 100)
                    : 0
                  return (
                    <div className="chart-row" key={summary.id}>
                      <span>{summary.name}</span>
                      <div className="chart-bar">
                        <div style={{ width: `${rate}%` }} />
                      </div>
                      <strong>{rate}%</strong>
                    </div>
                  )
                })
              )}
            </div>
            <div className="analytics-card">
              <h3>First & average click</h3>
              <div className="metric-row">
                <span>First Link Clicked</span>
                <strong>{firstClickedLabel}</strong>
              </div>
              <div className="metric-row">
                <span>Avg. Link Clicked</span>
                <strong>{avgClickedLabel}</strong>
              </div>
            </div>
          </div>
          <div className="panel list">
            <div className="panel-header">
              <div>
                <h2>Campaigns</h2>
                <p>Choose a campaign to inspect click activity.</p>
              </div>
              <button onClick={() => void fetchCampaigns()} disabled={loading.campaigns}>
                {loading.campaigns ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="table campaigns-table">
              <div className="table-head">
                <span>Name</span>
                <span>Status</span>
                <span>Recipients</span>
                <span>Window</span>
              </div>
              {campaigns.length === 0 ? (
                <div className="table-empty">No campaigns yet.</div>
              ) : (
                campaigns.map((campaign) => (
                  <div
                    className={`table-row ${selectedCampaignId === campaign.id ? 'selected' : ''}`}
                    key={campaign.id}
                    onClick={() => {
                      setSelectedCampaignId(campaign.id)
                      void fetchClicks(campaign.id)
                    }}
                  >
                    <span>{campaign.name}</span>
                    <span className={`status-pill status-${campaign.status.toLowerCase()}`}>
                      {campaign.status}
                    </span>
                    <span>{campaign.recipientCount}</span>
                    <span>
                      {campaign.startDate || campaign.endDate
                        ? `${campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'Any'} – ${campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'Any'}`
                        : 'Any'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="panel list">
            <div className="panel-header">
              <div>
                <h2>Click Events</h2>
                <p>Selection fills the click list on the right.</p>
              </div>
              <button
                onClick={() => void fetchClicks(selectedCampaignId)}
                disabled={loading.clicks || !selectedCampaignId}
              >
                {loading.clicks ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="click-toolbar">
              <span className="click-count">{clicks.length} clicks</span>
            </div>
            <div className="table clicks-table">
              <div className="table-head">
                <span>Time</span>
                <span>Recipient</span>
                <span>Tenant</span>
                <span>IP</span>
                <span>Clicks</span>
              </div>
              {clicks.length === 0 ? (
                <div className="table-empty">No clicks yet.</div>
              ) : (
                clicks.map((click) => (
                  <div className="table-row" key={click.id}>
                    <span>{new Date(click.createdAt).toLocaleString()}</span>
                    <span>{click.recipientEmail}</span>
                    <span>{click.tenantName || 'Unknown'}</span>
                    <span>{click.ip || '-'}</span>
                    <span>{click.clickCount}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

   

      {view === 'templates' ? (
        <section className="grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>New Template</h2>
                <p>HTML enabled. Use the tracking token when needed.</p>
              </div>
              <button className="ghost" onClick={() => setView('home')}>
                Back to menu
              </button>
            </div>
            <form onSubmit={handleSubmitTemplate} className="form">
              <label>
                Name
                <input
                  value={templateForm.name}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Quarterly Awareness"
                  required
                />
              </label>
              <label>
                Subject
                <input
                  value={templateForm.subject}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
                  }
                  placeholder="Action required: policy update"
                  required
                />
              </label>
              <label style={{position:'relative'}}>
                HTML Body
                <span style={{position:'absolute',right:0,top:-24,fontSize:'0.9em',color:'#888'}} title="Verfügbare Platzhalter: {{Vorname}}, {{Nachname}}, {{tracking_url}}, {{tenant_name}}, {{absender_vorname}}, {{absender_nachname}}, {{absender_mail}}, {{date_time}}">
                  <span style={{borderBottom:'1px dotted #888',cursor:'help'}}>ℹ Platzhalter: &#123;&#123;Vorname&#125;&#125;, &#123;&#123;Nachname&#125;&#125;, &#123;&#123;tracking_url&#125;&#125;, &#123;&#123;tenant_name&#125;&#125;, &#123;&#123;absender_vorname&#125;&#125;, &#123;&#123;absender_nachname&#125;&#125;, &#123;&#123;absender_mail&#125;&#125;, &#123;&#123;date_time&#125;&#125;</span>
                </span>
                <textarea
                  rows={10}
                  value={templateForm.body}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, body: event.target.value }))
                  }
                />
              </label>
              <button type="submit" disabled={loading.submitTemplate}>
                {loading.submitTemplate
                  ? editingTemplateId
                    ? 'Updating...'
                    : 'Creating...'
                  : editingTemplateId
                    ? 'Update template'
                    : 'Create template'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setPreviewMode('draft')}
              >
                Preview draft
              </button>
              {editingTemplateId ? (
                <button type="button" className="ghost" onClick={resetTemplateForm}>
                  Cancel edit
                </button>
              ) : null}
            </form>
          </div>

          <div className="panel list">
            <div className="panel-header">
              <div>
                <h2>Templates</h2>
                <p>Review what is ready for the next campaign.</p>
              </div>
              <button onClick={() => void fetchTemplates()} disabled={loading.templates}>
                {loading.templates ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="table templates-table">
              <div className="table-head">
                <span>Name</span>
                <span>Subject</span>
                <span>Created</span>
                <span>Actions</span>
              </div>
              {templates.length === 0 ? (
                <div className="table-empty">No templates yet.</div>
              ) : (
                templates.map((template) => (
                  <div className="table-row" key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <small>{template.id}</small>
                    </div>
                    <span>{template.subject}</span>
                    <span>{new Date(template.createdAt).toLocaleString()}</span>
                    <div className="table-actions">
                      <button
                        className="ghost"
                        onClick={() => {
                          setSelectedTemplateId(template.id)
                          setPreviewMode('saved')
                        }}
                      >
                        Preview
                      </button>
                      <button className="ghost" onClick={() => handleEditTemplate(template)}>
                        Edit
                      </button>
                      <button
                        className="ghost danger"
                        onClick={() => void handleDeleteTemplate(template.id)}
                        disabled={deletingTemplateId === template.id}
                      >
                        {deletingTemplateId === template.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel preview">
            <div className="panel-heading">
              <div>
                <h2>Preview</h2>
                <p>Final HTML rendering with tracking placeholder intact.</p>
              </div>
              <div className="preview-mode">
                <button
                  className={previewMode === 'draft' ? '' : 'ghost'}
                  type="button"
                  onClick={() => setPreviewMode('draft')}
                >
                  Draft
                </button>
                <button
                  className={previewMode === 'saved' ? '' : 'ghost'}
                  type="button"
                  onClick={() => setPreviewMode('saved')}
                >
                  Saved
                </button>
              </div>
            </div>
            <div className="preview-meta">
              <div>
                <span>Name</span>
                <strong>{previewTitle}</strong>
              </div>
              <div>
                <span>Subject</span>
                <strong>{previewSubject}</strong>
              </div>
            </div>
            <iframe
              className="preview-frame"
              title="Template preview"
              sandbox=""
              srcDoc={previewDoc}
            />
          </div>
        </section>
      ) : null}

      {view === 'campaigns' ? (
        <section className="grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>New Campaign</h2>
                <p>Sender address is stored per campaign for tenant-specific delivery.</p>
                {tenantId && (
                  <div style={{marginTop:8, fontSize:'0.95em', color:'#888'}}>
                    Aktueller Tenant: <strong>{tenantId}</strong>
                  </div>
                )}
              </div>
              <button className="ghost" onClick={() => setView('home')}>
                Back to menu
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="form">
              <label>
                Campaign Name
                <input
                  value={campaignForm.name}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Security Drill Q1"
                  required
                />
              </label>
              <label>
                Template
                <select
                  value={campaignForm.templateId}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({ ...prev, templateId: event.target.value }))
                  }
                  disabled={loading.templates}
                  required
                >
                  {templates.length === 0 ? (
                    <option value="">Create a template first</option>
                  ) : (
                    templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label>
                Sender Email (tenant-based)
                <select
                  value={campaignForm.senderEmail}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({ ...prev, senderEmail: event.target.value }))
                  }
                  disabled={loading.senders}
                >
                  {senders.length === 0 ? (
                    <option value="">No senders found</option>
                  ) : (
                    senders.map((sender) => (
                      <option key={sender.email} value={sender.email}>
                        {sender.displayName ? `${sender.displayName} (${sender.email})` : sender.email}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="date-range">
                <label>
                  Start date
                  <input
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({ ...prev, endDate: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label>
                Recipient Mode
                <div className="recipient-modes">
                  {(['single', 'multiple', 'department', 'all'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={recipientMode === mode ? '' : 'ghost'}
                      onClick={() => {
                        setRecipientMode(mode)
                        setSelectedRecipients(new Set())
                        setRecipientSearch('')
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </label>
              {recipientMode === 'department' ? (
                <label>
                  Department
                  <select
                    value={selectedDepartment}
                    onChange={(event) => {
                      const value = event.target.value
                      setSelectedDepartment(value)
                    }}
                    disabled={loading.departments}
                  >
                    {departments.length === 0 ? (
                      <option value="">No departments found</option>
                    ) : (
                      departments.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              ) : null}
              {recipientMode === 'single' || recipientMode === 'multiple' ? (
                <div className="recipient-picker">
                  <div className="recipient-toolbar">
                    <label>
                      Department filter
                      <select
                        value={recipientFilterDepartment}
                        onChange={(event) => setRecipientFilterDepartment(event.target.value)}
                        disabled={loading.departments}
                      >
                        <option value="">All departments</option>
                        {departments.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Search recipients
                      <input
                        value={recipientSearch}
                        onChange={(event) => setRecipientSearch(event.target.value)}
                        placeholder="Search by name or email"
                      />
                    </label>
                  </div>
                  <div className="recipient-actions">
                    <span className="recipient-count">
                      Showing {visibleRecipients.length} of {recipients.length}
                    </span>
                    {recipientMode === 'multiple' ? (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setSelectedRecipients((prev) => {
                            const next = new Set(prev)
                            for (const recipient of visibleRecipients) {
                              next.add(recipient.email)
                            }
                            return next
                          })
                        }}
                      >
                        Select visible
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setSelectedRecipients(new Set())}
                      disabled={selectedCount === 0}
                    >
                      Clear ({selectedCount})
                    </button>
                  </div>
                  <div className="recipient-list">
                    {visibleRecipients.map((recipient) => {
                      const isSelected = selectedRecipients.has(recipient.email)
                      return (
                        <label key={recipient.email} className="recipient-row">
                          <input
                            type={recipientMode === 'single' ? 'radio' : 'checkbox'}
                            name="recipients"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedRecipients((prev) => {
                                const next = new Set(prev)
                                if (recipientMode === 'single') {
                                  next.clear()
                                }
                                if (next.has(recipient.email)) {
                                  next.delete(recipient.email)
                                } else {
                                  next.add(recipient.email)
                                }
                                return next
                              })
                            }}
                          />
                          <span>
                            <strong>{recipient.displayName || recipient.email}</strong>
                            <small>{recipient.email}</small>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {recipientMode === 'all' ? (
                <div className="recipient-all">
                  <p>
                    All active tenant users will be included in the campaign. Current snapshot:
                    <strong> {recipients.length}</strong>
                  </p>
                  <button type="button" className="ghost" onClick={() => void fetchRecipients()}>
                    Refresh recipients
                  </button>
                </div>
              ) : null}
              <button type="submit" disabled={loading.submitCampaign}>
                {loading.submitCampaign ? 'Creating...' : 'Create campaign'}
              </button>
            </form>
          </div>

          <div className="panel list">
            <div className="panel-header">
              <div>
                <h2>Campaigns</h2>
                <p>
                  {draftCount} drafts • {startedCount} active • {campaignCount} total
                </p>
              </div>
              <button onClick={() => void fetchCampaigns()} disabled={loading.campaigns}>
                {loading.campaigns ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="table">
              <div className="table-head">
                <span>Name</span>
                <span>Template</span>
                <span>Recipients</span>
                <span>Status</span>
                <span>Window</span>
                <span>Started</span>
                <span>Sender</span>
                <span>Actions</span>
              </div>
              {campaigns.length === 0 ? (
                <div className="table-empty">No campaigns yet.</div>
              ) : (
                campaigns.map((campaign) => (
                  <div className="table-row" key={campaign.id}>
                    <div>
                      <strong>{campaign.name}</strong>
                      <small>{new Date(campaign.createdAt).toLocaleString()}</small>
                    </div>
                    <span>{campaign.templateName}</span>
                    <span>{campaign.recipientCount}</span>
                    <span className={`status-pill status-${campaign.status.toLowerCase()}`}>
                      {campaign.status}
                    </span>
                    <span>
                      {campaign.startDate || campaign.endDate
                        ? `${campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'Any'} – ${campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'Any'}`
                        : 'Any'}
                    </span>
                    <span>
                      {campaign.startedAt
                        ? new Date(campaign.startedAt).toLocaleString()
                        : 'Not started'}
                    </span>
                    <span>{campaign.senderEmail || 'Env default'}</span>
                    <div className="table-actions">
                      <button
                        onClick={() => void handleStartCampaign(campaign.id)}
                        disabled={campaign.status !== 'DRAFT'}
                      >
                        Start
                      </button>
                      <button
                        className="ghost danger"
                        onClick={() => void handleDeleteCampaign(campaign.id)}
                        disabled={deletingCampaignId === campaign.id}
                      >
                        {deletingCampaignId === campaign.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>
      ) : null}

      {view === 'settings' ? (
        <section className="grid">
          <div className="panel analytics">
            <div className="analytics-header">
              <div>
                <h2>Click overview</h2>
                <p>Clear view of who clicked within the selected campaign.</p>
                {summaryError ? <div className="status warning">{summaryError}</div> : null}
              </div>
              <div className="analytics-actions">
                <button type="button" className="ghost" onClick={exportOverallPdf}>
                  Export overall PDF
                </button>
                <button type="button" onClick={exportCampaignPdf}>
                  Export campaign PDF
                </button>
              </div>
            </div>
            <div>
              <h3>Overall KPI (started campaigns)</h3>
              <div className="analytics-summary">
                <div>
                  <h3>Campaigns</h3>
                  <strong>{overallCampaigns}</strong>
                </div>
                <div>
                  <h3>Sent</h3>
                  <strong>{overallSends}</strong>
                </div>
                <div>
                  <h3>Clicks</h3>
                  <strong>{overallClicks}</strong>
                </div>
                <div>
                  <h3>Hazardsindex</h3>
                  <strong>{overallRisk}%</strong>
                </div>
              </div>
            </div>
            <div className="analytics-summary">
              <div>
                <h3>Recipients</h3>
                <strong>{recipientTotal}</strong>
              </div>
              <div>
                <h3>Clicked</h3>
                <strong>{clickedCount}</strong>
              </div>
              <div>
                <h3>Not clicked</h3>
                <strong>{unclickedCount}</strong>
              </div>
              <div>
                <h3>Click rate</h3>
                <strong>{clickRate}%</strong>
              </div>
            </div>
            <div className="analytics-chart">
              <h3>Clicked vs not clicked</h3>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#ff7a00 ${clickRate}%, #f0e6d8 ${clickRate}% 100%)`,
                  }}
                  aria-label={`Click rate ${clickRate} percent`}
                />
                <div className="donut-legend">
                  <div>
                    <span className="swatch clicked" /> Clicked
                  </div>
                  <div>
                    <span className="swatch pending" /> Not clicked
                  </div>
                </div>
              </div>
              <div className="analytics-footnote">
                {selectedCampaign
                  ? `Campaign: ${selectedCampaign.name}`
                  : 'Select a campaign to see results.'}
              </div>
            </div>
            <div className="analytics-chart">
              <h3>Clicks per day</h3>
              {clickTimeline.length === 0 ? (
                <div className="table-empty">No click activity yet.</div>
              ) : (
                clickTimeline.map((entry) => (
                  <div className="chart-row" key={entry.date}>
                    <span>{entry.date}</span>
                    <div className="chart-bar">
                      <div style={{ width: `${Math.min(100, entry.count * 10)}%` }} />
                    </div>
                    <strong>{entry.count}</strong>
                  </div>
                ))
              )}
            </div>
            <div className="analytics-chart">
              <h3>Click rate by campaign</h3>
              {campaignSummaries.length === 0 ? (
                <div className="table-empty">No campaign stats yet.</div>
              ) : (
                campaignSummaries.map((summary) => {
                  const rate = summary.recipientTotal
                    ? Math.round((summary.clickedRecipients / summary.recipientTotal) * 100)
                    : 0
                  return (
                    <div className="chart-row" key={summary.id}>
                      <span>{summary.name}</span>
                      <div className="chart-bar">
                        <div style={{ width: `${rate}%` }} />
                      </div>
                      <strong>{rate}%</strong>
                    </div>
                  )
                })
              )}
            </div>
            <div className="analytics-card">
              <h3>First & average click</h3>
              <div className="metric-row">
                <span>First Link Clicked</span>
                <strong>{firstClickedLabel}</strong>
              </div>
              <div className="metric-row">
                <span>Avg. Link Clicked</span>
                <strong>{avgClickedLabel}</strong>
              </div>
            </div>
          </div>
          <div className="panel list">
            <div className="panel-header">
              <div>
                <h2>Campaigns</h2>
                <p>Choose a campaign to inspect click activity.</p>
              </div>
              <button onClick={() => void fetchCampaigns()} disabled={loading.campaigns}>
                {loading.campaigns ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="table campaigns-table">
              <div className="table-head">
                <span>Name</span>
                <span>Status</span>
                <span>Recipients</span>
                <span>Window</span>
              </div>
              {campaigns.length === 0 ? (
                <div className="table-empty">No campaigns yet.</div>
              ) : (
                campaigns.map((campaign) => (
                  <div
                    className={`table-row ${selectedCampaignId === campaign.id ? 'selected' : ''}`}
                    key={campaign.id}
                    onClick={() => {
                      setSelectedCampaignId(campaign.id)
                      void fetchClicks(campaign.id)
                    }}
                  >
                    <span>{campaign.name}</span>
                    <span className={`status-pill status-${campaign.status.toLowerCase()}`}>
                      {campaign.status}
                    </span>
                    <span>{campaign.recipientCount}</span>
                    <span>
                      {campaign.startDate || campaign.endDate
                        ? `${campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'Any'} – ${campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'Any'}`
                        : 'Any'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="panel list">
            <div className="panel-header">
              <div>
                <h2>Click Events</h2>
                <p>Selection fills the click list on the right.</p>
              </div>
              <button
                onClick={() => void fetchClicks(selectedCampaignId)}
                disabled={loading.clicks || !selectedCampaignId}
              >
                {loading.clicks ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="click-toolbar">
              <span className="click-count">{clicks.length} clicks</span>
            </div>
            <div className="table clicks-table">
              <div className="table-head">
                <span>Time</span>
                <span>Recipient</span>
                <span>Tenant</span>
                <span>IP</span>
                <span>Clicks</span>
              </div>
              {clicks.length === 0 ? (
                <div className="table-empty">No clicks yet.</div>
              ) : (
                clicks.map((click) => (
                  <div className="table-row" key={click.id}>
                    <span>{new Date(click.createdAt).toLocaleString()}</span>
                    <span>{click.recipientEmail}</span>
                    <span>{click.tenantName || 'Unknown'}</span>
                    <span>{click.ip || '-'}</span>
                    <span>{click.clickCount}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default App