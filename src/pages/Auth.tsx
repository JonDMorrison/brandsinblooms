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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4 md:p-6">
      {/* Modern Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl"></div>
        <div className="absolute top-32 right-20 w-32 h-32 bg-blue-500/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-32 left-20 w-24 h-24 bg-teal-500/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-32 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/3 w-12 h-12 bg-blue-400/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/4 right-1/3 w-28 h-28 bg-teal-400/10 rounded-full blur-xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header Area */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full mr-3">
              <Sprout className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary">
              BloomSuite
            </h1>
          </div>
          <p className="text-text-secondary text-lg font-medium">
            Save Hours with BloomSuite
          </p>
        </div>

        <Card className="shadow-xl border border-white/20 bg-white/95 backdrop-blur-lg rounded-3xl p-8 transition-all duration-300 hover:shadow-2xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-semibold text-text-primary mb-2">
              Welcome Back
            </CardTitle>
            <p className="text-text-secondary">Sign in to your account or create a new one</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-surface-secondary h-12 p-1 rounded-xl border border-primary/20">
                <TabsTrigger 
                  value="signin" 
                  className="h-10 font-medium text-base data-[state=active]:bg-white data-[state=active]:text-text-primary data-[state=active]:shadow-md data-[state=inactive]:text-text-secondary data-[state=inactive]:bg-transparent transition-all duration-200 rounded-lg"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="h-10 font-medium text-base data-[state=active]:bg-white data-[state=active]:text-text-primary data-[state=active]:shadow-md data-[state=inactive]:text-text-secondary data-[state=inactive]:bg-transparent transition-all duration-200 rounded-lg"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-5">
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-text-primary font-medium">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="h-12 border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl text-text-primary bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-text-primary font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Your password"
                        className="h-12 border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 pr-12 transition-all duration-200 rounded-xl text-text-primary bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-10 w-10 text-text-secondary hover:text-primary hover:bg-primary/10"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-right">
                      <a href="#" className="text-sm text-primary hover:text-primary/80 transition-colors duration-200 font-medium">
                        Forgot Password?
                      </a>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium transition-all duration-200 hover:shadow-lg rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 mr-2" />
                        Sign In with Email
                      </>
                    )}
                  </Button>

                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-primary/20" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-4 text-text-secondary font-medium">— or —</span>
                    </div>
                  </div>

                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleGoogleAuth}
                    className="w-full h-12 border-2 border-primary/20 hover:bg-primary/5 hover:border-primary transition-all duration-200 rounded-xl text-text-primary font-medium shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
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
                <form onSubmit={handleSignUp} className="space-y-5">
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-text-primary font-medium">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Your full name"
                      className="h-12 border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl text-text-primary bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-text-primary font-medium">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="h-12 border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl text-text-primary bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-text-primary font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Choose a password (min 8 chars)"
                        minLength={8}
                        className="h-12 border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 pr-12 transition-all duration-200 rounded-xl text-text-primary bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-10 w-10 text-text-secondary hover:text-primary hover:bg-primary/10"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium transition-all duration-200 hover:shadow-lg rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>

                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-primary/20" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-4 text-text-secondary font-medium">— or —</span>
                    </div>
                  </div>

                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleGoogleAuth}
                    className="w-full h-12 border-2 border-primary/20 hover:bg-primary/5 hover:border-primary transition-all duration-200 rounded-xl text-text-primary font-medium shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
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
              <Alert className="mt-6 border-red-200 bg-red-50 rounded-xl">
                <AlertDescription className="text-red-700 font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="mt-6 border-primary/20 bg-primary/10 rounded-xl">
                <AlertDescription className="text-text-primary font-medium">
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
