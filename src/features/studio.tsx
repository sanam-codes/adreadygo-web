import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Heading, Loading, Notice } from '../components/ui';
import { PosterFlow, type PosterProject } from './poster-flow';
export function StudioPage() {
  const { base } = useWorkspace();
  const { id } = useParams();
  const projects = useQuery({
    queryKey: [base, 'studio'],
    queryFn: () => api<PosterProject[]>(base + '/studio'),
    enabled: !id,
  });
  return (
    <>
      {id ? (
        <PosterFlow projectId={id} />
      ) : (
        <>
          <Heading
            eyebrow="CREATIVE WORKSPACE"
            title="Make your next campaign stand out."
            description="Start with an idea. Find the right angle, choose a visual style, and create your poster."
            action={
              <Link className="button" to="/campaigns?new=1">
                <Plus size={16} /> New poster campaign
              </Link>
            }
          />
          {projects.isLoading ? (
            <Loading />
          ) : projects.error ? (
            <Notice error>{projects.error.message}</Notice>
          ) : (
            <div className="grid two">
              {projects.data?.map((p) => (
                <Link
                  key={p.id}
                  className="panel"
                  to={'/assistant/' + p.id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <span className="eyebrow">
                    {p.content.versions?.length ? 'POSTER READY' : 'IN PROGRESS'}
                  </span>
                  <h3>{p.content.prompt.slice(0, 90)}</h3>
                  <p className="tiny">
                    {p.content.selectedConcept?.title || 'Explore your campaign ideas'}
                  </p>
                  <span className="back-link">
                    Continue creating <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
              {!projects.data?.length && (
                <div className="panel">
                  <h3>Your next idea starts here.</h3>
                  <p>
                    Create a campaign to explore five directions and choose the look that fits your
                    business.
                  </p>
                  <Link className="button" to="/campaigns?new=1">
                    Create a poster campaign <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
