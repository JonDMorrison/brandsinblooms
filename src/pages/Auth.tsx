import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, Sprout, CheckCircle, Unlock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, signInWithCleanup, signUpWithCleanup } from "@/integrations/supabase/client";
import { toast } from "sonner";
import bloomSuiteLogo from "@/assets/bloomsuite-logo.png";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (!authLoading && user) {
      console.log('🔄 Auth: User already authenticated, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const checkOnboardingAndRedirect = async (userId: string) => {
    try {
      console.log('🔍 Auth: Checking onboarding status for user:', userId);
      
      // Check if user has completed onboarding by looking for company profile
      const { data: profile, error } = await supabase
        .from('company_profiles')
        .select('id, first_content_generated')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Auth: Error checking profile:', error);
        // On error, assume they need onboarding for safety
        navigate('/onboarding', { replace: true });
        return;
      }

      // If no profile exists or content not generated, they need onboarding
      if (!profile || !profile.first_content_generated) {
        console.log('⏳ Auth: New user needs onboarding, redirecting to onboarding');
        navigate('/onboarding', { replace: true });
      } else {
        console.log('✅ Auth: User has completed onboarding, going to dashboard');
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('❌ Auth: Error in checkOnboardingAndRedirect:', error);
      // Default to onboarding for safety
      navigate('/onboarding', { replace: true });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log('🔑 Auth: Attempting sign in for:', email);
      
      const { data, error } = await signInWithCleanup(email, password);

      if (error) {
        console.error('❌ Auth: Sign in error:', error);
        setError(error.message);
        toast.error(`Sign in failed: ${error.message}`);
        return;
      }

      if (data.user) {
        console.log('✅ Auth: Sign in successful for user:', data.user.id);
        toast.success('Welcome back!');
        
        // Check onboarding status and redirect appropriately
        setTimeout(() => {
          checkOnboardingAndRedirect(data.user.id);
        }, 100);
      }
    } catch (error: any) {
      console.error('❌ Auth: Unexpected sign in error:', error);
      setError('An unexpected error occurred. Please try again.');
      toast.error('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      console.log('📝 Auth: Attempting sign up for:', email);
      
      const { data, error } = await signUpWithCleanup(email, password, fullName);

      if (error) {
        console.error('❌ Auth: Sign up error:', error);
        setError(error.message);
        toast.error(`Sign up failed: ${error.message}`);
        return;
      }

      if (data.user) {
        console.log('✅ Auth: Sign up successful for user:', data.user.id);
        
        if (data.user.email_confirmed_at) {
          console.log('📧 Auth: Email already confirmed, new user needs onboarding');
          toast.success('Account created! Let\'s set up your business profile.');
          navigate('/onboarding', { replace: true });
        } else {
          console.log('📧 Auth: Email confirmation required');
          setMessage("Please check your email for a confirmation link, then return to sign in.");
          toast.success("Please check your email for a confirmation link.");
        }
      }
    } catch (error: any) {
      console.error('❌ Auth: Unexpected sign up error:', error);
      setError('An unexpected error occurred. Please try again.');
      toast.error('Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError("");

    try {
      console.log('🔍 Auth: Attempting Google auth');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        console.error('❌ Auth: Google auth error:', error);
        setError(error.message);
        toast.error(`Google sign in failed: ${error.message}`);
      }
    } catch (error: any) {
      console.error('❌ Auth: Unexpected Google auth error:', error);
      setError('Google sign in failed. Please try again.');
      toast.error('Google sign in failed. Please try again.');
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-garden-green" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is authenticated (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="h-screen w-full bg-gradient-to-br from-brand-navy-50 via-brand-teal-50 to-sand-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Sophisticated Background Mesh */}
      <div className="absolute inset-0">
        {/* Primary mesh gradients */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-navy-100/30 via-transparent to-brand-teal-100/30"></div>
        
        {/* Animated botanical elements */}
        <div className="absolute top-20 left-16 w-32 h-32 bg-brand-teal-200/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-40 right-24 w-24 h-24 bg-brand-navy-200/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute bottom-32 left-24 w-40 h-40 bg-brand-teal-300/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-brand-navy-300/15 rounded-full blur-2xl animate-pulse"></div>
        
        {/* Geometric accent patterns */}
        <div className="absolute top-1/3 left-1/4 w-16 h-16 bg-brand-teal-400/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/4 right-1/3 w-20 h-20 bg-brand-navy-400/10 rounded-full blur-xl"></div>
        
        {/* Subtle garden-themed shapes */}
        <div className="absolute top-1/2 right-1/2 w-6 h-6 bg-mint-400/20 rounded-full blur-sm transform rotate-45"></div>
        <div className="absolute bottom-1/3 left-1/2 w-8 h-8 bg-brand-teal-500/15 rounded-full blur-md"></div>
      </div>

      {/* Glass morphism overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[0.5px]"></div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Simplified Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-navy-700 to-brand-teal-600 bg-clip-text text-transparent">
                BloomSuite
              </h1>
              <div className="h-1 w-16 bg-gradient-to-r from-brand-teal-500 to-mint-500 rounded-full mt-1 mx-auto"></div>
            </div>
          </div>
        </div>

        <Card className="max-w-lg shadow-2xl border border-white/30 bg-white/90 backdrop-blur-xl rounded-3xl p-8 transition-all duration-500 hover:shadow-[0_25px_50px_-12px_rgba(104,190,185,0.25)] hover:border-brand-teal-200/50 hover:bg-white/95">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold text-brand-navy-700 mb-2">
              Get Started
            </CardTitle>
            <p className="text-brand-navy-500">
              Sign in to your account or create a new one
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-gradient-to-r from-brand-navy-50 to-brand-teal-50 h-14 p-1.5 rounded-2xl border border-brand-teal-200/30 shadow-inner">
                <TabsTrigger 
                  value="signin" 
                  className="h-11 font-semibold text-base data-[state=active]:bg-brand-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-brand-teal-600 data-[state=inactive]:text-brand-navy-500 data-[state=inactive]:bg-transparent transition-all duration-300 rounded-xl hover:text-brand-teal-600"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="h-11 font-semibold text-base data-[state=active]:bg-white data-[state=active]:text-brand-navy-700 data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-brand-teal-200/50 data-[state=inactive]:text-brand-navy-500 data-[state=inactive]:bg-transparent transition-all duration-300 rounded-xl hover:text-brand-navy-600"
                >
                  Create Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-6">
                  
                  <div className="space-y-3">
                    <Label htmlFor="signin-email" className="text-brand-navy-700 font-semibold text-sm">Email Address</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="h-14 border-2 border-brand-teal-200/40 focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-200/50 transition-all duration-300 rounded-2xl text-brand-navy-700 bg-white/80 backdrop-blur-sm placeholder:text-brand-navy-400 hover:border-brand-teal-300/60"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signin-password" className="text-brand-navy-700 font-semibold text-sm">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Enter your password"
                        className="h-14 border-2 border-brand-teal-200/40 focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-200/50 pr-14 transition-all duration-300 rounded-2xl text-brand-navy-700 bg-white/80 backdrop-blur-sm placeholder:text-brand-navy-400 hover:border-brand-teal-300/60"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-10 w-10 text-brand-navy-400 hover:text-brand-teal-600 hover:bg-brand-teal-50/80 rounded-xl transition-all duration-200"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-right">
                      <a href="#" className="text-sm text-brand-teal-600 hover:text-brand-teal-700 transition-colors duration-200 font-medium hover:underline">
                        Forgot Password?
                      </a>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-gradient-to-r from-brand-teal-600 to-brand-teal-500 hover:from-brand-teal-700 hover:to-brand-teal-600 text-white font-semibold transition-all duration-300 hover:shadow-xl rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] hover:shadow-brand-teal-500/25"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-5 h-5 mr-3" />
                        Sign In
                      </>
                    )}
                  </Button>

                  
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-brand-teal-200/50" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-6 text-brand-navy-500 font-medium">or continue with</span>
                    </div>
                  </div>

                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleGoogleAuth}
                    className="w-full h-14 border-2 border-brand-teal-200/50 hover:bg-brand-teal-50/50 hover:border-brand-teal-300 transition-all duration-300 rounded-2xl text-brand-navy-700 font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
                    disabled={loading}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#F0F4F0" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign In with Google
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-6">
                  
                  <div className="space-y-3">
                    <Label htmlFor="signup-name" className="text-brand-navy-700 font-semibold text-sm">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Your full name"
                      className="h-14 border-2 border-brand-teal-200/40 focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-200/50 transition-all duration-300 rounded-2xl text-brand-navy-700 bg-white/80 backdrop-blur-sm placeholder:text-brand-navy-400 hover:border-brand-teal-300/60"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-email" className="text-brand-navy-700 font-semibold text-sm">Email Address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="h-14 border-2 border-brand-teal-200/40 focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-200/50 transition-all duration-300 rounded-2xl text-brand-navy-700 bg-white/80 backdrop-blur-sm placeholder:text-brand-navy-400 hover:border-brand-teal-300/60"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-password" className="text-brand-navy-700 font-semibold text-sm">Create Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Choose a strong password (min 8 chars)"
                        minLength={8}
                        className="h-14 border-2 border-brand-teal-200/40 focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-200/50 pr-14 transition-all duration-300 rounded-2xl text-brand-navy-700 bg-white/80 backdrop-blur-sm placeholder:text-brand-navy-400 hover:border-brand-teal-300/60"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-10 w-10 text-brand-navy-400 hover:text-brand-teal-600 hover:bg-brand-teal-50/80 rounded-xl transition-all duration-200"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-gradient-to-r from-mint-600 to-brand-teal-600 hover:from-mint-700 hover:to-brand-teal-700 text-white font-semibold transition-all duration-300 hover:shadow-xl rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] hover:shadow-mint-500/25"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-3" />
                        Create Account
                      </>
                    )}
                  </Button>

                  
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-brand-teal-200/50" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-6 text-brand-navy-500 font-medium">or continue with</span>
                    </div>
                  </div>

                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleGoogleAuth}
                    className="w-full h-14 border-2 border-brand-teal-200/50 hover:bg-brand-teal-50/50 hover:border-brand-teal-300 transition-all duration-300 rounded-2xl text-brand-navy-700 font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
                    disabled={loading}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#F0F4F0" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign Up with Google
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert className="mt-6 border-destructive/20 bg-destructive/5 text-destructive rounded-xl">
                <AlertDescription className="font-medium text-center">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="mt-6 border-brand-teal-300/40 bg-brand-teal-50/70 text-brand-teal-700 rounded-xl">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="font-medium text-center">
                  {message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
