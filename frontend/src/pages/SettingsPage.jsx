import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { settingsApi, authApi, reportsApi } from '../api/endpoints';
import { downloadAuthenticatedFile } from '../utils/download';
import {
  Building,
  CreditCard,
  FileText,
  Lock,
  Sliders,
  Download,
  Info,
  Shield,
  Upload,
  Image as ImageIcon,
  Crop,
  RefreshCw,
  X,
  ZoomIn,
  Eye,
  EyeOff,
  QrCode,
  Check,
  CheckCircle2,
  Database,
  Activity,
  Layers,
  Sparkles,
  Server,
  Globe,
  Phone,
  Mail,
  MapPin,
  Tag,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';

export function SettingsPage() {
  const { businessProfile, templateSettings, featureFlags, refreshSettings, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  // Business Profile Form State
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('teammemotrix@gmail.com');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('33');
  const [gstin, setGstin] = useState('');
  const [website, setWebsite] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoOriginalUrl, setLogoOriginalUrl] = useState('');

  // Export State
  const [exportMonth, setExportMonth] = useState('');
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Payment Settings Form State
  const [payeeName, setPayeeName] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [defaultTransactionNote, setDefaultTransactionNote] = useState('');
  const [showQrCode, setShowQrCode] = useState(true);
  const [showUpiText, setShowUpiText] = useState(true);

  // QR Code Preview Modal State
  const [isPreviewQrModalOpen, setIsPreviewQrModalOpen] = useState(false);
  const [previewQrDataUri, setPreviewQrDataUri] = useState('');
  const [previewUpiString, setPreviewUpiString] = useState('');
  const [isLoadingQrPreview, setIsLoadingQrPreview] = useState(false);

  // Logo Viewport Drag & Zoom State
  const [logoZoom, setLogoZoom] = useState(1.0);
  const [logoX, setLogoX] = useState(0.0);
  const [logoY, setLogoY] = useState(0.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragInitialPos, setDragInitialPos] = useState({ x: 0, y: 0 });

  // Logo Cropping & Upload Modal State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [cropScale, setCropScale] = useState(1);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Bill Template Form State
  const [terms, setTerms] = useState('');
  const [execLabel, setExecLabel] = useState('Executed by');
  const [execValue, setExecValue] = useState('Authorized Signatory');
  const [invoicePrefix, setInvoicePrefix] = useState('MTX-2026-');
  const [logoPosition, setLogoPosition] = useState('right');
  const [signaturePosition, setSignaturePosition] = useState('right');

  // Feature Toggles State
  const [barcodeEnabled, setBarcodeEnabled] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (businessProfile) {
      setBusinessName(businessProfile.business_name || 'Memotrix');
      setPhone(businessProfile.phone || '6384241882');
      setEmail(businessProfile.email || 'teammemotrix@gmail.com');
      setAddress(businessProfile.address || '');
      setStateCode(businessProfile.state_code || '33');
      setGstin(businessProfile.gstin || '');
      setWebsite(businessProfile.website || '');
      setGstEnabled(!!businessProfile.gst_enabled);
      setUpiId(businessProfile.upi_id || '');
      setLogoUrl(businessProfile.logo_url || '/logo-default.png');
      setPayeeName(businessProfile.payee_name || businessProfile.business_name || 'Memotrix');
      setMerchantName(businessProfile.merchant_name || '');
      setCurrency(businessProfile.currency || 'INR');
      setDefaultTransactionNote(businessProfile.default_transaction_note || '');
      setShowQrCode(businessProfile.show_qr_code !== false);
      setShowUpiText(businessProfile.show_upi_text !== false);
    }
    if (templateSettings) {
      setTerms(templateSettings.terms_and_conditions || '');
      setExecLabel(templateSettings.executed_by_label || 'Executed by');
      setExecValue(templateSettings.executed_by_value || 'Authorized Signatory');
    }
    if (featureFlags) {
      setBarcodeEnabled(!!featureFlags.barcode_enabled);
      setLoyaltyEnabled(!!featureFlags.loyalty_enabled);
    }
  }, [businessProfile, templateSettings, featureFlags]);

  // Password Strength Calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    if (pass.length < 8) return { score: 1, label: 'Too Weak (min 8 chars)', color: 'text-rose-600 bg-rose-500' };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    
    if (hasLetters && hasNumbers && hasSpecial && pass.length >= 10) {
      return { score: 3, label: 'Strong', color: 'text-emerald-600 bg-emerald-500' };
    }
    if (hasLetters && (hasNumbers || hasSpecial)) {
      return { score: 2, label: 'Medium', color: 'text-amber-600 bg-amber-500' };
    }
    return { score: 1, label: 'Weak', color: 'text-rose-600 bg-rose-500' };
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const isPasswordFormValid = Boolean(
    oldPassword &&
    newPassword &&
    confirmPassword &&
    newPassword === confirmPassword &&
    newPassword.length >= 8
  );

  // File Select Handler for Original High-Res Logo (Lossless & Unlimited File Size)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast('Unsupported image format. Please select PNG, JPG, JPEG, SVG, or WebP.', 'error');
      return;
    }

    setIsUploadingLogo(true);
    showToast('Uploading original high-resolution logo...', 'info');

    try {
      console.log('[LOGO UPLOAD STEP 1] Preparing FormData for file:', file.name, file.type, file.size);
      const formData = new FormData();
      formData.append('logo', file);

      console.log('[LOGO UPLOAD STEP 2] Sending FormData to /api/settings/upload-logo...');
      const res = await settingsApi.uploadLogo(formData);
      console.log('[LOGO UPLOAD STEP 3] Upload response:', res.data);

      const newLogoUrl = res.data.logoUrl || res.data.logoOriginalUrl || res.data.logo_url;

      setLogoUrl(newLogoUrl);
      setLogoOriginalUrl(newLogoUrl);
      setLogoZoom(1.0);
      setLogoX(0.0);
      setLogoY(0.0);

      console.log('[LOGO UPLOAD STEP 4] Refreshing business profile settings...');
      await refreshSettings();

      console.log('[LOGO UPLOAD SUCCESS] Logo updated successfully to:', newLogoUrl);
      showToast('Logo Updated Successfully.', 'success');
      setIsAdjustModalOpen(true);
    } catch (err) {
      console.error('[LOGO UPLOAD ERROR] Exception details:', err);
      showToast(err.response?.data?.error || err.message || 'Failed to upload logo.', 'error');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Mouse Drag / Touch Pan Event Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragInitialPos({ x: logoX, y: logoY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setLogoX(dragInitialPos.x + dx);
    setLogoY(dragInitialPos.y + dy);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setLogoZoom(prev => Math.min(Math.max(parseFloat((prev + delta).toFixed(2)), 0.1), 3.0));
  };

  // Save Logo Layout & Zoom Settings
  const handleSaveLogoSettings = async () => {
    try {
      showToast('Saving logo layout settings...', 'info');
      await settingsApi.updateBusinessProfile({
        business_name: businessName,
        phone,
        email,
        address,
        state_code: stateCode,
        gstin,
        gst_enabled: gstEnabled,
        upi_id: upiId,
        website,
        logo_url: logoUrl,
        logo_original_url: logoOriginalUrl || logoUrl,
        logo_zoom: logoZoom,
        logo_x: logoX,
        logo_y: logoY
      });
      await refreshSettings();
      showToast('Logo alignment & zoom settings permanently saved!', 'success');
      setIsAdjustModalOpen(false);
    } catch (err) {
      console.error('Error saving logo settings:', err);
      showToast('Failed to save logo settings.', 'error');
    }
  };

  // Reset to Default Logo
  const handleResetLogo = async () => {
    try {
      await settingsApi.updateBusinessProfile({
        business_name: businessName,
        phone,
        email,
        address,
        state_code: stateCode,
        gstin,
        gst_enabled: gstEnabled,
        upi_id: upiId,
        website,
        logo_url: '/logo-default.png'
      });
      setLogoUrl('/logo-default.png');
      await refreshSettings();
      showToast('Logo reset to default Memotrix logo.', 'info');
    } catch (err) {
      showToast('Failed to reset logo', 'error');
    }
  };

  // Save Profile Handler
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await settingsApi.updateBusinessProfile({
        business_name: businessName,
        phone,
        email,
        address,
        state_code: stateCode,
        gstin,
        gst_enabled: gstEnabled,
        upi_id: upiId,
        website,
        logo_url: logoUrl
      });
      await settingsApi.updateBillTemplate({
        terms_and_conditions: terms,
        executed_by_label: execLabel,
        executed_by_value: execValue
      });
      await refreshSettings();
      showToast('Business profile and signatory settings saved successfully!', 'success');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update profile', 'error');
    }
  };

  // Save Payment Profile Handler
  const handleSavePaymentProfile = async (e) => {
    if (e) e.preventDefault();
    if (!upiId || !upiId.trim()) {
      showToast('UPI Payee ID cannot be empty.', 'warning');
      return;
    }
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upiId.trim())) {
      showToast('Invalid UPI Payee ID format (e.g. username@bank).', 'error');
      return;
    }

    try {
      await settingsApi.updatePaymentProfile({
        upi_id: upiId.trim(),
        payee_name: payeeName || businessName || 'Memotrix',
        merchant_name: merchantName || '',
        currency: currency || 'INR',
        default_transaction_note: defaultTransactionNote || '',
        show_qr_code: showQrCode,
        show_upi_text: showUpiText
      });
      await refreshSettings();
      showToast('UPI Payment settings saved successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update payment settings', 'error');
    }
  };

  // Preview QR Code Handler
  const handlePreviewQrCode = async () => {
    if (!upiId || !upiId.trim()) {
      showToast('Please enter a valid UPI Payee ID first.', 'warning');
      return;
    }
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upiId.trim())) {
      showToast('Invalid UPI Payee ID format (e.g. username@bank).', 'error');
      return;
    }

    setIsLoadingQrPreview(true);
    try {
      const res = await settingsApi.getQrPreview({
        upi_id: upiId.trim(),
        payee_name: payeeName || businessName || 'Memotrix',
        amount: '1.00',
        currency: currency || 'INR',
        note: defaultTransactionNote || 'SAMPLE-1001'
      });
      setPreviewQrDataUri(res.data.qrDataUri);
      setPreviewUpiString(res.data.upiString);
      setIsPreviewQrModalOpen(true);
    } catch (err) {
      showToast('Failed to generate QR code preview', 'error');
    } finally {
      setIsLoadingQrPreview(false);
    }
  };

  const handleDownloadPreviewQrPng = () => {
    if (!previewQrDataUri) return;
    const link = document.createElement('a');
    link.href = previewQrDataUri;
    link.download = `sample_upi_qr_${upiId.split('@')[0] || 'code'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample QR code PNG.', 'info');
  };

  // Save Template Handler
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      await settingsApi.updateBillTemplate({
        terms_and_conditions: terms,
        executed_by_label: execLabel,
        executed_by_value: execValue
      });
      await refreshSettings();
      showToast('Invoice template settings saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to update template settings', 'error');
    }
  };

  // Save Feature Toggles Handler
  const handleSaveFeatureToggles = async (updatedBarcode, updatedLoyalty) => {
    try {
      await settingsApi.updateFeatureFlags({
        barcode_enabled: updatedBarcode,
        loyalty_enabled: updatedLoyalty
      });
      setBarcodeEnabled(updatedBarcode);
      setLoyaltyEnabled(updatedLoyalty);
      await refreshSettings();
      showToast('Feature toggles updated successfully!', 'success');
    } catch (error) {
      showToast('Failed to update feature flags', 'error');
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !oldPassword.trim()) {
      showToast('Current password is required.', 'error');
      return;
    }
    if (!newPassword || !newPassword.trim()) {
      showToast('New password cannot be empty.', 'warning');
      return;
    }
    if (!confirmPassword || !confirmPassword.trim()) {
      showToast('Confirm password cannot be empty.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'warning');
      return;
    }
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'warning');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await authApi.changePassword({
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim()
      });
      showToast(res.data.message || 'Password updated successfully. Logging out...', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (error) {
      if (error.response?.status === 401) {
        showToast('Current password is incorrect.', 'error');
      } else {
        showToast(error.response?.data?.error || 'Failed to update password.', 'error');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleDownloadExport = async (format) => {
    if (format === 'json') setIsExportingJson(true);
    else if (format === 'csv') setIsExportingCsv(true);
    else if (format === 'excel' || format === 'xlsx') setIsExportingExcel(true);

    try {
      showToast(`Preparing ${format.toUpperCase()} export payload...`, 'info');
      let url = '';
      if (format === 'json') url = reportsApi.getExportJsonUrl(exportMonth);
      else if (format === 'csv') url = reportsApi.getExportCsvUrl(exportMonth);
      else if (format === 'excel' || format === 'xlsx') url = reportsApi.getExportExcelUrl(exportMonth);

      const filenameMonth = exportMonth || new Date().toISOString().slice(0, 7);
      const filename = `memotrix-report-${filenameMonth}.${format === 'excel' || format === 'xlsx' ? 'xlsx' : format}`;
      
      await downloadAuthenticatedFile(url, filename);
      showToast(`Exported billing data as ${filename}`, 'success');
    } catch (err) {
      console.error('Export download error:', err);
      if (err.response?.status === 404) {
        showToast(err.response?.data?.error || 'No billing data found for the selected month.', 'warning');
      } else {
        showToast('Export failed. Please try again.', 'error');
      }
    } finally {
      setIsExportingJson(false);
      setIsExportingCsv(false);
      setIsExportingExcel(false);
    }
  };

  const categories = [
    { id: 'profile', label: 'Business Profile & Logo', icon: Building, desc: 'Company identity, contact info & logo branding' },
    { id: 'payment', label: 'Payment Settings (UPI)', icon: CreditCard, desc: 'UPI ID, Payee details, QR preview & toggles' },
    { id: 'invoice', label: 'Invoice Template', icon: FileText, desc: 'Terms, signatory, prefix & layout positions' },
    { id: 'security', label: 'Security & Password', icon: Lock, desc: 'Admin authentication & password change' },
    { id: 'preferences', label: 'Preferences & Features', icon: Sliders, desc: 'Barcode scanner & system toggles' },
    { id: 'export', label: 'Data Export & Backup', icon: Download, desc: 'Export database records & backup trigger' },
    { id: 'about', label: 'About System & Health', icon: Info, desc: 'Version, technology stack & server status' },
  ];

  return (
    <div className="space-y-8">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".png,.jpg,.jpeg,.svg,.webp"
        className="hidden"
      />

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
          <Sliders className="w-6 h-6 text-blue-600 mr-2.5" />
          System Settings & Configuration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage business profile, logo branding, UPI payments, invoice templates, and system security.</p>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* LEFT VERTICAL SETTINGS NAVIGATION PANEL (280px) */}
        <div className="w-full lg:w-[280px] flex-shrink-0 lg:sticky lg:top-6 self-start space-y-4">
          <div className="card p-2.5 space-y-1">
            <div className="px-3 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Settings Navigation
            </div>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 text-left group cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`} />
                    <div className="truncate">
                      <span className="text-xs block leading-tight truncate">{cat.label}</span>
                    </div>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"></div>}
                </button>
              );
            })}
          </div>

          {/* System Health Card */}
          <div className="card p-4 space-y-3 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 text-white border-none shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">System Health</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">HEALTHY</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-700/50">
              <div className="flex justify-between"><span>Database:</span><span className="font-semibold text-white">SQLite Engine</span></div>
              <div className="flex justify-between"><span>Engine:</span><span className="font-semibold text-white">v2.4.0 Enterprise</span></div>
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT AREA (100% Fluid Width) */}
        <div className="flex-1 min-w-0 w-full space-y-6">

          {/* SECTION 1: BUSINESS PROFILE & LOGO */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              
              {/* Business Logo Card */}
              <div className="card space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                      <ImageIcon className="w-5 h-5 text-blue-600 mr-2" />
                      Business Logo Management
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Upload, crop, and manage your company logo used across invoices and app navigation.</p>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                    PNG, JPG, SVG, WebP
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center p-2 shadow-md relative overflow-hidden flex-shrink-0">
                    <img
                      src={logoUrl || '/logo-default.png'}
                      alt="Current Business Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="space-y-3 text-center sm:text-left flex-1">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Company Logo Preview</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Auto-scaled while preserving aspect ratio. Displays up to 140×80px on invoice PDFs.</p>
                    </div>

                    <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-primary py-2 text-xs flex items-center cursor-pointer"
                      >
                        <Upload className="w-4 h-4 mr-1.5" />
                        Change Logo
                      </button>

                      <button
                        type="button"
                        onClick={handleResetLogo}
                        className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Details Form */}
              <div className="card space-y-6">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                    <Building className="w-5 h-5 text-blue-600 mr-2" />
                    Company Contact & Tax Profile
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Primary business address and GST details embedded on all issued invoices.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Business Name *</label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={e => setBusinessName(e.target.value)}
                        placeholder="e.g. Memotrix Enterprise"
                        className="w-full p-2.5 form-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone *</label>
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        className="w-full p-2.5 form-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Email *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="e.g. contact@business.com"
                        className="w-full p-2.5 form-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GST Number (Optional)</label>
                      <input
                        type="text"
                        value={gstin}
                        onChange={e => setGstin(e.target.value)}
                        placeholder="e.g. 33AAAAA0000A1Z5"
                        className="w-full p-2.5 form-input text-xs uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Website URL (Optional)</label>
                      <input
                        type="text"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        placeholder="e.g. https://memotrix.com"
                        className="w-full p-2.5 form-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">State Code</label>
                      <input
                        type="text"
                        value={stateCode}
                        onChange={e => setStateCode(e.target.value)}
                        placeholder="33 (Tamil Nadu)"
                        className="w-full p-2.5 form-input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Business Address *</label>
                    <textarea
                      rows={3}
                      required
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Enter complete business street address..."
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>

                  <div className="pt-2">
                    <button type="submit" className="btn-primary cursor-pointer">
                      Save Profile & Logo Settings
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 2: PAYMENT SETTINGS (UPI) */}
          {activeTab === 'payment' && (
            <div className="card space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                    <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
                    UPI Payment & Dynamic QR Configuration
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure your UPI Payee ID to automatically generate payment QR codes on all future invoices.</p>
                </div>

                <button
                  type="button"
                  onClick={handlePreviewQrCode}
                  disabled={isLoadingQrPreview}
                  className="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-xl transition flex items-center shadow-sm cursor-pointer"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {isLoadingQrPreview ? 'Generating...' : 'Preview QR Code'}
                </button>
              </div>

              <form onSubmit={handleSavePaymentProfile} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">UPI Payee ID (VPA) *</label>
                    <input
                      type="text"
                      required
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                      placeholder="e.g. business@upi or 9876543210@paytm"
                      className="w-full p-2.5 form-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Must be a valid UPI format (username@bank).</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payee Name *</label>
                    <input
                      type="text"
                      required
                      value={payeeName}
                      onChange={e => setPayeeName(e.target.value)}
                      placeholder="e.g. Memotrix Enterprise"
                      className="w-full p-2.5 form-input text-xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Displayed to customer when scanning the QR code.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Merchant Name (Optional)</label>
                    <input
                      type="text"
                      value={merchantName}
                      onChange={e => setMerchantName(e.target.value)}
                      placeholder="e.g. Memotrix Store"
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                    <input
                      type="text"
                      disabled
                      value={currency}
                      className="w-full p-2.5 form-input text-xs bg-slate-100 dark:bg-slate-800 cursor-not-allowed font-bold text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Default Transaction Note</label>
                    <input
                      type="text"
                      value={defaultTransactionNote}
                      onChange={e => setDefaultTransactionNote(e.target.value)}
                      placeholder="Default: Invoice Number"
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Invoice Display Preferences</h4>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Show QR Code on Invoice</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Automatically embed a scannable UPI QR code on generated PDFs and view screens.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showQrCode}
                        onChange={e => setShowQrCode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Show UPI ID Text Below QR Code</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Display the plain text UPI Payee ID below the QR code image for manual payment entry.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showUpiText}
                        onChange={e => setShowUpiText(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-3">
                  <button type="submit" className="btn-primary cursor-pointer">
                    Save Payment Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 3: INVOICE TEMPLATE & BRANDING */}
          {activeTab === 'invoice' && (
            <div className="card space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  Invoice PDF & Print Template Settings
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize default signatory names, terms and conditions, and layout positions for printed invoices.</p>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice Number Prefix</label>
                    <input
                      type="text"
                      value={invoicePrefix}
                      onChange={e => setInvoicePrefix(e.target.value)}
                      placeholder="e.g. MTX-2026-"
                      className="w-full p-2.5 form-input text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Signatory Label</label>
                    <input
                      type="text"
                      value={execLabel}
                      onChange={e => setExecLabel(e.target.value)}
                      placeholder="e.g. Executed by"
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Default Signatory Name *</label>
                    <input
                      type="text"
                      required
                      value={execValue}
                      onChange={e => setExecValue(e.target.value)}
                      placeholder="e.g. Authorized Signatory"
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Logo Header Position</label>
                    <select
                      value={logoPosition}
                      onChange={e => setLogoPosition(e.target.value)}
                      className="w-full p-2.5 form-input text-xs"
                    >
                      <option value="right">Top Right (Recommended)</option>
                      <option value="left">Top Left</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Signature Area Position</label>
                    <select
                      value={signaturePosition}
                      onChange={e => setSignaturePosition(e.target.value)}
                      className="w-full p-2.5 form-input text-xs"
                    >
                      <option value="right">Bottom Right (Standard)</option>
                      <option value="left">Bottom Left</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Default Terms & Conditions</label>
                  <textarea
                    rows={4}
                    value={terms}
                    onChange={e => setTerms(e.target.value)}
                    placeholder="Enter standard terms (e.g. Goods once sold will not be taken back...)"
                    className="w-full p-2.5 form-input text-xs font-mono leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="btn-primary cursor-pointer">
                    Save Template Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 4: SECURITY & CHANGE PASSWORD */}
          {activeTab === 'security' && (
            <div className="card space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                  <Lock className="w-5 h-5 text-blue-600 mr-2" />
                  Account Security & Password Authentication
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update your administrator password to secure access to the admin portal.</p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5 max-w-lg">
                
                {/* Current Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Current Password *</label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      required
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-10 form-input text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">New Password *</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-10 form-input text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength Meter Bar */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-500">Password Strength:</span>
                        <span className={passwordStrength.color}>{passwordStrength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${passwordStrength.color.split(' ')[1]}`}
                          style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">Must be at least 8 characters long with letters & numbers.</p>
                </div>

                {/* Confirm New Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-10 form-input text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[11px] text-rose-500 font-bold mt-1">Passwords do not match.</p>
                  )}
                </div>

                {/* Real-time Validation Rules Checklist */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${newPassword.length >= 8 ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                    <span className={newPassword.length >= 8 ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-400'}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${confirmPassword && newPassword === confirmPassword ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                    <span className={confirmPassword && newPassword === confirmPassword ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-400'}>
                      New password and confirm password match
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!isPasswordFormValid || isChangingPassword}
                    className="btn-primary cursor-pointer w-full sm:w-auto"
                  >
                    {isChangingPassword ? 'Updating Password...' : 'Update Password & Re-authenticate'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 5: PREFERENCES & FEATURE TOGGLES */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              
              {/* Theme Appearance Mode Selector Card */}
              <div className="card space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                    <Sun className="w-5 h-5 text-amber-500 mr-2" />
                    Appearance & Theme Mode
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize application visual theme preference. Persists automatically.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Light Mode Option */}
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer ${
                      theme === 'light'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${theme === 'light' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Light Mode</span>
                      <span className="text-[11px] text-slate-500">Bright, clean high-contrast interface.</span>
                    </div>
                  </button>

                  {/* Dark Mode Option */}
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer ${
                      theme === 'dark'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${theme === 'dark' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Dark Mode</span>
                      <span className="text-[11px] text-slate-500">Refined slate palette (#111827).</span>
                    </div>
                  </button>

                  {/* System Default Option */}
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer ${
                      theme === 'system'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${theme === 'system' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                        {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">System Default</span>
                      <span className="text-[11px] text-slate-500">Automatically syncs with OS theme.</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Preferences & Feature Flags Card */}
              <div className="card space-y-6">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                    <Sliders className="w-5 h-5 text-blue-600 mr-2" />
                    System Preferences & Feature Controls
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toggle advanced modules and system preferences.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Barcode Lookup Module</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Enable camera/USB barcode scanning for quick product search during billing.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={barcodeEnabled}
                        onChange={e => handleSaveFeatureToggles(e.target.checked, loyaltyEnabled)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Customer Loyalty Rewards</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Track repeat customer purchases and issue automatic reward discounts.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loyaltyEnabled}
                        onChange={e => handleSaveFeatureToggles(barcodeEnabled, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Auto-Save Drafts</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 block flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active (5s Sync)
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Invoice Auto-Numbering</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 block flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Enabled (MTX-2026-XXXX)
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Active Theme</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block uppercase">
                        {theme} Mode
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: DATA EXPORT & BACKUP */}
          {activeTab === 'export' && (
            <div className="card space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                  <Download className="w-5 h-5 text-blue-600 mr-2" />
                  Data Export & Database Backups
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Download structured exports of your billing records, product inventory, and customer databases.</p>
              </div>

              {/* Month Selector Filter */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Export Month Filter
                </label>
                <select
                  value={exportMonth}
                  onChange={e => setExportMonth(e.target.value)}
                  className="w-full p-2.5 form-select text-xs font-semibold"
                >
                  <option value="">All Time Billing Records</option>
                  <option value="2026-09">September 2026</option>
                  <option value="2026-08">August 2026</option>
                  <option value="2026-07">July 2026</option>
                  <option value="2026-06">June 2026</option>
                  <option value="2026-05">May 2026</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose a specific month to filter invoices or export all records.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Export as JSON</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Full system backup payload in JSON format.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadExport('json')}
                    disabled={isExportingJson || isExportingCsv || isExportingExcel}
                    className="w-full btn-primary py-2 text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 mr-1.5 ${isExportingJson ? 'animate-bounce' : ''}`} />
                    {isExportingJson ? 'Generating JSON...' : 'Download JSON Export'}
                  </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                      <TableIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Export as CSV</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Spreadsheet-compatible CSV dataset.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadExport('csv')}
                    disabled={isExportingJson || isExportingCsv || isExportingExcel}
                    className="w-full px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 mr-1.5 ${isExportingCsv ? 'animate-bounce' : ''}`} />
                    {isExportingCsv ? 'Generating CSV...' : 'Download CSV Export'}
                  </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-xl">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Monthly Excel</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-sheet Workbook (.xlsx) with totals.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadExport('excel')}
                    disabled={isExportingJson || isExportingCsv || isExportingExcel}
                    className="w-full px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center justify-center cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 mr-1.5 ${isExportingExcel ? 'animate-bounce' : ''}`} />
                    {isExportingExcel ? 'Generating Excel...' : 'Download Monthly Excel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: ABOUT SYSTEM & HEALTH */}
          {activeTab === 'about' && (
            <div className="card space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center">
                  <Info className="w-5 h-5 text-blue-600 mr-2" />
                  About Memotrix Billing System
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">System version specifications, architecture details, and runtime status.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Application Platform</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 block">Memotrix Enterprise SaaS</span>
                  <span className="text-xs text-slate-500 block">Version 2.4.0 (Build 2026)</span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Technology Stack</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Node.js + Express + SQLite DB</span>
                  <span className="text-xs text-slate-500 block">Vite React Frontend + Playwright Chromium PDF Generator</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PREVIEW QR CODE MODAL */}
      {isPreviewQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-center">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center">
                <QrCode className="w-4 h-4 mr-2 text-blue-600" />
                Sample UPI QR Code Preview
              </h3>
              <button
                onClick={() => setIsPreviewQrModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              {previewQrDataUri ? (
                <img src={previewQrDataUri} alt="Sample UPI QR" className="w-44 h-44 object-contain rounded-lg border border-slate-200 bg-white p-2" />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">Loading QR...</div>
              )}
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Scan & Pay</span>
                <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 block break-all">{upiId}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Sample Amount: <strong>₹1.00</strong></span>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-left overflow-x-auto break-all">
              {previewUpiString}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadPreviewQrPng}
                className="w-full btn-primary py-2.5 text-xs flex items-center justify-center cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Download QR PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REDESIGNED LARGE INTERACTIVE LOGO ADJUSTMENT MODAL */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Company Logo (Full Preview & Position Controls)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Drag to reposition, use slider or wheel to zoom. Original image quality is preserved 100%.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Interactive Viewport (Smart Auto-Fit contain, drag & wheel) */}
            <div
              className="w-full h-72 sm:h-80 bg-slate-950/90 rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-700 select-none cursor-grab active:cursor-grabbing shadow-inner"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              {/* Guidance grid lines */}
              <div className="absolute inset-0 border border-white/10 pointer-events-none grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/5"></div>
                <div className="border-r border-b border-white/5"></div>
                <div className="border-b border-white/5"></div>
                <div className="border-r border-b border-white/5"></div>
                <div className="border-r border-b border-white/5"></div>
                <div className="border-b border-white/5"></div>
              </div>

              <img
                src={logoOriginalUrl || logoUrl || '/logo-default.png'}
                alt="Logo Viewport"
                draggable={false}
                style={{
                  transform: `translate(${logoX}px, ${logoY}px) scale(${logoZoom})`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className="max-h-full max-w-full object-contain pointer-events-none"
              />
              
              <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-mono px-2.5 py-1 rounded-lg border border-slate-700 backdrop-blur-sm">
                Zoom: {(logoZoom * 100).toFixed(0)}% | X: {logoX.toFixed(0)}px | Y: {logoY.toFixed(0)}px
              </div>
            </div>

            {/* Adjustment Control Bar */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3 flex-1 min-w-[200px]">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 min-w-[70px]">Zoom Slider</span>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={logoZoom}
                    onChange={e => setLogoZoom(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 w-12 text-right">{(logoZoom * 100).toFixed(0)}%</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => { setLogoZoom(1.0); setLogoX(0); setLogoY(0); }}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl transition cursor-pointer"
                  >
                    Fit Entire Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLogoX(0); setLogoY(0); }}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl transition cursor-pointer"
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLogoZoom(1.0); setLogoX(0); setLogoY(0); }}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-300 rounded-xl transition cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Side-by-Side Application Previews */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Live Application Views</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-1 text-center">
                  <span className="text-[10px] font-bold text-slate-400">Sidebar</span>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center p-1 overflow-hidden">
                    <img
                      src={logoOriginalUrl || logoUrl || '/logo-default.png'}
                      alt="Sidebar Preview"
                      style={{ transform: `translate(${logoX * 0.15}px, ${logoY * 0.15}px) scale(${logoZoom})` }}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col items-center justify-center space-y-1 text-center">
                  <span className="text-[10px] font-bold text-slate-300">Navbar</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center p-1 overflow-hidden border border-slate-700">
                    <img
                      src={logoOriginalUrl || logoUrl || '/logo-default.png'}
                      alt="Navbar Preview"
                      style={{ transform: `translate(${logoX * 0.12}px, ${logoY * 0.12}px) scale(${logoZoom})` }}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-1 text-center">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Invoice Header</span>
                  <div className="w-full h-10 flex items-center justify-end overflow-hidden p-1">
                    <img
                      src={logoOriginalUrl || logoUrl || '/logo-default.png'}
                      alt="Invoice Preview"
                      style={{ transform: `translate(${logoX * 0.25}px, ${logoY * 0.25}px) scale(${logoZoom})` }}
                      className="max-h-10 max-w-[120px] object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLogoSettings}
                className="btn-primary text-xs cursor-pointer shadow-md"
              >
                Save & Apply Logo Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper icon component for table/CSV export
function TableIcon(props) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M9 4v16M15 4v16" />
    </svg>
  );
}

export default SettingsPage;
