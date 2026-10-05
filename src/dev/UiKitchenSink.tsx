import { QUICK_TAG_SUGGESTIONS } from '@loopin/shared';
import {
  Award,
  Bell,
  Download,
  Ellipsis,
  IdCard,
  LogOut,
  Medal,
  Moon,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Share,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, type AvatarSize } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ExternalLink } from '@/components/common/ExternalLink';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Logo } from '@/components/common/Logo';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { UserRow } from '@/components/common/UserRow';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Chip,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  Input,
  List,
  ListItem,
  ListRow,
  ListSection,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Switch,
  SwitchField,
  TagInput,
  Textarea,
  tabPanelProps,
  toast,
  type BadgeTone,
} from '@/components/ui';
import { ApiError } from '@/lib/api-error';
import { THEME_OPTIONS, useTheme, type ThemePreference } from '@/lib/theme';
import { usePageTitle } from '@/lib/usePageTitle';
import { publicUrl } from '@/lib/utils';

/** Dev-only catalogue of every primitive and state. `?open=dialog|confirm|long|menu` and `?toast=1` preset states for screenshots. */

const TYPE_SCALE = [
  ['display', 'text-display', 'Your hackathon passport.'],
  ['large-title', 'text-large-title', 'Genesis Hacks 2026'],
  ['title', 'text-title', 'Connections'],
  ['headline', 'text-headline', 'Ananya Iyer connected with you'],
  ['body', 'text-body', 'Swap profiles with one scan and keep private notes on everyone you meet.'],
  ['callout', 'text-callout', 'Met at Genesis Hacks 2026 · Bengaluru'],
  ['footnote', 'text-footnote', 'Codes refresh every 30 seconds.'],
  ['caption', 'text-caption', 'Self-rated'],
  ['tab', 'text-tab', 'Passport'],
] as const;

const SURFACES = [
  ['canvas', 'bg-canvas'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['surface-3', 'bg-surface-3'],
  ['line-soft', 'bg-line-soft'],
  ['line', 'bg-line'],
  ['line-strong', 'bg-line-strong'],
  ['accent', 'bg-accent'],
  ['danger-solid', 'bg-danger-solid'],
] as const;

const INKS = [
  ['ink', 'text-ink'],
  ['ink-2', 'text-ink-2'],
  ['ink-3', 'text-ink-3'],
  ['accent-ink', 'text-accent-ink'],
  ['success', 'text-success'],
  ['warning', 'text-warning'],
  ['danger', 'text-danger'],
  ['gold', 'text-gold'],
  ['silver', 'text-silver'],
  ['bronze', 'text-bronze'],
] as const;

const BADGE_TONES: BadgeTone[] = ['neutral', 'accent', 'success', 'warning', 'danger', 'gold', 'silver', 'bronze'];

const PEOPLE = [
  { name: 'Ananya Iyer', handle: 'ananya_ml', headline: 'ML engineer · Organizer at Genesis Hacks', avatarUrl: null },
  { name: 'Rohan Mehta', handle: 'rohan_sys', headline: 'Systems engineer · Rust and distributed systems', avatarUrl: null },
  { name: 'Elena Kovač', handle: 'elena_zk', headline: 'Cryptography researcher · zero-knowledge proofs', avatarUrl: null },
  { name: 'Marcus Vance', handle: 'marcus_v', headline: 'Design engineer', avatarUrl: null },
  { name: 'Priya Sharma', handle: 'priya_builds', headline: 'Mobile developer · React Native and Kotlin', avatarUrl: null },
  { name: 'Arjun Nair', handle: 'arjun_n', headline: 'Backend engineer · Go', avatarUrl: null },
  { name: 'Meera Krishnan', handle: 'meera_k', headline: 'Product designer', avatarUrl: null },
  { name: 'Kabir Singh', handle: 'kabir_dev', headline: 'DevOps & cloud', avatarUrl: null },
] as const;

const AVATAR_SIZES: AvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

const ERROR_SAMPLES = [
  new ApiError({ status: 0, code: 'network_error', message: "You're offline or the server can't be reached." }),
  new ApiError({ status: 429, code: 'rate_limited', message: 'Too many requests.' }),
  new ApiError({ status: 404, code: 'not_found', message: 'No one with that handle.' }),
] as const;

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="px-1">
        <h2 id={id} className="text-title text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-callout text-ink-2">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <p className="text-footnote font-medium text-ink-3">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}

