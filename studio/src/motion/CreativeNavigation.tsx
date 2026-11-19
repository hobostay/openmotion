import type { CreativeStudio, TechniqueStudio } from '../../../shared/studio-catalog';
import { useEffect, useId, useRef, useState } from 'react';
import type { Modality } from '../../../shared/gateway';
import { Popover } from '../components/ui/Popover';
import { useI18n } from '../i18n/I18n';
import { RemixIcon } from '../icons/RemixIcons';
import { workspacePageHref } from './workspacePageRouting';
import { creativeStudios, mediaLabels, sceneDestination, studioScenes, supportsScene, type StudioDestination } from './creativeStudios';
import { mcpClients, type McpClient } from './mcpClients';
import { useMediaCatalog } from './useMediaCatalog';
import { editingPresets } from './skillCatalog';
import { MediaModelChoices } from './MediaModelChoices';

export type CreativeNavigationProps = {
  onModel: (id: string) => void;
  onChooseStudio: (studio: CreativeStudio, kind?: Modality) => void;
  specialty: TechniqueStudio | null;
  destination: StudioDestination | null;
  motionActive: boolean;
  onNavigate: (destination: StudioDestination | null) => void;
  openProviders: () => void;
  onSkill: (id: string) => void;
  currentPage: 'explore' | 'api' | 'mcp' | null;
  onOpenPage: (page: 'explore' | 'api' | 'mcp', client?: McpClient) => void;
};

function MediaChoices({ kind, onModel, destination, onNavigate, onSkill, openProviders, catalog, failed, retry }: Pick<CreativeNavigationProps, 'destination' | 'onModel' | 'onNavigate' | 'openProviders' | 'onSkill'> & ReturnType<typeof useMediaCatalog> & { kind: Modality }) {
  const { t } = useI18n();
  const [modelScene, setModelScene] = useState(destination?.scene.modality === kind ? destination.scene : null);
  const modelsHeading = useRef<HTMLHeadingElement>(null);
  const matchingScenes = studioScenes.filter(scene => scene.modality === kind);
  const pinned = catalog?.models.find(model => model.id === destination?.model);
  return <div className="om-creative-menu-columns">
    <section><h2 className="om-eyebrow">{t('Scenes')}</h2>
      {matchingScenes.map(scene => {
        const current = destination?.scene.id === scene.id;
        const filtering = modelScene?.id === scene.id;
        const filterLabel = t('Models for {scene}', { scene: t(scene.label) });
        return <div className="om-nav-row om-creative-scene-row" data-active={current} key={scene.id}>
          <button className="om-nav-item om-nav-row-link om-creative-option" aria-current={current ? 'page' : undefined}
            onClick={() => onNavigate(sceneDestination(scene, destination, pinned && supportsScene(pinned, scene) ? pinned.id : null))}>
            <span className="om-creation-icon" data-tone={kind}><RemixIcon name={scene.icon} size={18} /></span>
            <span><strong>{t(scene.label)}</strong><small className="om-muted">{t(scene.hint)}</small></span>
          </button>
          <button className="om-nav-item om-nav-row-action" title={filterLabel} aria-label={filterLabel} aria-pressed={filtering}
            onClick={() => {
              setModelScene(filtering ? null : scene);
              if (window.matchMedia('(max-width: 560px)').matches) modelsHeading.current?.scrollIntoView({ block: 'nearest' });
            }}><RemixIcon name={filtering ? 'equalizer-fill' : 'equalizer-line'} size={16} /></button>
        </div>;
      })}
    </section>
    <section><h2 className="om-eyebrow" ref={modelsHeading}>{t('Models')}</h2>
      {modelScene && <button className="om-nav-item om-model-scene-chip" aria-label={t('Clear filters')} onClick={() => setModelScene(null)}>{t(modelScene.label)}<RemixIcon name="close-line" size={14} /></button>}
      <MediaModelChoices scene={modelScene} {...{ kind, onModel, destination, onNavigate, openProviders, catalog, failed, retry }} />
    </section>
    {kind === 'video' && <section className="om-creative-related-skills"><h2 className="om-eyebrow">{t('Skills')}</h2><div>
      {editingPresets.map(skill => <button className="om-nav-item" key={skill.id} onClick={() => onSkill(skill.id)}><RemixIcon name="movie-line" size={15} /><span>{t(skill.title)}</span></button>)}
    </div></section>}
  </div>;
}

