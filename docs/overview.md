# Application Overview

## Project Purpose
A comprehensive social media management and marketing platform that enables businesses to create, schedule, publish, and analyze social media content across multiple platforms.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand + React Query (@tanstack/react-query)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Routing**: React Router DOM
- **Testing**: Vitest + Testing Library + Playwright
- **Analytics**: Vercel Analytics
- **Error Tracking**: Uptrace (self-hosted at https://traces.feuzion.com)

## Core Architecture

### Frontend Architecture
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui base components
│   ├── content/         # Content management components
│   ├── analytics/       # Analytics dashboard components
│   ├── smart-time/      # AI scheduling components
│   └── homepage/        # Landing page components
├── contexts/            # React contexts (Auth, Tenant)
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
│   ├── image/          # Image processing utilities
│   └── utils.ts        # General utilities
├── pages/              # Route components
└── integrations/       # External service integrations
    └── supabase/       # Supabase client & types
```

### Component Design Patterns
- **Compound Components**: For complex UI like modals and dropdowns
- **Custom Hooks**: For business logic abstraction (useAuth, useGoogleAnalytics)
- **Render Props**: For flexible content rendering
- **Provider Pattern**: For global state management

### State Management Strategy
- **React Query**: Server state, caching, synchronization
- **Zustand**: Client state for UI interactions
- **Context API**: Authentication and tenant management
- **Local State**: Component-specific state with useState/useReducer

## Core Features

### 1. Social Media Management
- **Multi-platform publishing**: Facebook, Instagram support
- **Content scheduling**: AI-powered optimal timing
- **Bulk operations**: Batch content creation and publishing
- **Template system**: Reusable content templates

### 2. Content Creation & Management
- **AI Content Generation**: Automated content creation
- **Rich Text Editor**: TipTap-based content editing
- **Image Processing**: Automatic optimization and resizing
- **Content Libraries**: Organized content storage

### 3. Analytics & Reporting
- **Google Analytics Integration**: Website traffic analysis
- **Social Media Metrics**: Engagement, reach, performance
- **Custom Dashboards**: Configurable analytics views
- **Export Capabilities**: Data export functionality

### 4. CRM Integration
- **Customer Management**: Contact and lead tracking
- **Campaign Management**: Marketing campaign coordination
- **Performance Tracking**: ROI and conversion metrics

### 5. POS Integration
- **Transaction Sync**: Sales data integration
- **Inventory Management**: Product catalog sync
- **Customer Insights**: Purchase behavior analysis

## Key Integrations

### Supabase Services
- **Authentication**: Email/password, OAuth providers
- **Database**: PostgreSQL with Row Level Security
- **Storage**: File and media management
- **Edge Functions**: Server-side logic execution
- **Realtime**: Live data synchronization

### External APIs
- **Google Analytics**: Website analytics data
- **Facebook Graph API**: Social media posting and analytics
- **Instagram Basic Display**: Instagram content management
- **Payment Processing**: Subscription and billing management

## Security Architecture
- **Row Level Security (RLS)**: Database-level access control
- **JWT Authentication**: Secure session management
- **OAuth 2.0**: Third-party service authorization
- **API Rate Limiting**: Protection against abuse
- **Input Validation**: Zod schema validation
- **Secure Headers**: XSS and CSRF protection

## Performance Optimizations
- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: WebP conversion and compression
- **Caching Strategy**: React Query with stale-while-revalidate
- **Bundle Optimization**: Tree shaking and minification
- **CDN Integration**: Static asset delivery

## Development Workflow
- **Type Safety**: Full TypeScript coverage
- **Testing Strategy**: Unit, integration, and E2E tests
- **Code Quality**: ESLint + Prettier configuration
- **CI/CD Pipeline**: Automated testing and deployment
- **Version Control**: Git with feature branch workflow

## Scalability Considerations
- **Database Indexing**: Optimized query performance
- **Connection Pooling**: Efficient database connections
- **Edge Functions**: Distributed computation
- **Horizontal Scaling**: Stateless application design
- **Caching Layers**: Multiple levels of caching

## Monitoring & Observability
- **Error Tracking**: Uptrace integration with OpenTelemetry
- **Distributed Tracing**: Full request tracing from frontend to backend
- **Performance Monitoring**: Vercel Analytics
- **Database Monitoring**: Supabase dashboard
- **User Analytics**: Custom event tracking
- **Health Checks**: Application and service monitoring