import React from "react";
import Tab, { tabClasses } from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const profileTabs = [
  { label: "Company Information", path: "/profile/company" },
  { label: "Contact & Footer", path: "/profile/contact-footer" },
  { label: "Brand Colors", path: "/profile/brand-colors" },
  { label: "Typography", path: "/profile/typography" },
];

export const ProfileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTabIndex = profileTabs.findIndex(
    (tab) => location.pathname === tab.path,
  );

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Profile Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your business information and preferences
          </p>
        </div>

        {/* Tab Navigation */}
        <Tabs
          aria-label="Profile settings tabs"
          value={activeTabIndex === -1 ? 0 : activeTabIndex}
          onChange={(_event, newValue) => {
            navigate(profileTabs[newValue as number].path);
          }}
          sx={{ bgcolor: "transparent" }}
        >
          <TabList
            disableUnderline
            sx={{
              p: 0.5,
              gap: 0.5,
              width: "fit-content",
              borderRadius: "xl",
              bgcolor: "background.level1",
              [`& .${tabClasses.root}[aria-selected="true"]`]: {
                boxShadow: "sm",
                bgcolor: "#e5e7eb",
              },
              [`& .${tabClasses.root}:not([aria-selected="true"]):hover`]: {
                bgcolor: "background.level2",
                borderRadius: "lg",
              },
            }}
          >
            {profileTabs.map((tab) => (
              <Tab key={tab.path} disableIndicator>
                {tab.label}
              </Tab>
            ))}
          </TabList>
        </Tabs>

        {/* Tab Content */}
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
