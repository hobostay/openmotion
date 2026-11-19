import { useMemo } from 'react';
import type { GalleryTemplate } from '../../../shared/catalog';
import { useI18n } from '../i18n/I18n';
import { Skeleton } from '../components/ui/Skeleton';
import { TemplateGalleryCard, TemplatePoster } from './TemplateGalleryCard';
import { templateCreators } from './templateCredits';
import styles from './TemplateLibraryDialog.module.css';

type Props = {
  catalog: GalleryTemplate[];
  creator: string | null;
  query: string;
  works: GalleryTemplate[];
  loading: boolean;
  error: string;
  retry: () => void;
  choose: (id: string | null) => void;
  open: (work: GalleryTemplate) => void;
  active: ReadonlySet<string>;
  onPriority: (id: string | null) => void;
};

export function TemplateCreators({ catalog, creator, query, works, loading, error, retry, choose, open, active, onPriority }: Props) {
  const { t, locale } = useI18n();
  const credits = useMemo(() => templateCreators(catalog, locale), [catalog, locale]);
  const current = credits.find(entry => entry.id === creator);
  const matches = credits.filter(entry => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <main className={styles.results} aria-busy={loading}>
    {creator && <button className="om-nav-item" onClick={() => choose(null)}>← {t('Creators')}</button>}
    <header className="om-discovery-heading"><div><h2>{current?.name ?? t('Creators')}</h2>
      <p className="om-muted">{current ? t(current.source) + ' · ' + t('{count} templates', { count: current.count }) : t('Browse catalogue credits and the accounts that published the original work.')}</p>
    </div></header>
    {error ? <div className={styles.empty} role="alert">{error}<button className="om-button" onClick={retry}>{t('Retry')}</button></div>
      : loading && !catalog.length ? <div className={styles.creatorGrid} aria-label={t('Loading templates…')} role="status">{[0, 1, 2].map(i => <Skeleton key={i} className={styles.creatorPoster} />)}</div>
      : creator ? <>{!works.length && <p className="om-muted">{t(current ? 'No matching templates. Try another name, creator or style.' : 'This creator has no credited work in this catalogue.')}</p>}
        <div className={styles.grid}>{works.map(work => <TemplateGalleryCard key={work.id} template={work} onSelect={open} active={active.has(work.id)} onPriority={onPriority} />)}</div></>
      : <div className={styles.creatorGrid}>{!matches.length && <p className="om-muted">{t('No matches')}</p>}
        {matches.map(entry => <button key={entry.id} className="om-scene-tile" onClick={() => choose(entry.id)}>
          <span className={styles.creatorPoster}><TemplatePoster template={entry.work} /></span>
          <strong>{entry.name}</strong><small className="om-muted">{t(entry.source)} · {t('{count} templates', { count: entry.count })}</small>
        </button>)}</div>}
  </main>;
}
