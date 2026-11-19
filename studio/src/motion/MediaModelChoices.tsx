import { useState } from 'react';
import type { Model, Modality } from '../../../shared/gateway';
import { useI18n } from '../i18n/I18n';
import { RemixIcon } from '../icons/RemixIcons';
import { Skeleton } from '../components/ui/Skeleton';
import { ModelAvatar } from './settingsPrimitives';
import { sceneDestination, type StudioScene, studioScenes, supportsScene, modelDestination, type StudioDestination } from './creativeStudios';
import type { useMediaCatalog } from './useMediaCatalog';

export function MediaModelChoices({ kind, scene, destination, onModel, onNavigate, openProviders, catalog, failed, retry }: ReturnType<typeof useMediaCatalog> & {
  onModel: (id: string) => void; kind: Modality; scene?: StudioScene | null; destination?: StudioDestination | null; onNavigate?: (target: StudioDestination) => void; openProviders: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const providers = new Map(catalog?.status.providers.map(provider => [provider.id, provider]));
  const matchingScenes = scene ? [scene] : studioScenes.filter(item => item.modality === kind);
  const available = (model: Model) => Boolean(providers.get(model.provider)?.available);
  const models = (catalog?.models ?? []).filter(model => model.modality === kind && matchingScenes.some(scene => supportsScene(model, scene))
    && (model.label + ' ' + (providers.get(model.provider)?.label ?? model.provider)).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(available(b)) - Number(available(a)));
  function selectModel(model: Model) {
    if (scene && onNavigate) onNavigate(sceneDestination(scene, destination, model.id));
    else if (destination && onNavigate) onNavigate(modelDestination(model, destination));
    else onModel(model.id);
  }
  return <>
    <label className="om-field"><RemixIcon name="search-line" size={15} /><input type="search" aria-label={t('Search models')} placeholder={t('Search models…')} value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="om-creative-model-list" aria-busy={!failed && !catalog}>
      {failed ? <button className="om-button" onClick={retry}>{t('Retry loading models')}</button>
        : !catalog ? <Skeleton className="om-creative-model-skeleton" />
        : models.length ? models.map(model => <button key={model.id} className="om-nav-item om-creative-option" aria-current={destination?.model === model.id ? 'page' : undefined} onClick={() => selectModel(model)}>
          <ModelAvatar name={model.label} modelId={model.modelId} provider={{ id: model.provider, custom: false }} />
          <span><strong>{model.label}</strong><small className="om-muted">{providers.get(model.provider)?.label ?? model.provider}{' · '}{matchingScenes.filter(scene => supportsScene(model, scene)).map(scene => t(scene.label)).join(' / ')}{!available(model) && ' · ' + t('Setup required')}</small></span>
        </button>) : <p className="om-muted">{t(query || scene ? 'No matching models' : 'No enabled models. Connect a provider or sync its models.')}</p>}
    </div>
    <button className="om-nav-item" onClick={openProviders}><RemixIcon name="settings-3-line" size={15} />{t('Manage providers')}</button>
  </>;
}
