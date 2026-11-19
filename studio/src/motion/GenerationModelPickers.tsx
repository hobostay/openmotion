import type { ReactNode } from 'react';
import type { Model, ProviderState } from '../../../shared/gateway';
import { Select } from '../components/ui/Select';
import { useI18n } from '../i18n/I18n';
import { ModelAvatar } from './settingsPrimitives';

export function GenerationModelPickers({ models, providers, defaultModel, preferred, showProvider, modelHeading, disabled, onChoose }: {
  models: Model[]; providers: ProviderState[]; defaultModel?: string; preferred?: Model;
  showProvider: boolean; modelHeading: ReactNode; disabled: boolean; onChoose: (id: string) => void;
}) {
  const { t } = useI18n();
  const visibleProviders = providers.filter(provider => models.some(model => model.provider === provider.id));
  const visibleModels = showProvider && preferred ? models.filter(model => model.provider === preferred.provider) : models;
  const chooseProvider = (id: string) => {
    const candidates = models.filter(model => model.provider === id);
    const next = candidates.find(model => model.id === defaultModel) ?? candidates[0];
    if (next) onChoose(next.id);
  };
  return <div className="om-generation-pickers" data-paired={showProvider || undefined}>
    {showProvider && <div className="om-generation-picker">
      <span className="om-eyebrow">{t('Provider')}</span>
      <Select label={t('Provider')} disabled={disabled} value={preferred?.provider ?? ''}
        options={visibleProviders.map(provider => ({ value: provider.id, label: provider.label ?? provider.id,
          description: provider.available ? undefined : t('Setup required') }))} onCommit={chooseProvider} />
    </div>}
    <div className="om-generation-picker">
      {modelHeading}
      <Select label={t('Generation model')} disabled={disabled} value={preferred?.id ?? ''} onCommit={onChoose}
        options={visibleModels.map(model => ({ value: model.id, label: model.label, description: model.provider + ' · ' + model.mode,
          icon: <ModelAvatar name={model.label} modelId={model.modelId} provider={{ id: model.provider, custom: false }} /> }))} />
    </div>
  </div>;
}
