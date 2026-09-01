import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { store } from '../services/store';
import { X, User, Briefcase, FileText, Github, Linkedin, Globe, CheckCircle2 } from 'lucide-react';

interface EditProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState<string>(user.name);
  const [handle, setHandle] = useState<string>(user.handle);
  const [primaryRole, setPrimaryRole] = useState<string>(user.primaryRole);
  const [bio, setBio] = useState<string>(user.bio);
  const [githubUsername, setGithubUsername] = useState<string>(user.githubUsername);
  const [linkedinUrl, setLinkedinUrl] = useState<string>(user.linkedinUrl);
  const [portfolioUrl, setPortfolioUrl] = useState<string>(user.portfolioUrl);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setHandle(user.handle);
      setPrimaryRole(user.primaryRole);
      setBio(user.bio);
      setGithubUsername(user.githubUsername);
      setLinkedinUrl(user.linkedinUrl);
      setPortfolioUrl(user.portfolioUrl);
      setIsSaved(false);
    }
  }, [isOpen, user]);

  const handleSave = (e: React.FormEvent): void => {
    e.preventDefault();
    const updated = store.updateUser({
      name: name.trim() || user.name,
      handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`,
      primaryRole: primaryRole.trim() || user.primaryRole,
      bio: bio.trim(),
      githubUsername: githubUsername.trim().replace(/^https?:\/\/github\.com\//, ''),
      linkedinUrl: linkedinUrl.trim(),
      portfolioUrl: portfolioUrl.trim(),
    });

    setIsSaved(true);
    onSaved(updated);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-[24px] border border-apple-hairline product-shadow overflow-hidden my-auto text-apple-ink">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apple-hairline">
          <div>
            <h3 className="text-[20px] font-semibold text-apple-ink font-display">
              Edit Developer Passport
            </h3>
            <p className="text-[13px] text-[#86868b] font-normal">
              Update your public identity and profile links
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-[#86868b] hover:text-apple-ink flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-text">
          {/* Name & Handle Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-apple-blue" />
                <span>Display Name</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Garvit Prakash"
                className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
                <span className="text-apple-blue font-mono font-bold">@</span>
                <span>Handle</span>
              </label>
              <input
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="e.g. @gpdev"
                className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink font-mono focus:outline-none focus:border-apple-blue"
              />
            </div>
          </div>

          {/* Primary Role */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-apple-blue" />
              <span>Primary Role / Specialization</span>
            </label>
            <input
              type="text"
              required
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value)}
              placeholder="e.g. Full-Stack AI & Systems Architect"
              className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-apple-ink flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-apple-blue" />
              <span>Bio</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell other builders about what you build, frameworks, and active projects..."
              className="w-full px-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[14px] text-apple-ink focus:outline-none focus:border-apple-blue resize-none leading-relaxed"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-3 pt-2">
            <div className="text-[13px] font-semibold text-apple-ink">
              Verified Developer Links
            </div>

            <div className="space-y-2.5">
              <div className="relative flex items-center">
                <Github className="absolute left-3.5 w-4 h-4 text-[#86868b]" />
                <input
                  type="text"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="GitHub username (e.g. garvit-prakash)"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue"
                />
              </div>

              <div className="relative flex items-center">
                <Linkedin className="absolute left-3.5 w-4 h-4 text-[#86868b]" />
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="LinkedIn Profile URL"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue"
                />
              </div>

              <div className="relative flex items-center">
                <Globe className="absolute left-3.5 w-4 h-4 text-[#86868b]" />
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="Portfolio / Project Website URL"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-apple-parchment border border-apple-hairline rounded-xl text-[13px] text-apple-ink focus:outline-none focus:border-apple-blue"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-apple-hairline flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-apple px-4 py-2 rounded-full bg-apple-parchment hover:bg-[#e5e5ea] text-[14px] text-apple-ink"
            >
              Cancel
            </button>

            <button
              type="submit"
              className={`btn-apple px-6 py-2 rounded-full text-[14px] font-normal transition-all flex items-center gap-1.5 shadow-sm ${
                isSaved
                  ? 'bg-[#30d158] text-white'
                  : 'bg-apple-blue hover:bg-apple-blue-focus text-white'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
