
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Menu, MessageSquare, Plus, Settings, Users, QrCode, Scan } from "lucide-react";

export interface FloatingNavbarProps {
  activeTab?: string;
  onSelectTab?: (tab: 'passport' | 'connections' | 'feed') => void;
  onOpenScanner?: () => void;
  onOpenBadge?: () => void;
  onOpenEditProfile?: () => void;
  onOpenAuth?: () => void;
}

export default function FloatingNavbar({
  activeTab = 'passport',
  onSelectTab,
  onOpenScanner,
  onOpenBadge,
  onOpenEditProfile,
  onOpenAuth,
}: FloatingNavbarProps) {
  return (
    // add fixed to the nav class name to make the navbar stick to the bottom of the screen
    <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <nav className="flex items-center justify-center space-x-2 sm:space-x-4 rounded-full border border-apple-hairline bg-white/90 backdrop-blur-xl p-2 shadow-product pointer-events-auto">
        <Button
          variant={activeTab === 'passport' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => onSelectTab?.('passport')}
          className={`rounded-full transition-all ${
            activeTab === 'passport' ? 'text-apple-blue font-semibold bg-apple-parchment' : 'text-[#86868b]'
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="sr-only">Passport</span>
        </Button>

        <Button
          variant={activeTab === 'connections' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => onSelectTab?.('connections')}
          className={`rounded-full transition-all ${
            activeTab === 'connections' ? 'text-apple-blue font-semibold bg-apple-parchment' : 'text-[#86868b]'
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="sr-only">Network</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              className="rounded-full bg-apple-blue text-white hover:bg-apple-blue-focus shadow-sm active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5" />
              <span className="sr-only">Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="rounded-[18px] border-apple-hairline p-1.5 shadow-product min-w-[190px]">
            <DropdownMenuItem
              onClick={() => onOpenScanner?.()}
              className="rounded-xl px-3 py-2 text-[13px] text-apple-ink cursor-pointer focus:bg-apple-parchment"
            >
              <Scan className="mr-2.5 h-4 w-4 text-apple-blue" />
              <span>Scan Peer Badge</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onOpenBadge?.()}
              className="rounded-xl px-3 py-2 text-[13px] text-apple-ink cursor-pointer focus:bg-apple-parchment"
            >
              <QrCode className="mr-2.5 h-4 w-4 text-apple-blue" />
              <span>Show My Pass</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onOpenEditProfile?.()}
              className="rounded-xl px-3 py-2 text-[13px] text-apple-ink cursor-pointer focus:bg-apple-parchment"
            >
              <Settings className="mr-2.5 h-4 w-4 text-apple-blue" />
              <span>Edit Passport</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={activeTab === 'feed' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => onSelectTab?.('feed')}
          className={`rounded-full transition-all ${
            activeTab === 'feed' ? 'text-apple-blue font-semibold bg-apple-parchment' : 'text-[#86868b]'
          }`}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="sr-only">Live Ops</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenAuth?.()}
          className="rounded-full text-[#86868b] hover:text-apple-ink"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Account</span>
        </Button>
      </nav>
    </div>
  );
}
