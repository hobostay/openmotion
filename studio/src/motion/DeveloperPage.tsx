import { useState } from 'react';
import { phase1Tools } from '../../../shared/phase1-tools';
import { modalities, type Modality } from '../../../shared/gateway';
import { useI18n } from '../i18n/I18n';
import { RemixIcon } from '../icons/RemixIcons';
import { GITHUB_REPOSITORY } from './githubRepository';
import { MediaModelChoices } from './MediaModelChoices';
import { mediaLabels } from './creativeStudios';
import { useMediaCatalog } from './useMediaCatalog';

export function DeveloperPage({ toolId, onTool, onModel, onProviders, onExplore, onConnect }: {
  toolId: string | null; onTool: (id: string | null) => void; onModel: (id: string) => void;
  onProviders: () => void; onExplore: () => void; onConnect: () => void;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Modality>('image');
  const catalog = useMediaCatalog(true);
  return <main className="om-explore"><div className="om-discovery-page">
    <div><button className="om-nav-item" onClick={onExplore}><RemixIcon name="arrow-left-line" size={16} />{t('Back to Explore')}</button></div>
    <header className="om-discovery-heading"><div><h1 className="om-title">OpenMotion API</h1>
      <p className="om-muted">{t('Inspect tool inputs and choose a model to try in Studio.')}</p></div>
      <button className="om-button" onClick={onConnect}>{t('MCP · Connect Agent')}</button></header>
    <section><h2 className="om-subtitle">{t('Models')}</h2>
      <div className="om-choice-tabs" role="group" aria-label={t('Media type')}>{modalities.map(value => <button key={value} className="om-nav-item" aria-pressed={kind === value} onClick={() => setKind(value)}>{t(mediaLabels[value])}</button>)}</div>
      <div className="om-index-models"><MediaModelChoices key={kind} {...catalog} kind={kind} onModel={onModel} openProviders={onProviders} /></div>
    </section>
    <section><header className="om-discovery-heading"><h2 className="om-subtitle">{t('MCP tool reference')}</h2>
      <a className="om-text-link" href={GITHUB_REPOSITORY + '/blob/main/docs/mcp-phase1-tools.md'} target="_blank" rel="noreferrer">{t('Documentation')} ↗</a></header>
      {phase1Tools.map(tool => <div key={tool.name}><button className="om-nav-item" aria-expanded={toolId === tool.name}
        onClick={() => onTool(toolId === tool.name ? null : tool.name)}><RemixIcon name={toolId === tool.name ? 'arrow-down-s-line' : 'arrow-right-s-line'} size={16} /><code>{tool.name}</code></button>
        {toolId === tool.name && <div className="om-card om-card-stack"><p>{tool.description}</p><pre className="om-code-block">{JSON.stringify(tool.inputSchema, null, 2)}</pre></div>}
      </div>)}
    </section>
  </div></main>;
}
