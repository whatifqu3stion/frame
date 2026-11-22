import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {loadFont} from '@remotion/fonts';
import guide from '../../expo/constants/introduction.json';
import owl from '../../expo/assets/video-posters/owl-teal-print.webp';
import brush from '../../expo/assets/video-posters/fine-art-brush-sweep.webp';
import shell from '../../expo/assets/video-posters/science-nautilus.webp';
import stamps from '../../expo/assets/video-posters/music-stamps.webp';
import {brand} from './brand';

const art = [owl, brush, shell, stamps];
export const guideFps = 24;
const length = guide.secondsPerChapter * guideFps;
export const guideFrames = length * guide.chapters.length;
let fonts: Promise<unknown> | undefined;

export function ViewingGuide() {
  fonts ??= Promise.all([
    loadFont({family: 'LibreCaslonText_400Regular', url: staticFile('fonts/LibreCaslonText_400Regular.ttf')}),
    loadFont({family: 'HankenGrotesk_400Regular', url: staticFile('fonts/HankenGrotesk_400Regular.ttf')}),
  ]);
  const frame = useCurrentFrame();
  const scene = Math.floor(frame / length);
  const t = frame % length;
  const chapter = guide.chapters[scene];
  const changed = t >= 65;
  const opacity = interpolate(t, [0, 7, 57, 64, 72], [1, 1, 1, 0, 1], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{backgroundColor: brand.wall, color: brand.ink, fontFamily: 'HankenGrotesk_400Regular', padding: '25px 32px'}}>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14}}>
      <span style={{fontFamily: 'LibreCaslonText_400Regular', fontSize: 31}}>Frame</span>
      <span style={{fontSize: 24, color: brand.mineralBlue}}>{String(scene + 1).padStart(2, '0')} / 04　{chapter.section}</span>
    </div>
    <div style={{height: 230, position: 'relative', overflow: 'hidden', backgroundColor: brand.ivory}}>
      <Img src={art[scene]} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: scene === 0 ? 'center 34%' : 'center'}}/>
      <div style={{position: 'absolute', left: 18, bottom: 16, opacity, borderRadius: 24, background: brand.ivory, color: brand.ink, padding: '5px 17px', fontSize: 26}}>
        {changed ? chapter.after : chapter.before}
      </div>
    </div>
    <div style={{marginTop: 20, fontFamily: 'LibreCaslonText_400Regular', fontSize: 48, lineHeight: 1.2}}>{chapter.title}</div>
    <div style={{marginTop: 10, fontSize: 33, lineHeight: 1.18, maxWidth: 660}}>{chapter.body}</div>
    <div style={{position: 'absolute', bottom: 24, left: 32, right: 32, display: 'flex', gap: 7}}>
      {guide.chapters.map((item, i) => <div key={item.section} style={{height: 4, flex: 1, background: i <= scene ? brand.mineralBlue : '#CEC8BE'}}/>)}
    </div>
  </AbsoluteFill>;
}
