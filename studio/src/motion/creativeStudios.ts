import { modelReferenceLimit, type Model, type Modality } from '../../../shared/gateway';
import { creativeStudios, studioScenes, type MediaStudio, type TechniqueStudio, type StudioScene } from '../../../shared/studio-catalog';

export { creativeStudios, studioScenes, type StudioScene };
export const motionStudio = creativeStudios.find(studio => studio.surface === 'editor')!;
type GeneratingStudio = MediaStudio | TechniqueStudio;
export type StudioDestination = { studio: GeneratingStudio; scene: StudioScene; model: string | null; landing?: true };
export const mediaLabels: Record<Modality, string> = { image: 'Image', video: 'Video', audio: 'Audio' };

export function studioDraftKey({ studio, scene }: StudioDestination, skill?: string | null) {
  return [studio.id, scene.id, ...(studio.surface === 'techniques' && skill ? [skill] : [])].join('/');
}

export function scenesForStudio(studio: GeneratingStudio) {
  return studio.scenes.map(id => studioScenes.find(scene => scene.id === id)!);
}

export function studioDestination(studio: GeneratingStudio, sceneId?: string | null, model: string | null = null): StudioDestination {
  const scenes = scenesForStudio(studio);
  return { studio, scene: scenes.find(scene => scene.id === sceneId) ?? scenes[0], model };
}

export function sceneDestination(scene: StudioScene, current?: StudioDestination | null, model: string | null = null): StudioDestination {
  const includes = (studio: GeneratingStudio) => studio.scenes.some(id => id === scene.id);
  const studio = current?.studio.surface === 'media' && includes(current.studio) ? current.studio
    : creativeStudios.find((item): item is MediaStudio => item.surface === 'media' && includes(item))!;
  return scene.entry === 'landing' ? { studio, scene, model, landing: true } : { studio, scene, model };
}

export const needsImage = (scene: StudioScene) => 'requiresImage' in scene && scene.requiresImage;

export function supportsScene(model: Model, scene: StudioScene) {
  if (model.modality !== scene.modality) return false;
  if (needsImage(scene) && modelReferenceLimit(model) <= 0) return false;
  return !('modelMode' in scene) || model.mode === scene.modelMode;
}

export function modelDestination(model: Model, current?: StudioDestination | null): StudioDestination {
  if (current && supportsScene(model, current.scene)) return { ...current, model: model.id };
  const compatible = (scene: StudioScene) => supportsScene(model, scene);
  const scene = (current && scenesForStudio(current.studio).find(compatible)) ?? studioScenes.find(compatible);
  if (!scene) throw new Error('Model has no supported scene');
  return sceneDestination(scene, current, model.id);
}
