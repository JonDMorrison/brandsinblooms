
import React from 'react';
import { Navigate } from 'react-router-dom';

const TestPage = () => {
  // Redirect test page to main dashboard in production
  return <Navigate to="/" replace />;
};

export default TestPage;
