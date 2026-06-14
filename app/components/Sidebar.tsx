"use client";

import { useState, useEffect } from "react";
import { 
  HomeIcon, 
  WalletIcon, 
  ClockIcon, 
  CalendarDaysIcon, 
  ChartBarIcon, 
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  BellAlertIcon,
  AdjustmentsHorizontalIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

export const navigation = [
  { name: "Home", icon: HomeIcon },
  { name: "Wallet", icon: WalletIcon },
  { name: "History", icon: ClockIcon },
  { name: "Plan", icon: CalendarDaysIcon, subItems: [
    { name: "Upcoming", icon: BellAlertIcon, tab: "Plan:Upcoming" },
    { name: "Budgets", icon: AdjustmentsHorizontalIcon, tab: "Plan:Budgets" },
    { name: "Owed to You", icon: UserGroupIcon, tab: "Plan:Owed" },
  ]},
  { name: "Statistics", icon: ChartBarIcon },
  { name: "Settings", icon: Cog6ToothIcon },
];

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [profile, setProfile] = useState<{ name: string; email: string; picture?: string } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Plan: true,
  });

  useEffect(() => {
    const checkProfile = () => {
      const savedProfile = sessionStorage.getItem("gdrive_user_profile");
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          setProfile({
            name: parsed.name || parsed.given_name || "You",
            email: parsed.email || "Free Plan",
            picture: parsed.picture || undefined
          });
        } catch (err) {
          console.error(err);
        }
      } else {
        setProfile(null);
      }
    };
    checkProfile();

    const handleSync = () => checkProfile();
    window.addEventListener("gdrive_sync_state_changed", handleSync);
    window.addEventListener("gdrive_auth_changed", handleSync);
    return () => {
      window.removeEventListener("gdrive_sync_state_changed", handleSync);
      window.removeEventListener("gdrive_auth_changed", handleSync);
    };
  }, []);

  const isPlanActive = activeTab.startsWith("Plan");

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="h-full py-6 pl-6 pr-2 bg-[#f8f9fa]">
      <div
        className={`relative flex flex-col h-full bg-white border border-gray-100 shadow-[0_12px_40px_-6px_rgba(0,0,0,0.08)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isCollapsed ? "w-[108px]" : "w-80"
        }`}
      >
        {/* Logo & Toggle */}
        <div className="flex items-center justify-between p-5 mb-2">
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? "mx-auto" : ""}`}>
            <img src="/logo.png" className="w-10 h-10 object-contain shrink-0" alt="Nawi Logo" />
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-gray-900">Nawi Web</span>
                <span className="text-xs text-gray-400 font-semibold tracking-wider">BUDGET TRACKER</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`absolute flex items-center justify-center w-6 h-6 bg-white border border-gray-100 rounded-full shadow-sm hover:bg-gray-50 hover:scale-105 transition-all duration-200 -right-3 top-7 ${
              isCollapsed ? "" : ""
            }`}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5} />
            ) : (
              <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {!isCollapsed && (
             <div className="px-3 pb-2 pt-4">
               <span className="text-sm tracking-[0.15em] text-gray-400 uppercase">
                 Main
               </span>
             </div>
          )}

          {navigation.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isParentActive = hasSubItems
              ? activeTab.startsWith(item.name)
              : activeTab === item.name;
            const isExpanded = expandedSections[item.name];

            return (
              <div key={item.name}>
                {/* Main nav button */}
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      toggleSection(item.name);
                      if (!activeTab.startsWith(item.name)) {
                        setActiveTab(item.subItems![0].tab);
                      }
                    } else {
                      setActiveTab(item.name);
                    }
                  }}
                  className={`flex items-center transition-all duration-75 group cursor-pointer w-full ${
                    isCollapsed
                      ? "w-12 h-12 mx-auto justify-center rounded-xl"
                      : "gap-3 px-3 py-2.5 rounded-xl text-left"
                  } ${
                    isParentActive
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium shadow-md shadow-purple-600/20"
                      : "text-gray-500 hover:bg-gray-50/80 hover:text-gray-900 font-medium"
                  }`}
                >
                  <div className={`relative flex items-center justify-center shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${(!isParentActive && !isCollapsed) ? "group-hover:translate-x-0.5" : ""}`}>
                    <item.icon
                      className={`w-6 h-6 ${
                        isParentActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"
                      }`}
                      strokeWidth={isParentActive ? 2 : 1.5}
                    />
                  </div>
                  {!isCollapsed && (
                    <span className="whitespace-nowrap text-lg flex-1">
                      {item.name}
                    </span>
                  )}
                  {!isCollapsed && hasSubItems && (
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isParentActive ? "text-white/70" : "text-gray-300"
                      } ${isExpanded ? "rotate-180" : ""}`}
                      strokeWidth={2}
                    />
                  )}
                </button>

                {/* Sub-items */}
                {!isCollapsed && hasSubItems && isExpanded && (
                  <div className="mt-1 ml-4 pl-3 border-l border-gray-100 flex flex-col gap-0.5">
                    {item.subItems!.map((sub) => {
                      const isSubActive = activeTab === sub.tab;
                      return (
                        <button
                          key={sub.tab}
                          onClick={() => setActiveTab(sub.tab)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all duration-75 cursor-pointer group ${
                            isSubActive
                              ? "bg-purple-50 text-purple-700 font-medium"
                              : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                          }`}
                        >
                          <sub.icon
                            className={`w-4 h-4 shrink-0 ${
                              isSubActive ? "text-purple-600" : "text-gray-300 group-hover:text-gray-500"
                            }`}
                            strokeWidth={2}
                          />
                          <span className="text-base whitespace-nowrap">{sub.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="p-4 mt-auto border-t border-gray-50">
          <div className="flex items-center justify-center">
            <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
              {profile && profile.picture ? (
                <img
                  src={profile.picture}
                  alt={profile.name}
                  className="w-10 h-10 rounded-full shrink-0 border border-gray-100 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-base font-semibold">{profile ? profile.name.charAt(0).toUpperCase() : "U"}</span>
                </div>
              )}
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 max-w-[190px]">
                  <span className="text-lg font-semibold text-gray-700 truncate">
                    {profile ? profile.name : "You"}
                  </span>
                  <span className="text-base text-gray-400 truncate">
                    {profile ? profile.email : "Free Plan"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

