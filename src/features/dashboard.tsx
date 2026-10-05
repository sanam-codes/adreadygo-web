import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Palette, Send, ChartColumn, Megaphone } from 'lucide-react';
import { api, money, type Row, type Campaign } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Stat, Loading, Notice, Status, Empty } from '../components/ui';
import { WorkspaceReadinessBanner } from './business-profile';

export function Dashboard() {
  const { business, base } = useWorkspace();
  const reports = useQuery({
    queryKey: [base, 'reports'],
    queryFn: () =>
      api<{ media: Row; linked: Row; leadCount: number; simulated: boolean }>(base + '/reports'),
  });
  const campaigns = useQuery({
    queryKey: [base, 'campaigns'],
    queryFn: () => api<Campaign[]>(base + '/campaigns'),
  });

  if (reports.isLoading) return <Loading />;
  if (reports.error) return <Notice error>{reports.error.message}</Notice>;
  const r = reports.data!;
  const measured = Number(r.media.records) > 0;

  return (
    <>
      <Heading
        eyebrow="YOUR MARKETING, TOGETHER"
        title={`Let’s grow ${business.name}.`}
        description="A little creativity. A clear plan. Your next customer."
        action={
          <Link className="button" to="/campaigns">
            <Sparkles size={17} />
            Create a campaign
          </Link>
        }
      />

      <WorkspaceReadinessBanner />

      <section className="hero">
        <div>
          <span className="pill light">FROM IDEA TO IMPACT</span>
          <h2>
            Big ideas deserve
            <br />a proper launch.
          </h2>
          <p>
            Bring your offer. We’ll help you shape the creative,
            <br />
            plan the campaign, and get everything ready.
          </p>
          <Link to="/campaigns" className="button white">
            Create a new campaign <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="mini-card card-back">
            <span>YOUR NEXT CAMPAIGN</span>
            <div className="mock-lines" />
            <Palette size={42} />
          </div>
          <div className="mini-card card-front">
            <Sparkles size={30} />
            <strong>
              Ready.
              <br />
              Set. Grow.
            </strong>
            <span>MADE FOR YOUR BRAND ↗</span>
          </div>
          <div className="float-chip">
            <span className="green-dot" />
            Ideas taking shape
          </div>
        </div>
      </section>

      <div className="stats">
        <Stat
          label="Advertising spend"
          value={measured ? money(r.media.spend, business.currency) : '—'}
          detail={r.simulated ? 'Simulated data · last 30 days' : 'No synced data yet'}
        />
        <Stat
          label="Messaging results"
          value={measured ? String(r.media.messages) : '—'}
          detail="Messaging results only"
        />
        <Stat label="Leads in your workspace" value={r.leadCount} detail="Across all lead stages" />
        <Stat
          label="Linked completed sales"
          value={money(r.linked.revenue, business.currency)}
          detail="Manually attributed outcomes"
        />
      </div>

      <div className="grid dashboard-bottom">
        <section className="panel">
          <div className="section-heading">
            <h3>Your campaigns</h3>
            <Link to="/campaigns">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {campaigns.data?.length ? (
            <div className="campaign-list">
              {campaigns.data.slice(0, 4).map((c) => (
                <Link className="campaign-row" to={'/campaigns/' + c.id} key={c.id}>
                  <span className="campaign-icon">
                    <Megaphone size={20} />
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      Revision {c.revision} · {c.delivery_state.replaceAll('_', ' ')}
                    </small>
                  </div>
                  <Status value={c.review_state} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Your first campaign starts here"
              description="Turn an offer into something your customers will notice."
              action={
                <Link to="/campaigns" className="text-link">
                  Create a campaign →
                </Link>
              }
            />
          )}
        </section>

        <section className="panel">
          <h3>A simple path to your next campaign</h3>
          <div className="steps">
            {[
              [Palette, 'Make it yours', 'Add your logo, colours, and offers.', '/brand'],
              [
                Sparkles,
                'Bring your idea to life',
                'Create a campaign brief and visuals.',
                '/campaigns',
              ],
              [Send, 'Review, then launch', 'You stay in control of every campaign.', '/campaigns'],
              [
                ChartColumn,
                'See what’s working',
                'Connect campaign activity with outcomes.',
                '/reports',
              ],
            ].map(([Icon, title, text, to]) => {
              const I = Icon as typeof Palette;
              return (
                <Link to={to as string} className="step" key={title as string}>
                  <I size={18} />
                  <div>
                    <strong>{title as string}</strong>
                    <p>{text as string}</p>
                  </div>
                  <ArrowRight size={15} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