export default function UiKitchenSink() {
  usePageTitle('UI kit');
  const { theme, setTheme } = useTheme();
  const [params] = useSearchParams();
  const preset = params.get('open');

  const [filters, setFilters] = useState<string[]>(['Teammate']);
  const [tags, setTags] = useState<string[]>(['Follow up', 'Rust']);
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [mode, setMode] = useState<'code' | 'scan'>('code');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('Rebuilt the check-in flow overnight. Ask about the Rust port of their indexer.');
  const [notify, setNotify] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [menuSort, setMenuSort] = useState('recent');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [longOpen, setLongOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const toastShown = useRef(false);

  // Presets open overlays after mount, like a real tap would. The menu anchors to its trigger, so the trigger is
  // scrolled on screen first.
  useEffect(() => {
    if (preset === 'menu') menuTriggerRef.current?.scrollIntoView({ block: 'center' });
    const frame = window.requestAnimationFrame(() => {
      if (preset === 'dialog') setDialogOpen(true);
      if (preset === 'confirm') setConfirmOpen(true);
      if (preset === 'long') setLongOpen(true);
      if (preset === 'menu') setMenuOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [preset]);

  useEffect(() => {
    if (params.get('toast') && !toastShown.current) {
      toastShown.current = true;
      toast.success('Saved to your network', { description: 'Ananya Iyer · Met at Genesis Hacks 2026' });
    }
  }, [params]);

  const toggleFilter = (tag: string) =>
    setFilters((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));

  return (
    <div className="min-h-dvh pb-safe-offset-16">
      <header className="frosted sticky top-0 z-bar border-b border-line-soft pt-safe">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <Badge tone="accent">UI kit</Badge>
          </div>
          <SegmentedControl<ThemePreference>
            semantics="radio"
            aria-label="Theme"
            size="sm"
            value={theme}
            onChange={setTheme}
            options={THEME_OPTIONS}
            className="w-full sm:w-64"
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-6 md:px-6 md:pt-8">
        <div className="px-1">
          <h1 className="text-large-title text-ink">Design system</h1>
          <p className="mt-1 text-body text-ink-2">Every primitive and state, in both themes. Development builds only.</p>
        </div>

        <Section title="Type" description="Named sizes only — never text-[Npx].">
          <Card className="flex flex-col divide-y divide-line-soft py-1" padding="none">
            {TYPE_SCALE.map(([name, className, sample]) => (
              <div key={name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <code className="w-28 shrink-0 font-mono text-caption text-ink-3">{name}</code>
                <p className={`${className} min-w-0 text-ink`}>{sample}</p>
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Color" description="Semantic tokens, redefined for dark mode.">
          <Card className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {SURFACES.map(([name, className]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <div className={`${className} h-12 rounded-input shadow-card`} />
                  <code className="truncate font-mono text-caption text-ink-3">{name}</code>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
              {INKS.map(([name, className]) => (
                <p key={name} className={`${className} text-callout font-semibold`}>
                  {name}
                </p>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Buttons" description="Pills, 44px tall by default; icon buttons require a label.">
          <Card className="flex flex-col gap-5">
            <Row label="Variants">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Delete</Button>
              <Button variant="link">Link</Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" variant="secondary" aria-label="Notifications">
                <Bell aria-hidden="true" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="More">
                <Ellipsis aria-hidden="true" />
              </Button>
            </Row>
            <Row label="With icons and states">
              <Button>
                <QrCode aria-hidden="true" />
                Show my code
              </Button>
              <Button variant="secondary">
                <Share aria-hidden="true" />
                Share passport
              </Button>
              <Button loading>Saving</Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </Row>
            <Button size="lg" className="w-full">
              Continue
            </Button>
          </Card>
        </Section>

        <Section title="Fields" description="Field wires label, hint and error to the control.">
          <Card className="flex flex-col gap-5">
            <Field label="Name" hint="Shown on your passport." required>
              <Input defaultValue="Garvit Prakash" autoComplete="name" />
            </Field>
            <Field label="Handle" error="That handle is taken" required>
              <Input defaultValue="ananya_ml" autoCapitalize="off" />
            </Field>
            <Field label="Website" optional>
              <Input type="url" placeholder="https://" inputMode="url" />
            </Field>
            <Field label="Search connections" srOnlyLabel>
              <SearchInput placeholder="Search name, notes or tags" value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch('')} />
            </Field>
            <Field label="Private note" accessory={`${note.length}/2000`} hint="Only you can see this.">
              <Textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} minRows={2} />
            </Field>
            <Field label="Role">
              <Select defaultValue="hacker">
                <option value="hacker">Hacker</option>
                <option value="mentor">Mentor</option>
                <option value="judge">Judge</option>
              </Select>
            </Field>
            <div className="flex flex-col divide-y divide-line-soft">
              <SwitchField label="Active" description="Attendees see this event in Live" checked={notify} onCheckedChange={setNotify} />
              <SwitchField label="Scan sounds" checked={sounds} onCheckedChange={setSounds} />
            </div>
            <Row label="Switch states">
              <Switch aria-label="On" checked onCheckedChange={() => undefined} />
              <Switch aria-label="Off" checked={false} onCheckedChange={() => undefined} />
              <Switch aria-label="Disabled" disabled />
            </Row>
          </Card>
        </Section>

        <Section title="Chips and tags">
          <Card className="flex flex-col gap-5">
            <Row label="Filter chips">
              {['Teammate', 'Mentor', 'Hiring', 'Follow up'].map((tag) => (
                <Chip key={tag} selected={filters.includes(tag)} onSelectedChange={() => toggleFilter(tag)}>
                  {tag}
                </Chip>
              ))}
            </Row>
            <Row label="Static and removable">
              <Chip>Rust</Chip>
              <Chip icon={<Users />}>12 connections</Chip>
              <Chip onRemove={() => undefined}>Investor</Chip>
              <Chip size="sm" onRemove={() => undefined}>
                Follow up
              </Chip>
            </Row>
            <Field label="Tags" hint="Up to 10 tags. Only you can see them.">
              <TagInput value={tags} onChange={setTags} suggestions={[...QUICK_TAG_SUGGESTIONS, 'Rust', 'AI / ML']} max={10} maxLength={24} />
            </Field>
          </Card>
        </Section>

        <Section title="Segmented controls" description="Radio semantics for filters, tab semantics for panels.">
          <Card className="flex flex-col gap-5">
            <SegmentedControl
              semantics="radio"
              aria-label="Sort connections"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recent', label: 'Recent' },
                { value: 'name', label: 'Name' },
              ]}
            />
            <div className="flex flex-col gap-3">
              <SegmentedControl
                semantics="tabs"
                idBase="kitchen-exchange"
                aria-label="Exchange mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'code', label: 'My code' },
                  { value: 'scan', label: 'Scan' },
                ]}
              />
              <div {...tabPanelProps('kitchen-exchange', mode)} className="focus-ring rounded-input bg-surface-2 p-4 text-callout text-ink-2">
                {mode === 'code' ? 'Your rotating code appears here. Codes refresh every 30 seconds.' : 'The camera view appears here.'}
              </div>
            </div>
            <SegmentedControl
              semantics="radio"
              aria-label="Live filter"
              size="sm"
              value="all"
              onChange={() => undefined}
              options={[
                { value: 'all', label: 'All' },
                { value: 'urgent', label: 'Urgent' },
                { value: 'updates', label: 'Updates' },
                { value: 'events', label: 'Events', disabled: true },
              ]}
            />
          </Card>
        </Section>

        <Section title="Badges" description="Soft tints only; medal tones for awards.">
          <Card className="flex flex-col gap-4">
            <Row>
              {BADGE_TONES.map((tone) => (
                <Badge key={tone} tone={tone}>
                  {tone}
                </Badge>
              ))}
            </Row>
            <Row>
              <Badge tone="gold">
                <Medal aria-hidden="true" />
                1st place
              </Badge>
              <Badge tone="silver">
                <Medal aria-hidden="true" />
                2nd place
              </Badge>
              <Badge tone="bronze">
                <Medal aria-hidden="true" />
                3rd place
              </Badge>
              <Badge tone="success">
                <ShieldCheck aria-hidden="true" />
                Verified
              </Badge>
              <Badge tone="warning">Revoked</Badge>
              <Badge size="sm" tone="danger">
                Urgent
              </Badge>
            </Row>
          </Card>
        </Section>

        <Section title="Cards and lists">
          <Card variant="hero">
            <CardHeader>
              <div>
                <CardTitle as="h3">Genesis Hacks 2026</CardTitle>
                <CardDescription>Bengaluru · Hackathon</CardDescription>
              </div>
              <Badge tone="success">Live</Badge>
            </CardHeader>
            <p className="text-body text-ink-2">36 hours of building, mentoring and shipping. Check in at the registration desk to get your stamp.</p>
            <CardFooter>
              <Button size="sm">Going</Button>
              <Button size="sm" variant="secondary">
                Details
              </Button>
            </CardFooter>
          </Card>
          <Card padding="none" className="overflow-hidden">
            <List>
              {PEOPLE.slice(0, 4).map((person, index) => (
                <ListItem key={person.handle} inset="avatar">
                  <UserRow
                    user={person}
                    meta={index === 0 ? 'Met at Genesis Hacks 2026 · 2 hr ago' : undefined}
                    trailing={index === 1 ? <Badge size="sm">Not mutual</Badge> : undefined}
                    onClick={() => toast(`Open ${person.name}`)}
                  />
                </ListItem>
              ))}
            </List>
          </Card>
          <ListSection title="Account" footer="Signing out clears data saved on this device.">
            <ListRow icon={<IdCard />} title="Edit profile" chevron onClick={() => undefined} />
            <ListRow icon={<Moon />} title="Appearance" value="System" chevron onClick={() => undefined} />
            <ListRow icon={<Bell />} title="Scan sounds" trailing={<Switch aria-label="Scan sounds" checked={sounds} onCheckedChange={setSounds} />} />
            <ListRow icon={<Download />} title="Export my data" description="A JSON file with everything Loopin stores about you" onClick={() => undefined} />
            <ListRow icon={<LogOut />} title="Sign out" destructive onClick={() => undefined} />
          </ListSection>
        </Section>

        <Section title="Dialogs and menus" description="Bottom sheet on phones, centered card on larger screens.">
          <Card className="flex flex-col gap-4">
            <Row>
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                <Pencil aria-hidden="true" />
                Edit note
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                <Trash2 aria-hidden="true" />
                Remove connection
              </Button>
              <Button variant="secondary" onClick={() => setLongOpen(true)}>
                Long content
              </Button>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button ref={menuTriggerRef} variant="secondary">
                    <Download aria-hidden="true" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Export 12 connections</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <IdCard aria-hidden="true" />
                    Contacts (.vcf)
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download aria-hidden="true" />
                    Spreadsheet (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={menuSort} onValueChange={setMenuSort}>
                    <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">By name</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive>
                    <Trash2 aria-hidden="true" />
                    Remove all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Row>
          </Card>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent
              title="Ananya Iyer"
              description="Met at Genesis Hacks 2026"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="kitchen-note-form">
                    Save
                  </Button>
                </>
              }
            >
              <form
                id="kitchen-note-form"
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setDialogOpen(false);
                  toast.success('Saved to your network');
                }}
              >
                <Field label="Private note" hint="Only you can see this.">
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
                <Field label="Tags">
                  <TagInput value={tags} onChange={setTags} suggestions={QUICK_TAG_SUGGESTIONS} max={10} />
                </Field>
              </form>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Remove Ananya?"
            description="They won't see your contact details anymore, and your notes about them will be deleted."
            confirmLabel="Remove"
            destructive
            onConfirm={() => new Promise((resolve) => window.setTimeout(resolve, 900))}
          />

          <Dialog open={longOpen} onOpenChange={setLongOpen}>
            <DialogContent
              title="Privacy"
              footer={
                <Button className="sm:min-w-24" onClick={() => setLongOpen(false)}>
                  Done
                </Button>
              }
            >
              <div className="flex flex-col gap-3 text-body text-ink-2">
                {Array.from({ length: 9 }, (_, index) => (
                  <p key={index}>
                    Notes are private to you. They are stored on Loopin's server so they sync across your devices, they are not end-to-end
                    encrypted, and they are never shown to anyone else.
                  </p>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Feedback">
          <Card className="flex flex-col gap-5">
            <Row label="Skeletons">
              <div className="flex w-full items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
              </div>
            </Row>
            <Row label="Spinners">
              <Spinner size="sm" className="text-ink-3" />
              <Spinner className="text-ink-3" />
              <Spinner size="lg" className="text-accent-ink" label="Loading" />
            </Row>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="text-callout font-semibold text-ink">1,260 XP · Builder</p>
                <p className="text-footnote text-ink-3">240 XP to Veteran</p>
              </div>
              <ProgressBar value={0.8} label="Progress to Veteran" valueText="1,260 of 1,500 XP" />
            </div>
            <Row label="Copy and toasts">
              <CopyButton value={publicUrl('/u/gpdev')} label="Copy link" />
              <CopyButton value="lp-key-3f9a" iconOnly label="Copy key id" variant="ghost" />
              <Button variant="secondary" size="sm" onClick={() => toast.success('Saved to your network', { description: 'Ananya Iyer' })}>
                Success toast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => toast.error("Couldn't connect", { description: 'This code expired — ask them to refresh' })}>
                Error toast
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  toast('Elena Kovač connected with you', {
                    description: 'Met at Genesis Hacks 2026',
                    action: { label: 'View', onClick: () => undefined },
                  })
                }
              >
                Action toast
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={loadingDemo}
                onClick={() => {
                  setLoadingDemo(true);
                  window.setTimeout(() => setLoadingDemo(false), 1500);
                }}
              >
                <RefreshCw aria-hidden="true" />
                Loading button
              </Button>
            </Row>
            <p className="text-callout text-ink-2">
              External links:{' '}
              <ExternalLink href="https://github.com/Garvit-821" className="font-medium text-accent-ink underline-offset-4 hover:underline">
                github.com/Garvit-821
              </ExternalLink>{' '}
              · unsafe URLs render as text: <ExternalLink href="javascript:alert(1)">javascript:alert(1)</ExternalLink>
            </p>
          </Card>
        </Section>

        <Section title="Empty and error states">
          <Card padding="none">
            <EmptyState
              icon={Users}
              title="No connections yet"
              description="Scan someone's code, or show yours — you'll both be connected."
              action={
                <Button>
                  <QrCode aria-hidden="true" />
                  Open Exchange
                </Button>
              }
            />
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            {ERROR_SAMPLES.map((error) => (
              <Card key={error.code} padding="none">
                <ErrorState error={error} size="sm" onRetry={() => undefined} />
              </Card>
            ))}
          </div>
          <Card padding="none">
            <EmptyState size="sm" icon={Award} title="No awards yet" description="Podium finishes and special prizes from organizers show up here." headingLevel="h3" />
          </Card>
        </Section>

        <Section title="Avatars" description="Photos fall back to initials on a gradient picked from the name.">
          <Card className="flex flex-col gap-5">
            <Row label="Sizes">
              {AVATAR_SIZES.map((size) => (
                <Avatar key={size} name="Garvit Prakash" size={size} />
              ))}
            </Row>
            <Row label="Gradients">
              {PEOPLE.map((person) => (
                <Avatar key={person.handle} name={person.name} size="lg" />
              ))}
            </Row>
            <Row label="Broken image falls back">
              <Avatar name="Daniel Park" src="https://invalid.example/avatar.png" size="lg" />
              <Avatar name="Sara Thomas" src="" size="lg" />
            </Row>
          </Card>
        </Section>

        <Section title="Status">
          <Card padding="none" className="overflow-hidden">
            <OfflineBanner show />
            <LoadingScreen fullScreen={false} />
          </Card>
          <Button variant="outline" className="self-start" onClick={() => toast('Organizer console', { description: 'Manage events, check-ins and awards.' })}>
            <Plus aria-hidden="true" />
            Default toast
          </Button>
        </Section>
      </main>
    </div>
  );
}
