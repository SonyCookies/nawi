"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon, 
  Bars3Icon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CloudIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { exportDatabaseToJson, importDatabaseFromJson } from "../../lib/backup";
import { 
  initGoogleTokenClient, 
  requestGoogleAccessToken, 
  fetchGoogleUserProfile, 
  getCloudBackupMetadata, 
  uploadBackupToDrive, 
  downloadBackupFromDrive,
  type GoogleUserProfile,
  type CloudBackupMetadata
} from "../../lib/googleDrive";

const AVAILABLE_ICONS = [
  // Expense/Common Emojis
  "🍔", "🍟", "🍕", "🥗", "☕", "🚗", "🚌", "✈️", "🛒", "👕", "👟", "🎬", "🎮", "⚽", "🏥", "💊", "🎓", "📚", "📄", "⚡",
  "🏠", "🐾", "💈", "🔧", "🎁", "🎨", "🎵", "📦", "🛡️",
  // Income Emojis
  "💼", "💻", "💰", "📈", "🏦", "🏢", "📢", "🔄", "💵", "🪙", "🏆", "💎", "🏡"
];

export default function SettingsView() {
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryTab, setCategoryTab] = useState<"expense" | "income">("expense");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📦");
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIcon, setEditingIcon] = useState("📦");
  const [showEditIconPickerForId, setShowEditIconPickerForId] = useState<number | null>(null);

  const [globalSearch, setGlobalSearch] = useState("");

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const dataStr = await exportDatabaseToJson();
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `nawi_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Backup Exported", 
          description: "Database successfully exported as JSON file.", 
          type: "success" 
        } 
      }));
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Export Failed", 
          description: "Could not export database backup.", 
          type: "error" 
        } 
      }));
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const [mounted, setMounted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);
  const [confirmModalType, setConfirmModalType] = useState<"local" | "cloud">("local");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setPendingImportContent(text);
      setConfirmModalType("local");
      setShowConfirmModal(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const executeImportOrRestore = async () => {
    setShowConfirmModal(false);
    setSyncing(true);

    try {
      if (confirmModalType === "local") {
        if (!pendingImportContent) return;
        await importDatabaseFromJson(pendingImportContent);
        setPendingImportContent(null);
        window.dispatchEvent(new CustomEvent("show_toast", { 
          detail: { 
            title: "Restore Complete", 
            description: "Database successfully restored from JSON.", 
            type: "success" 
          } 
        }));
      } else {
        if (!googleToken) return;
        const success = await downloadBackupFromDrive(googleToken);
        if (success) {
          const meta = await getCloudBackupMetadata(googleToken);
          setCloudBackup(meta);
          window.dispatchEvent(new CustomEvent("show_toast", { 
            detail: { title: "Restore Complete", description: "Database successfully restored from cloud backup.", type: "success" } 
          }));
        } else {
          window.dispatchEvent(new CustomEvent("show_toast", { 
            detail: { title: "Restore Failed", description: "No cloud backup file found.", type: "error" } 
          }));
        }
      }
    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Import Failed", 
          description: err.message || "Failed to restore database backup.", 
          type: "error" 
        } 
      }));
    } finally {
      setSyncing(false);
    }
  };

  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [cloudBackup, setCloudBackup] = useState<CloudBackupMetadata | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  // Initialize Google Token Client on mount/when GIS script is ready
  useEffect(() => {
    const savedToken = sessionStorage.getItem("gdrive_access_token");
    if (savedToken) {
      setGoogleToken(savedToken);
    }

    const checkInterval = setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        clearInterval(checkInterval);
        initGoogleTokenClient(
          (accessToken) => {
            sessionStorage.setItem("gdrive_access_token", accessToken);
            setGoogleToken(accessToken);
            setGoogleAuthError(null);
          },
          (err) => {
            console.error("Google Auth error:", err);
            setGoogleAuthError("Failed to authenticate Google user.");
          }
        );
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, []);

  // Fetch user profile and backup metadata once token is obtained
  useEffect(() => {
    if (!googleToken) {
      setGoogleUser(null);
      setCloudBackup(null);
      return;
    }

    const fetchGoogleData = async () => {
      try {
        const profile = await fetchGoogleUserProfile(googleToken);
        setGoogleUser(profile);
        sessionStorage.setItem("gdrive_user_profile", JSON.stringify(profile));
        
        const backupMeta = await getCloudBackupMetadata(googleToken);
        setCloudBackup(backupMeta);
      } catch (err) {
        console.error("Session token expired or invalid:", err);
        sessionStorage.removeItem("gdrive_access_token");
        sessionStorage.removeItem("gdrive_user_profile");
        setGoogleToken(null);
        setGoogleUser(null);
        setCloudBackup(null);
      }
    };

    fetchGoogleData();
  }, [googleToken]);

  const handleConnectGoogle = () => {
    try {
      requestGoogleAccessToken();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { title: "Auth Error", description: err.message || "Failed to start Google sign-in.", type: "error" } 
      }));
    }
  };

  const handleDisconnectGoogle = () => {
    sessionStorage.removeItem("gdrive_access_token");
    sessionStorage.removeItem("gdrive_user_profile");
    setGoogleToken(null);
    setGoogleUser(null);
    setCloudBackup(null);
    window.dispatchEvent(new CustomEvent("show_toast", { 
      detail: { title: "Drive Disconnected", description: "Disconnected from your Google Account.", type: "success" } 
    }));
  };

  const handleSyncToCloud = async () => {
    if (!googleToken) return;
    setSyncing(true);
    try {
      const meta = await uploadBackupToDrive(googleToken);
      setCloudBackup(meta);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { title: "Synced Successfully", description: "Local database backup uploaded to Google Drive.", type: "success" } 
      }));
    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { title: "Sync Failed", description: err.message || "Failed to sync to Google Drive.", type: "error" } 
      }));
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!googleToken || !cloudBackup) return;
    setConfirmModalType("cloud");
    setShowConfirmModal(true);
  };

  // Auto-update default new icon when tab shifts
  useEffect(() => {
    setNewCategoryIcon(categoryTab === "expense" ? "📦" : "💼");
    setShowNewIconPicker(false);
    setShowEditIconPickerForId(null);
  }, [categoryTab]);

  // Filter categories by type
  const filteredCategories = categories.filter(c => {
    const type = c.type || "expense";
    return type === categoryTab;
  });

  // Sort categories client-side using sortOrder, falling back to id
  const sortedCategories = [...filteredCategories].sort((a: any, b: any) => {
    const aOrder = a.sortOrder !== undefined ? a.sortOrder : (a.id ?? 0);
    const bOrder = b.sortOrder !== undefined ? b.sortOrder : (b.id ?? 0);
    return aOrder - bOrder;
  });

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const maxOrder = sortedCategories.reduce((max, cat) => {
        const order = cat.sortOrder !== undefined ? cat.sortOrder : (cat.id ?? 0);
        return Math.max(max, order);
      }, 0);
      await db.categories.add({ 
        name: newCategoryName.trim(),
        type: categoryTab,
        icon: newCategoryIcon,
        sortOrder: maxOrder + 1
      });
      setNewCategoryName("");
      setNewCategoryIcon(categoryTab === "expense" ? "📦" : "💼");
    } catch (err) {
      console.error("Error adding category:", err);
    }
  };

  const handleStartEdit = (id: number, name: string, icon: string) => {
    setEditingId(id);
    setEditingName(name);
    setEditingIcon(icon || (categoryTab === "expense" ? "📦" : "💼"));
    setShowEditIconPickerForId(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      await db.categories.update(id, { 
        name: editingName.trim(),
        icon: editingIcon
      });
      setEditingId(null);
      setEditingName("");
      setShowEditIconPickerForId(null);
    } catch (err) {
      console.error("Error updating category:", err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await db.categories.delete(id);
    } catch (err) {
      console.error("Error deleting category:", err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const container = e.currentTarget.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const threshold = 40;
      const speed = 10;
      if (relativeY < threshold) {
        container.scrollTop -= speed;
      } else if (rect.bottom - e.clientY < threshold) {
        container.scrollTop += speed;
      }
    }
  };

  const handleDragEnter = (index: number) => {
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const items = [...sortedCategories];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    // Save sequential sort orders to DB specifically for this category type
    await db.transaction("rw", db.categories, async () => {
      for (let i = 0; i < items.length; i++) {
        const cat = items[i];
        if (cat.id) {
          await db.categories.update(cat.id, { sortOrder: i + 1 });
        }
      }
    });

    setDraggedIndex(null);
  };

  // Global settings search matching
  const matchesSearch = (texts: string[]) => {
    if (!globalSearch.trim()) return true;
    const query = globalSearch.toLowerCase();
    return texts.some(text => text.toLowerCase().includes(query));
  };

  const showGeneral = matchesSearch([
    "General Settings",
    "Notification Alerts",
    "Receive alert when budget is near 80% limit",
    "Currency Settings",
    "Default currency displayed across accounts",
    "PHP",
    "₱"
  ]);

  const showCategories = matchesSearch([
    "Categories Settings",
    "Add or edit tags for expenditures or income flows",
    "category",
    "categories",
    ...categories.map(c => c.name)
  ]);

  const showBackup = matchesSearch([
    "Backup & Sync",
    "Export",
    "Import",
    "Google Drive",
    "Cloud Sync",
    "json",
    "restore"
  ]);

  return (
    <div className="w-full animate-fadeIn select-none">
      {/* Settings Header with Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-1">Settings</h1>
          <p className="text-gray-500 text-sm leading-relaxed mt-1">Manage your profile, alerts, and application preferences.</p>
        </div>
        
        {/* Global Settings Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search settings..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
          />
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
            </svg>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Preferences */}
        <div className="flex flex-col gap-6">
          {showGeneral && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
              <h3 className="text-lg font-bold text-gray-900 pb-4">General Settings</h3>
              
              <div className="py-4 flex justify-between items-center">
                <div>
                  <h4 className="text-base font-bold text-gray-800">Notification Alerts</h4>
                  <p className="text-sm text-gray-400 mt-0.5">Receive alert when budget is near 80% limit</p>
                </div>
                <div className="w-12 h-7 bg-purple-600 rounded-full p-0.5 cursor-pointer flex items-center justify-end">
                  <div className="bg-white w-6 h-6 rounded-full shadow-sm"></div>
                </div>
              </div>
              
              <div className="pt-4 flex justify-between items-center">
                <div>
                  <h4 className="text-base font-bold text-gray-800">Currency Settings</h4>
                  <p className="text-sm text-gray-400 mt-0.5">Default currency displayed across accounts</p>
                </div>
                <span className="text-base font-bold text-gray-500">PHP (₱)</span>
              </div>
            </div>
          )}

          {showBackup && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Backup & Sync</h3>
                <p className="text-sm text-gray-400 mt-0.5">Export or import your database to secure your records, or prepare for cloud synchronization.</p>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Export Row */}
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                      <span>Export Data</span>
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">Download a JSON file containing all your accounts, transactions, and settings.</p>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-100/30 font-bold text-sm rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" strokeWidth={2.5} />
                    <span>Export JSON</span>
                  </button>
                </div>

                {/* Import Row */}
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-gray-800">Import Data</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Restore data from a previously exported JSON backup. <span className="text-red-500 font-semibold">Overwrites current data.</span></p>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImportFile}
                      accept=".json"
                      className="hidden"
                    />
                    <button
                      onClick={handleImportClick}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100 font-bold text-sm rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <ArrowUpTrayIcon className="w-4 h-4" strokeWidth={2.5} />
                      <span>Import JSON</span>
                    </button>
                  </div>
                </div>

                {/* Google Drive Sync Row */}
                <div className="pt-4 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                        <span>Google Drive Cloud Sync</span>
                        {googleToken ? (
                          <span className="text-[10px] bg-green-100 text-green-700 border border-green-200/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Connected</span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Disconnected</span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">Link your Google Account to sync backups securely in your Google Drive cloud space.</p>
                    </div>
                    {googleToken ? (
                      <button
                        onClick={handleDisconnectGoogle}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100/30 font-bold text-sm rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                      >
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectGoogle}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-purple-600/10 shrink-0 cursor-pointer"
                      >
                        <CloudIcon className="w-4 h-4 text-white" strokeWidth={2.5} />
                        <span>Connect Drive</span>
                      </button>
                    )}
                  </div>

                  {googleToken && (
                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex flex-col gap-3.5 mt-1 animate-fadeIn">
                      {/* User Account Info */}
                      {googleUser && (
                        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                          {googleUser.picture ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={googleUser.picture} alt="Google Profile" className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                              {googleUser.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-800 truncate">{googleUser.name || "Google User"}</div>
                            <div className="text-[10px] text-gray-400 truncate">{googleUser.email}</div>
                          </div>
                        </div>
                      )}

                      {/* Backup metadata status */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-medium">Last Cloud Backup:</span>
                        <span className="font-bold text-gray-700">
                          {cloudBackup ? new Date(cloudBackup.modifiedTime).toLocaleString() : "No cloud backup found"}
                        </span>
                      </div>

                      {/* Sync actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSyncToCloud}
                          disabled={syncing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-600/10 cursor-pointer disabled:opacity-50"
                        >
                          {syncing ? "Syncing..." : "Sync to Cloud"}
                        </button>
                        <button
                          onClick={handleRestoreFromCloud}
                          disabled={syncing || !cloudBackup}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          Restore from Cloud
                        </button>
                      </div>
                    </div>
                  )}

                  {googleAuthError && (
                    <p className="text-[11px] text-red-500 font-semibold mt-1">{googleAuthError}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Category Management */}
        {showCategories ? (
          <div className="flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Categories Settings</h3>
                  <p className="text-sm text-gray-400 mt-0.5">Add or edit tags for expenditures or income flows.</p>
                </div>

                {/* Categories Tab Switcher */}
                <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 gap-1 text-xs font-semibold shrink-0">
                  <button
                    type="button"
                    onClick={() => setCategoryTab("expense")}
                    className={`px-3.5 py-2 rounded-lg cursor-pointer transition-all ${
                      categoryTab === "expense" 
                        ? "bg-white text-gray-950 shadow-sm font-bold" 
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Expenses
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryTab("income")}
                    className={`px-3.5 py-2 rounded-lg cursor-pointer transition-all ${
                      categoryTab === "income" 
                        ? "bg-white text-gray-950 shadow-sm font-bold" 
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Add Category Form */}
              <form onSubmit={handleAddCategory} className="flex gap-2 relative">
                {/* Icon Selector Button */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowNewIconPicker(!showNewIconPicker)}
                    className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl cursor-pointer hover:bg-gray-100/80 hover:border-gray-200 transition-all shadow-sm"
                    title="Select Icon"
                  >
                    {newCategoryIcon}
                  </button>
                  {showNewIconPicker && (
                    <div className="absolute top-13 left-0 z-30 bg-white border border-gray-100 rounded-2xl p-3 shadow-xl grid grid-cols-5 gap-1.5 w-48 animate-fadeIn select-none">
                      {AVAILABLE_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setNewCategoryIcon(emoji);
                            setShowNewIconPicker(false);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-base rounded-md hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder={categoryTab === "expense" ? "New expense category..." : "New income category..."}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm font-medium"
                />
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-sm shadow-purple-600/10 cursor-pointer flex items-center justify-center shrink-0"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </form>

              {/* Categories List */}
              <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                {sortedCategories.map((cat, index) => (
                  <div
                    key={cat.id}
                    draggable={editingId !== cat.id}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-all duration-200 select-none cursor-default ${
                      draggedIndex === index
                        ? "opacity-40 border-dashed border-purple-300 bg-purple-50/20"
                        : "bg-gray-50/70 border-gray-100 shadow-sm bg-white"
                    } ${
                      dragOverIndex === index && draggedIndex !== index
                        ? "border-t-4 border-t-purple-600/80 -translate-y-0.5 shadow-sm"
                        : ""
                    }`}
                  >
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2.5 w-full relative">
                        {/* Edit Icon Selector */}
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowEditIconPickerForId(showEditIconPickerForId === cat.id ? null : cat.id!)}
                            className="w-8.5 h-8.5 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-lg cursor-pointer hover:bg-gray-100 transition-colors shadow-sm"
                          >
                            {editingIcon}
                          </button>
                          {showEditIconPickerForId === cat.id && (
                            <div className="absolute top-10 left-0 z-30 bg-white border border-gray-100 rounded-2xl p-2.5 shadow-xl grid grid-cols-5 gap-1.5 w-44 animate-fadeIn select-none">
                              {AVAILABLE_ICONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setEditingIcon(emoji);
                                    setShowEditIconPickerForId(null);
                                  }}
                                  className="w-6.5 h-6.5 flex items-center justify-center text-sm rounded hover:bg-gray-100 cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 bg-white border border-purple-500/30 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none font-bold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(cat.id!);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(cat.id!)}
                          className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors cursor-pointer"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-500 hover:bg-gray-100 p-1.5 rounded transition-colors cursor-pointer"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Drag Handle */}
                          <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 shrink-0 p-1">
                            <Bars3Icon className="w-4 h-4" />
                          </div>
                          
                          {/* Icon Display */}
                          <span className="text-xl shrink-0 select-none mr-0.5">{cat.icon || "📦"}</span>

                          <span className="text-sm font-bold text-gray-800 truncate max-w-[210px]">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(cat.id!, cat.name, cat.icon || "📦")}
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded transition-all cursor-pointer"
                            title="Edit Category"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id!)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all cursor-pointer"
                            title="Delete Category"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {sortedCategories.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-400 font-medium">
                    No custom {categoryTab} categories configured yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Global Empty State */}
        {!showGeneral && !showCategories && !showBackup && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
            </svg>
            <div className="text-base font-bold text-gray-800">No settings found</div>
            <div className="text-sm text-gray-400 max-w-sm">No settings panels matched &quot;{globalSearch}&quot;. Try adjusting your keywords.</div>
          </div>
        )}
      </div>
      {mounted && showConfirmModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn select-none">
          {/* Modal Card */}
          <div 
            className="w-full max-w-[480px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[24px] p-5 relative flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              type="button"
              onClick={() => {
                setShowConfirmModal(false);
                setPendingImportContent(null);
              }}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
            </button>

            {/* Content */}
            <div className="flex gap-4 items-start pr-8">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" strokeWidth={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xl font-bold text-gray-950 leading-tight">Confirm Overwrite</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {confirmModalType === "local" 
                    ? "Are you sure you want to import this database file? This will completely overwrite all current local accounts, transactions, categories, and scheduled items."
                    : "Are you sure you want to restore from Google Drive? This will completely overwrite all current local accounts, transactions, categories, and scheduled items."}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end items-center gap-3">
              <button 
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingImportContent(null);
                }}
                className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={executeImportOrRestore}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-red-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Confirm & Overwrite</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
