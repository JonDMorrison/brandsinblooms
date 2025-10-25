import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { CompanyInformationTab } from './profile/CompanyInformationTab';
import { BrandColorsTab } from './profile/BrandColorsTab';
import { TypographyTab } from './profile/TypographyTab';

export default function ProfilePage() {
  return (
    <Routes>
      <Route element={<ProfileLayout />}>
        <Route index element={<Navigate to="company" replace />} />
        <Route path="company" element={<CompanyInformationTab />} />
        <Route path="brand-colors" element={<BrandColorsTab />} />
        <Route path="typography" element={<TypographyTab />} />
      </Route>
    </Routes>
  );
}
