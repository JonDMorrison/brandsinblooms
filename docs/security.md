# Security Documentation

## Authentication & Authorization

### User Authentication
- **Provider**: Supabase Auth
- **Methods**: Email/password, OAuth (Google, Facebook)
- **Session Management**: JWT tokens with automatic refresh
- **Password Requirements**: Minimum 8 characters (enforced by Supabase)

### Authorization Model
- **Tenant-based Access**: Multi-tenant architecture with tenant isolation
- **Role-based Permissions**: User roles (owner, admin, member)
- **Row Level Security**: Database-level access control

## Database Security

### Row Level Security (RLS) Policies
All tables implement RLS with policies for:
- **User Isolation**: Users can only access their own data
- **Tenant Isolation**: Data is isolated by tenant/organization
- **Service Role Access**: Backend functions can access all data when needed

### Critical Security Policies
```sql
-- Example: Content tasks can only be accessed by the task owner
CREATE POLICY "Users can only view their own content tasks" 
ON content_tasks FOR SELECT 
USING (auth.uid() = user_id);

-- Example: Social connections are user-specific
CREATE POLICY "Users can manage their own social connections" 
ON social_connections FOR ALL 
USING (auth.uid() = user_id);
```

### Data Encryption
- **At Rest**: Supabase handles database encryption
- **In Transit**: HTTPS/TLS for all communications
- **Sensitive Data**: OAuth tokens stored securely in social_connections table

## API Security

### Rate Limiting
- **Edge Functions**: Built-in Supabase rate limiting
- **Client-side**: React Query prevents excessive requests
- **Custom Limits**: Implemented per-user rate limiting where needed

### Input Validation
- **Schema Validation**: Zod schemas for all user inputs
- **File Upload Validation**: File type and size restrictions
- **SQL Injection Prevention**: Parameterized queries only

### CORS Configuration
- **Allowed Origins**: Configured for production domains
- **Credentials**: Properly configured for authentication
- **Headers**: Secure header policies

## OAuth & Third-party Integrations

### Social Media APIs
- **Facebook/Instagram**: OAuth 2.0 with proper scopes
- **Token Storage**: Encrypted in database with expiration tracking
- **Token Refresh**: Automatic refresh before expiration
- **Scope Limitation**: Minimal required permissions

### Google Analytics
- **Service Account**: Separate service account with limited permissions
- **API Keys**: Server-side only, not exposed to client
- **Data Access**: Read-only access to specified properties

## File & Media Security

### Upload Security
- **File Type Validation**: Whitelist of allowed file types
- **Size Limits**: Maximum file size restrictions
- **Virus Scanning**: Integrated malware detection (if applicable)
- **Content Validation**: Image format verification

### Storage Policies
```sql
-- Example: Users can only upload to their own folders
CREATE POLICY "Users can upload their own files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'media-mms' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Security Headers & Configuration

### HTTP Security Headers
- **Content Security Policy (CSP)**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Strict-Transport-Security**: Enforces HTTPS

### Environment Security
- **Secret Management**: All secrets in environment variables
- **No Hardcoded Credentials**: All sensitive data externalized
- **Production vs Development**: Separate environments and keys

## Vulnerability Management

### Security Scanning
- **Dependency Scanning**: Regular npm audit runs
- **Code Analysis**: Static analysis tools
- **Penetration Testing**: Regular security assessments

### Incident Response
- **Error Monitoring**: Uptrace for error tracking, distributed tracing, and performance monitoring
- **Self-Hosted**: No third-party data sharing - all monitoring data stays on our infrastructure
- **Audit Logging**: Database triggers for sensitive operations
- **Backup Strategy**: Regular automated backups

## Privacy & Compliance

### Data Privacy
- **Data Minimization**: Only collect necessary data
- **User Consent**: Clear consent for data collection
- **Data Retention**: Automatic cleanup of old data
- **Right to Deletion**: User data deletion capabilities

### GDPR Compliance
- **Data Portability**: Export functionality
- **Consent Management**: User preference tracking
- **Privacy by Design**: Default privacy-friendly settings

## Security Testing

### Automated Testing
- **Authentication Tests**: Login/logout flow testing
- **Authorization Tests**: Access control verification
- **Input Validation Tests**: Malicious input testing

### Manual Testing
- **Penetration Testing**: Regular security assessments
- **Code Reviews**: Security-focused code reviews
- **Configuration Audits**: Regular security configuration reviews

## Security Checklist

### Development
- [ ] All API endpoints require authentication
- [ ] RLS policies implemented for all tables
- [ ] Input validation on all user inputs
- [ ] Secrets never committed to code
- [ ] HTTPS enforced in production

### Deployment
- [ ] Environment variables configured
- [ ] Database migrations include security policies
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured

### Ongoing
- [ ] Dependencies regularly updated
- [ ] Security logs monitored
- [ ] Access tokens refreshed automatically
- [ ] User permissions audited regularly
- [ ] Backup and recovery tested