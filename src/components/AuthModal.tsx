import React, { useState } from 'react';
import { UserProfile, SignUpData } from '../types';
import { store, DEMO_USERS } from '../services/store';
import { api } from '../services/api';
import {
  X,
  Github,
  Mail,
  Lock,
  User,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState<string>('garvit@genesishacks.dev');
  const [loginPassword, setLoginPassword] = useState<string>('••••••••');
  const [githubInput, setGithubInput] = useState<string>('garvit-prakash');
  
  // Signup fields
  const [signupName, setSignupName] = useState<string>('');
  const [signupHandle, setSignupHandle] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupRole, setSignupRole] = useState<string>('Full-Stack AI & Systems Architect');
  const [signupGithub, setSignupGithub] = useState<string>('');
  const [signupBio, setSignupBio] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const roleOptions = [
    'Full-Stack AI & Systems Architect',
    'AI/ML Research Engineer',
    'Systems & Kernel Engineer (Rust)',
    'Lead UI/UX Design Engineer',
    'Distributed DB & Consensus Engineer',
    'ZK & Cryptography Researcher',
    'DevOps & Cloud Infrastructure',
  ];

  if (!isOpen) return null;

  const handleEmailLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await api.login({ email: loginEmail, password: loginPassword });
      onAuthenticated(user);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!githubInput.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await api.loginWithGitHub(githubInput.trim());
      onAuthenticated(user);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'GitHub sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!signupName.trim() || !signupHandle.trim() || !signupEmail.trim()) {
      setErrorMsg('Please complete all required fields');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const signupPayload: SignUpData = {
      name: signupName.trim(),
      handle: signupHandle.trim(),
      email: signupEmail.trim(),
      primaryRole: signupRole,
      githubUsername: signupGithub.trim(),
      bio: signupBio.trim(),
    };

    try {
      const user = await api.signup(signupPayload);
      onAuthenticated(user);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchDemoAccount = (demoUser: UserProfile): void => {
    const user = store.switchDemoAccount(demoUser.id);
    onAuthenticated(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-[24px] border border-apple-hairline product-shadow overflow-hidden my-auto text-apple-ink">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apple-hairline">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-apple-black text-white flex items-center justify-center text-[12px] font-bold">
              ⚡
            </div>
            <span className="text-[14px] font-semibold text-apple-ink font-display">
              Genesis Passport Auth
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-[#86868b] hover:text-apple-ink flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (Sign In vs Create Passport) */}
        <div className="p-6 pb-0">
          <div className="w-full grid grid-cols-2 p-1 bg-apple-parchment rounded-full border border-apple-hairline text-[14px]">
            <button
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`btn-apple py-2 rounded-full font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-apple-ink shadow-sm'
                  : 'text-[#86868b] hover:text-apple-ink'
              }`}
            >
              Sign In
            </button>

            <button
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`btn-apple py-2 rounded-full font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white text-apple-ink shadow-sm'
                  : 'text-[#86868b] hover:text-apple-ink'
              }`}
            >
              Create Passport
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 pt-5 max-h-[75vh] overflow-y-auto font-text space-y-5">
          {errorMsg && (
            <div className="px-4 py-2.5 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl text-[13px] text-[#ff3b30]">
              {errorMsg}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 1: SIGN IN */}
          {/* ========================================================================= */}
          {mode === 'login' ? (
            <div className="space-y-5">
              {/* GitHub 1-Click Sign-In */}
              <form onSubmit={handleGithubLogin} className="space-y-2">
                <label className="text-[13px] font-semibold text-apple-ink flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Github className="w-4 h-4" />
                    <span>Instant Developer Sign-In</span>
                  </span>
                  <span className="text-[11px] text-apple-blue font-normal">Fastest</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-mono text-[#86868b]">@</span>
                    <input
                      type="text"
                      value={githubInput}
                      onChange={(e) => setGithubInput(e.target.value)}
                      placeholder="GitHub username (e.g. garvit-prakash)"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-apple px-4 py-2.5 rounded-xl bg-apple-black text-white text-[13px] font-normal flex items-center gap-1.5 shrink-0"
                  >
                    <span>Connect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-3 text-[12px] text-[#86868b]">
                <div className="flex-1 h-px bg-apple-hairline" />
                <span>or sign in with email</span>
                <div className="flex-1 h-px bg-apple-hairline" />
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-apple-ink flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-apple-blue" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="builder@genesishacks.dev"
                    className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-apple-ink flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-apple-blue" />
                    <span>Password</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-apple w-full py-3 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[15px] font-normal shadow-sm mt-2 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>{isLoading ? 'Authenticating...' : 'Sign In to Passport'}</span>
                </button>
              </form>

              {/* Quick Demo Profile Switcher for Event Judges / Testing */}
              <div className="pt-4 border-t border-apple-hairline space-y-2">
                <div className="text-[12px] font-semibold text-[#86868b] flex items-center justify-between">
                  <span>TEST DEMO PROFILES</span>
                  <span className="text-[10px] text-apple-blue">1-Tap Switch</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_USERS.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => handleSwitchDemoAccount(demo)}
                      className="btn-apple p-2 rounded-xl bg-apple-parchment border border-apple-hairline hover:border-apple-blue/50 text-left transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <img
                          src={demo.avatarUrl}
                          alt={demo.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="text-[11px] font-semibold text-apple-ink truncate">
                          {demo.name.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-apple-blue truncate mt-0.5">
                        {demo.handle}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW 2: SIGN UP / GENESIS WIZARD */
            /* ========================================================================= */
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div className="text-center pb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-apple-parchment border border-apple-hairline text-[11px] text-apple-blue font-medium mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>GENESIS HACKS PASSPORT ISSUANCE</span>
                </div>
                <h4 className="text-[18px] font-semibold text-apple-ink font-display">
                  Claim Your Immutable Passport
                </h4>
              </div>

              {/* Name & Handle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-apple-ink flex items-center gap-1">
                    <User className="w-3 h-3 text-apple-blue" />
                    <span>Full Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full px-3 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-apple-ink flex items-center gap-1">
                    <span className="text-apple-blue font-mono font-bold">@</span>
                    <span>Handle *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signupHandle}
                    onChange={(e) => setSignupHandle(e.target.value)}
                    placeholder="@alex_sys"
                    className="w-full px-3 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink font-mono focus:outline-none focus:border-apple-blue"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-apple-ink flex items-center gap-1">
                  <Mail className="w-3 h-3 text-apple-blue" />
                  <span>Email Address *</span>
                </label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="alex@developer.io"
                  className="w-full px-3 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue"
                />
              </div>

              {/* Specialization / Role */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-apple-ink">
                  Primary Specialization *
                </label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  className="w-full px-3 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue cursor-pointer"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* GitHub Handle */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-apple-ink flex items-center gap-1">
                  <Github className="w-3 h-3 text-apple-blue" />
                  <span>GitHub Username (Optional)</span>
                </label>
                <input
                  type="text"
                  value={signupGithub}
                  onChange={(e) => setSignupGithub(e.target.value)}
                  placeholder="alex-builds"
                  className="w-full px-3 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue"
                />
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-apple-ink">
                  Short Bio (Optional)
                </label>
                <textarea
                  value={signupBio}
                  onChange={(e) => setSignupBio(e.target.value)}
                  rows={2}
                  placeholder="What are you hacking on this weekend?"
                  className="w-full px-3 py-2 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-apple w-full py-3 rounded-full bg-apple-blue hover:bg-apple-blue-focus text-white text-[15px] font-normal shadow-sm mt-3 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-white" />
                <span>{isLoading ? 'Generating Keys...' : 'Generate & Issue Passport'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-apple-parchment border-t border-apple-hairline text-center text-[11px] text-[#86868b] flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#30d158]" />
          <span>Ed25519 Cryptographic Signature & DPDP 2023 Compliant</span>
        </div>
      </div>
    </div>
  );
};