export function CreativeNavigation({ specialty, onModel, onChooseStudio, destination, motionActive, onNavigate, openProviders, onSkill, currentPage, onOpenPage }: CreativeNavigationProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Modality | 'mcp' | null>(null);
  const [popupHost, setPopupHost] = useState<HTMLElement>();
  const navId = useId();
  const rail = useRef<HTMLElement>(null);
  const catalog = useMediaCatalog(open !== null && open !== 'mcp');

  useEffect(() => {
    const viewport = rail.current!;
    // Native dialogs own their top layer. Anchor menus inside the dialog, outside the scrolling strip.
    setPopupHost(viewport.closest<HTMLElement>('dialog, [data-feedback-modal]') ?? undefined);
    const update = () => {
      viewport.toggleAttribute('data-scroll-start', viewport.scrollLeft > 1);
      viewport.toggleAttribute('data-scroll-end', viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1);
      const group = viewport.querySelector('.om-creative-split:has(> [aria-expanded="true"])');
      if (group) {
        const anchor = group.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
        if (anchor.right < bounds.left || anchor.left > bounds.right) setOpen(null);
      }
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || event.deltaX || !event.deltaY || !event.cancelable) return;
      const previous = viewport.scrollLeft;
      const unit = event.deltaMode === 1 ? viewport.clientHeight : event.deltaMode === 2 ? viewport.clientWidth : 1;
      viewport.scrollLeft += event.deltaY * unit;
      if (viewport.scrollLeft !== previous) event.preventDefault();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(viewport.firstElementChild!);
    viewport.addEventListener('scroll', update);
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', update);
      viewport.removeEventListener('wheel', wheel);
    };
  }, []);

  const choose = (action: () => void) => {
    const navigation = rail.current;
    if (open && navigation && !navigation.contains(document.activeElement)) {
      // A disappearing menu item must not reclaim focus from an input on the destination page.
      navigation.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus({ preventScroll: true });
    }
    setOpen(null);
    action();
  };
  const menuDestinations = [
    ...creativeStudios.filter(studio => studio.surface === 'media').map(studio => {
      const kind = studio.primaryModality;
      const label = t(mediaLabels[kind]);
      return { id: kind, label, current: destination?.scene.modality === kind ? 'location' as const : undefined,
        menuLabel: t('{media} scenes and models', { media: label }), onActivate: () => onChooseStudio(studio, kind) };
    }),
    { id: 'mcp' as const, label: 'MCP', current: currentPage === 'mcp' ? 'page' as const : undefined,
      menuLabel: t('Agent client'), onActivate: () => onOpenPage('mcp') },
  ];
  return <nav ref={rail} className="om-creative-navigation" aria-label={t('Creative studio')}>
    <div className="om-creative-strip">
      <button className="om-nav-item" aria-current={currentPage === 'explore' ? 'page' : undefined} onClick={() => choose(() => onOpenPage('explore'))}>{t('Explore')}</button>
      {menuDestinations.map(({ id, label, current, menuLabel, onActivate }) => (
        <div key={id} className="om-nav-row om-creative-split" data-active={Boolean(current)}>
          <Popover container={popupHost} modal={false} openOnHover open={open === id}
            onOpenChange={value => setOpen(previous => value ? id : previous === id ? null : previous)}
            aria-label={menuLabel} align="start" className={id === 'mcp' ? 'om-selection-panel om-creative-client-menu' : 'om-selection-panel om-creative-menu'}
            primaryAction={<button className="om-nav-item om-nav-row-link" aria-current={current} onClick={() => choose(onActivate)}>{label}</button>}
            trigger={<button className="om-nav-item om-nav-row-action" aria-label={menuLabel} aria-expanded={open === id}><RemixIcon name="arrow-down-s-line" size={12} /></button>}>
            {id === 'mcp' ? <>
              <h2 className="om-eyebrow">{t('Agent client')}</h2>
              {mcpClients.map(client => <button className="om-nav-item" key={client.id} onClick={() => choose(() => onOpenPage('mcp', client.id))}>
                {t(client.name)}{client.host === 'chatgpt' && <small className="om-muted">{t('Remote connection unavailable')}</small>}
              </button>)}
            </> : open === id && <MediaChoices {...catalog} kind={id} destination={destination}
              onModel={model => choose(() => onModel(model))} onNavigate={next => choose(() => onNavigate(next))}
              onSkill={skill => choose(() => onSkill(skill))} openProviders={() => choose(openProviders)} />}
          </Popover>
        </div>
      ))}
      <a className="om-nav-item" href={workspacePageHref(location.href, { api: true, tool: null, templates: false })} aria-current={currentPage === 'api' ? 'page' : undefined}
        onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); choose(() => onOpenPage('api')); }}>API</a>
      <span className="om-divider om-creative-divider" aria-hidden="true" />
      {creativeStudios.map(studio => {
        const isCurrent = studio.surface === 'editor' ? motionActive
          : (studio.id === destination?.studio.id && !destination?.landing) || studio.id === specialty?.id;
        const badge = 'navBadge' in studio ? studio.navBadge : undefined;
        const badgeId = badge ? navId + '-' + studio.id : undefined;
        return <button key={studio.id} className="om-nav-item" aria-current={isCurrent ? 'page' : undefined}
          aria-label={t(studio.title)} aria-describedby={badgeId} onClick={() => choose(() => onChooseStudio(studio))}>
          {t(studio.title)}{badge && <span className="om-badge" data-nav-badge={badge} id={badgeId} lang="en">{badge}</span>}
        </button>;
      })}
    </div>
  </nav>;
}
